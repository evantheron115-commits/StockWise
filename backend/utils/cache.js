'use strict';
const Redis = require('ioredis');

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
    if (!redisOK) console.log('[Cache] Redis connected ✓');
    redisOK = true;
  });

  redisClient.on('error', () => {
    if (redisOK) console.warn('[Cache] Redis unavailable — using in-memory cache');
    redisOK = false;
  });

  redisClient.on('close', () => {
    if (redisOK) console.warn('[Cache] Redis connection closed — using in-memory cache');
    redisOK = false;
  });
} catch (err) {
  console.warn('[Cache] Redis init failed — using in-memory cache:', err.message);
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
  // 1. Try Redis (authoritative, longer TTLs)
  if (redisOK && redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (raw) return JSON.parse(raw);
    } catch { /* fall through to memory */ }
  }
  // 2. Fall back to in-memory
  return memGet(key);
}

async function setCache(key, data, ttl = TTL.FINANCIALS) {
  // Always write memory — ensures instant fallback if Redis drops mid-session
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

// ── Request Deduplication ──────────────────────────────────────────────────────
// If two requests arrive for the same uncached key simultaneously, only ONE
// upstream FMP call fires. The second request waits for the first's promise.

const inFlight = new Map();

async function withDedup(key, fetcher) {
  if (inFlight.has(key)) {
    console.log(`[Cache] Coalescing duplicate request: ${key}`);
    return inFlight.get(key);
  }
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

module.exports = { getCache, setCache, deleteCache, withDedup, TTL, getCacheStatus };
