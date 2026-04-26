'use strict';
const pool = require('../db/index');

const FRESH_HOURS = 4;
const MAX_HOURS   = 24;
const QUERY_TIMEOUT_MS = 2000; // DB must respond in 2s or we bypass it

// Race a query against a hard timeout — DB latency never blocks the user
function withTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB query timeout')), ms)
    ),
  ]);
}

async function getTickerCacheCompany(ticker) {
  try {
    return await withTimeout(async () => {
      const { rows } = await pool.query(
        `SELECT company_json,
                EXTRACT(EPOCH FROM (NOW() - company_cached_at)) / 3600 AS age_hours
         FROM ticker_cache WHERE ticker = $1`,
        [ticker.toUpperCase()]
      );
      if (!rows[0]?.company_json) return null;
      const age = parseFloat(rows[0].age_hours ?? 9999);
      if (age > MAX_HOURS) return null;
      return { data: rows[0].company_json, isFresh: age < FRESH_HOURS };
    }, QUERY_TIMEOUT_MS);
  } catch (err) {
    if (err.message !== 'DB query timeout')
      console.warn('[TickerCache] getCompany error:', err.message);
    return null;
  }
}

async function setTickerCacheCompany(ticker, company) {
  try {
    await withTimeout(() => pool.query(
      `INSERT INTO ticker_cache (ticker, company_json, company_cached_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (ticker) DO UPDATE SET
         company_json = EXCLUDED.company_json,
         company_cached_at = NOW()`,
      [ticker.toUpperCase(), JSON.stringify(company)]
    ), QUERY_TIMEOUT_MS);
  } catch (err) {
    console.warn('[TickerCache] setCompany error:', err.message);
  }
}

async function getTickerCacheFinancials(ticker) {
  try {
    return await withTimeout(async () => {
      const { rows } = await pool.query(
        `SELECT financials_json,
                EXTRACT(EPOCH FROM (NOW() - financials_cached_at)) / 3600 AS age_hours
         FROM ticker_cache WHERE ticker = $1`,
        [ticker.toUpperCase()]
      );
      if (!rows[0]?.financials_json) return null;
      const age = parseFloat(rows[0].age_hours ?? 9999);
      if (age > MAX_HOURS) return null;
      return { data: rows[0].financials_json, isFresh: age < FRESH_HOURS };
    }, QUERY_TIMEOUT_MS);
  } catch (err) {
    if (err.message !== 'DB query timeout')
      console.warn('[TickerCache] getFinancials error:', err.message);
    return null;
  }
}

async function setTickerCacheFinancials(ticker, financials) {
  try {
    await withTimeout(() => pool.query(
      `INSERT INTO ticker_cache (ticker, financials_json, financials_cached_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (ticker) DO UPDATE SET
         financials_json = EXCLUDED.financials_json,
         financials_cached_at = NOW()`,
      [ticker.toUpperCase(), JSON.stringify(financials)]
    ), QUERY_TIMEOUT_MS);
  } catch (err) {
    console.warn('[TickerCache] setFinancials error:', err.message);
  }
}

module.exports = {
  getTickerCacheCompany,
  setTickerCacheCompany,
  getTickerCacheFinancials,
  setTickerCacheFinancials,
};
