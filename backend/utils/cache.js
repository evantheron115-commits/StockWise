'use strict';
const Redis = require('ioredis');
const log   = require('./logger');

// ── In-Memory Fallback ─────────────────────────────────────────────────────────
// Active whenever Redis is unavailable. Capped at MAX_ENTRIES to prevent
// unbounded memory growth; evicts the oldest entry (insertion order) when full.

const MAX_ENTRIES = 500;
const mem = new Map(); // key → { data, expiresAt }

function memSet(key, data, ttlSec) {
  if (mem.size >= MAX_ENTRIES) {
    mem.delete(mem.keys().next().value); // evict oldest
  }
  mem.set(key, { data, expiresAt: Date.now() + ttlSec * 1000 });
}

function memGet(key) {
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { mem.delete(key); return null; }
  return e.data;
}

// ── Redis ──────────────────────────────────────────────────────────────────────

let redisOK = false;
let redisClient = null;

try {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    connectTimeout: 10000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 500, 5000);
    },
  });

  redisClient.on('ready', () => {
    if (!redisOK) log.info('[Cache] Redis connected');
    redisOK = true;
  });

  redisClient.on('error', () => {
    if (redisOK) log.warn('[Cache] Redis unavailable — using in-memory cache');
    redisOK = false;
  });

  redisClient.on('close', () => {
    if (redisOK) log.warn('[Cache] Redis connection closed — using in-memory cache');
    redisOK = false;
  });
} catch (err) {
  log.warn('[Cache] Redis init failed — using in-memory cache', { err: err.message });
}

// ── TTL Constants (seconds) ────────────────────────────────────────────────────
const TTL = {
  PRICE:      10 * 60,      // 10 minutes
  FINANCIALS: 24 * 3600,    // 24 hours
  COMPANY:    24 * 3600,    // 24 hours
  CHART:      60 * 60,      // 1 hour
};

// ── Cache Operations ───────────────────────────────────────────────────────────

async function getCache(key) {
  if (redisOK && redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (raw) return JSON.parse(raw);
    } catch { /* fall through to memory */ }
  }
  return memGet(key);
}

async function setCache(key, data, ttl = TTL.FINANCIALS) {
  memSet(key, data, ttl);
  if (redisOK && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', ttl);
    } catch { /* memory copy is the safety net */ }
  }
}

async function deleteCache(key) {
  mem.delete(key);
  if (redisOK && redisClient) {
    try { await redisClient.del(key); } catch { /* ignore */ }
  }
}

// ── Atomic counter (for quota tracking) ───────────────────────────────────────
// Uses Redis INCR for atomicity across replicas; falls back to non-atomic
// in-memory increment (acceptable for approximate quota counting).

async function incrementCounter(key, ttlSec) {
  if (redisOK && redisClient) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.expire(key, ttlSec);
      return count;
    } catch { /* fall through */ }
  }
  const current = (memGet(key) ?? 0) + 1;
  memSet(key, current, ttlSec);
  return current;
}

// ── Distributed lock (cross-replica thundering-herd prevention) ───────────────
// SET NX EX — acquires a lock only if the key does not exist.
// Returns true if this process now holds the lock.
// Falls back to always-true when Redis is unavailable (single-process semantics).

async function acquireLock(key, ttlSec = 30) {
  if (redisOK && redisClient) {
    try {
      const result = await redisClient.set(key, '1', 'NX', 'EX', ttlSec);
      return result === 'OK';
    } catch { /* treat as acquired so the process isn't frozen */ }
  }
  return true; // no Redis → always leader (graceful degradation)
}

async function releaseLock(key) {
  if (redisOK && redisClient) {
    try { await redisClient.del(key); } catch { /* ignore */ }
  }
}

// ── Request Deduplication (process-local) ─────────────────────────────────────
// Coalesces concurrent requests for the same key within a single process.
// For cross-replica deduplication, use acquireLock() at the controller level.

const inFlight = new Map();

async function withDedup(key, fetcher) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// ── Diagnostics ────────────────────────────────────────────────────────────────

function getCacheStatus() {
  return {
    redis:      redisOK ? 'connected' : 'unavailable',
    memEntries: mem.size,
    memMax:     MAX_ENTRIES,
    inFlight:   inFlight.size,
  };
}

module.exports = {
  getCache, setCache, deleteCache,
  incrementCounter, acquireLock, releaseLock,
  withDedup, TTL, getCacheStatus,
};
