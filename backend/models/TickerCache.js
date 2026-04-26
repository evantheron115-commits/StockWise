'use strict';
const pool = require('../db/index');

const FRESH_HOURS = 4;  // < 4h: serve from DB, skip API
const MAX_HOURS   = 24; // > 24h: treat as miss, force API refresh

async function getTickerCacheCompany(ticker) {
  try {
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
  } catch { return null; }
}

async function setTickerCacheCompany(ticker, company) {
  await pool.query(
    `INSERT INTO ticker_cache (ticker, company_json, company_cached_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (ticker) DO UPDATE SET
       company_json = EXCLUDED.company_json,
       company_cached_at = NOW()`,
    [ticker.toUpperCase(), JSON.stringify(company)]
  );
}

async function getTickerCacheFinancials(ticker) {
  try {
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
  } catch { return null; }
}

async function setTickerCacheFinancials(ticker, financials) {
  await pool.query(
    `INSERT INTO ticker_cache (ticker, financials_json, financials_cached_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (ticker) DO UPDATE SET
       financials_json = EXCLUDED.financials_json,
       financials_cached_at = NOW()`,
    [ticker.toUpperCase(), JSON.stringify(financials)]
  );
}

module.exports = {
  getTickerCacheCompany,
  setTickerCacheCompany,
  getTickerCacheFinancials,
  setTickerCacheFinancials,
};
