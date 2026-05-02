'use strict';

// Tracks FMP API credit consumption in Redis so all replicas share the same
// count. Uses atomic INCR so parallel requests can't double-spend the quota.

const { incrementCounter, getCache } = require('./cache');
const log = require('./logger');

const DAILY_LIMIT  = parseInt(process.env.FMP_DAILY_LIMIT) || 250;
const WARNING_PCT  = 0.90; // above 90 %: disable background refreshes
const SENTINEL_TTL = 25 * 3600; // 25 h — survives midnight, auto-expires after reset

function _todayKey() {
  // UTC date string — resets at midnight UTC, matching FMP's reset window
  return `fmp:calls:${new Date().toISOString().slice(0, 10)}`;
}

async function getUsage() {
  const raw  = await getCache(_todayKey());
  const used = typeof raw === 'number' ? raw : (parseInt(raw, 10) || 0);
  return { used, limit: DAILY_LIMIT, pct: used / DAILY_LIMIT };
}

async function recordCall() {
  const count = await incrementCounter(_todayKey(), SENTINEL_TTL);
  if (count === Math.floor(DAILY_LIMIT * WARNING_PCT)) {
    log.warn(`[CreditSentinel] FMP quota at ${Math.round(WARNING_PCT * 100)}% (${count}/${DAILY_LIMIT}) — background refreshes paused`);
  }
  if (count >= DAILY_LIMIT) {
    log.error(`[CreditSentinel] FMP daily quota exhausted (${count}/${DAILY_LIMIT})`);
  }
  return count;
}

// Returns true if a live (user-triggered) FMP call is still allowed today
async function canCall() {
  const { pct } = await getUsage();
  return pct < 1.0;
}

// Returns true if a background (non-user-triggered) refresh is allowed.
// Background refreshes are paused at 90 % to leave headroom for user requests.
async function canRefresh() {
  const { pct } = await getUsage();
  return pct < WARNING_PCT;
}

module.exports = { getUsage, recordCall, canCall, canRefresh };
