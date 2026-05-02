'use strict';
const Redis = require('ioredis');
const log   = require('./logger');

const DAILY_LIMIT = 240;
const REDIS_KEY   = 'fmp:credits:used';

// Credit cost per FMP operation type — reflects actual upstream API call count.
const COSTS = {
  company:    1,
  quote:      1,
  search:     1,
  financials: 3,   // income + balance + cashflow = 3 FMP requests
  historical: 3,
  news:       1,
  harvester:  10,
};

let _redis = null;

function getRedis() {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    _redis = new Redis(url, {
      connectTimeout:      5000,
      enableOfflineQueue:  false,
      maxRetriesPerRequest: 1,
      lazyConnect:         true,
    });
    _redis.on('error', () => {});
    return _redis;
  } catch {
    return null;
  }
}

function secondsUntilMidnightUTC() {
  const now      = Date.now();
  const midnight = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate() + 1
  );
  return Math.max(1, Math.floor((midnight - now) / 1000));
}

// Consume `type` credits atomically.
// Returns { allowed, used, remaining, fortress }.
// Fails open when Redis is unavailable — never block all traffic on infra failure.
async function consumeCredits(type = 'company') {
  const cost = COSTS[type] ?? 1;
  const r    = getRedis();

  if (!r) return { allowed: true, used: 0, remaining: DAILY_LIMIT, fortress: false };

  try {
    const used = await r.incrby(REDIS_KEY, cost);
    if (used === cost) {
      // First write this UTC day — expire counter at midnight
      await r.expire(REDIS_KEY, secondsUntilMidnightUTC());
    }
    const allowed   = used <= DAILY_LIMIT;
    const remaining = Math.max(0, DAILY_LIMIT - used);
    if (!allowed) {
      log.warn(`[CreditSentinel] CREDIT_EXHAUSTED — used=${used}/${DAILY_LIMIT}, type=${type}`);
    }
    return { allowed, used, remaining, fortress: !allowed };
  } catch {
    return { allowed: true, used: 0, remaining: DAILY_LIMIT, fortress: false };
  }
}

async function getCreditsUsed() {
  const r = getRedis();
  if (!r) return 0;
  try {
    const val = await r.get(REDIS_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

// Express middleware factory. Blocks FMP-consuming routes when the daily budget
// is exhausted. Sets x-valubull-fortress: true and returns 429 with
// CREDIT_EXHAUSTED code so the controller can fall back to DB-only mode.
function sentinel(type = 'company') {
  return async (req, res, next) => {
    const result = await consumeCredits(type);
    if (result.fortress) {
      res.setHeader('x-valubull-fortress', 'true');
      const err  = new Error('FMP credit budget exhausted. Serving cached data only.');
      err.code   = 'CREDIT_EXHAUSTED';
      err.status = 429;
      return next(err);
    }
    res.setHeader('x-valubull-credits-remaining', String(result.remaining));
    next();
  };
}

module.exports = { consumeCredits, getCreditsUsed, sentinel, COSTS, DAILY_LIMIT };
