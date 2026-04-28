'use strict';

// Priority-Weighted Background Harvester
//
// Three tiers, each on its own interval:
//   Tier 1 (15 min) — FMP "most active" + top gainers: hottest tickers right now
//   Tier 2 (30 min) — All distinct tickers in any user's Watchlist
//   Tier 3 (60 min) — S&P 500 / top-100 static list
//
// After a successful refresh the harvester pushes the updated company object
// to any client currently viewing that ticker via Socket.io (Vanta-Glass).

const axios  = require('axios');
const pool   = require('../db/index');
const fmp    = require('./fmp');
const tc     = require('../models/TickerCache');
const { setCache, TTL }     = require('../utils/cache');
const { normalizeCompany }  = require('../utils/normalize');
const { fillCompanyMetrics } = require('../utils/smartFill');
const log    = require('../utils/logger');

// Sockets module is loaded lazily to avoid circular-import issues at startup
let _sockets = null;
function getSockets() {
  if (!_sockets) _sockets = require('../utils/sockets');
  return _sockets;
}

const FMP_BASE = 'https://financialmodelingprep.com/stable';

const TIER1_INTERVAL   = 15 * 60 * 1000;
const TIER2_INTERVAL   = 30 * 60 * 1000;
const TIER3_INTERVAL   = 60 * 60 * 1000;
const INITIAL_DELAY    =  2 * 60 * 1000; // Let server stabilize before first run
const BATCH_SIZE       = 5;
const BATCH_DELAY      = 2500;           // 2.5s between batches
const STALE_HOURS      = 3;

// Exported so the health endpoint can report last run times
const stats = {
  tier1LastRun: null,
  tier2LastRun: null,
  tier3LastRun: null,
  totalRefreshes: 0,
};

// ── Market heat list from FMP ─────────────────────────────────────────────────

async function fetchHeatTickers() {
  try {
    const [actRes, gainRes] = await Promise.allSettled([
      axios.get(`${FMP_BASE}/stock_market/actives?apikey=${process.env.FMP_API_KEY}`, { timeout: 8000 }),
      axios.get(`${FMP_BASE}/stock_market/gainers?apikey=${process.env.FMP_API_KEY}`,  { timeout: 8000 }),
    ]);
    const tickers = new Set();
    for (const res of [actRes, gainRes]) {
      if (res.status !== 'fulfilled') continue;
      for (const item of (res.value.data || [])) {
        if (item.symbol) tickers.add(item.symbol.toUpperCase());
      }
    }
    return [...tickers].slice(0, 40);
  } catch (err) {
    log.warn('[Harvester] Heat list fetch failed', { err: err.message });
    return [];
  }
}

// ── Watchlist tickers from DB ─────────────────────────────────────────────────

async function fetchWatchlistTickers() {
  try {
    const { rows } = await pool.query(
      'SELECT DISTINCT ticker FROM watchlist ORDER BY ticker LIMIT 300'
    );
    return rows.map(r => r.ticker.toUpperCase());
  } catch {
    return []; // table may be empty or not exist yet
  }
}

// ── Core: refresh a single ticker ────────────────────────────────────────────

async function harvestTicker(ticker) {
  try {
    const existing = await tc.getTickerCacheCompany(ticker);
    if (existing?.isFresh) return 'skip';

    const [profileData, quoteData] = await Promise.all([
      fmp.fetchCompanyProfile(ticker).catch(() => null),
      fmp.fetchQuote(ticker).catch(() => null),
    ]);

    const c = normalizeCompany(profileData);
    if (!c?.ticker) return 'miss';

    if (Array.isArray(quoteData) && quoteData[0]) {
      const q = quoteData[0];
      c.price             = q.price             ?? c.price;
      c.change            = q.change             ?? null;
      c.changePercent     = q.changesPercentage  ?? null;
      c.high52w           = q.yearHigh           ?? null;
      c.low52w            = q.yearLow            ?? null;
      c.avgVolume         = q.avgVolume          ?? null;
      c.peRatio           = q.pe                 ?? null;
      c.eps               = q.eps                ?? null;
      c.marketCap         = q.marketCap          ?? c.marketCap;
      c.sharesOutstanding = q.sharesOutstanding  ?? c.sharesOutstanding;
      if (c.peRatio !== null && (c.peRatio <= 0 || c.peRatio > 5000)) {
        c.peRatio = (c.price > 0 && c.eps > 0) ? +(c.price / c.eps).toFixed(2) : null;
      }
    }

    fillCompanyMetrics(c, null);

    await tc.setTickerCacheCompany(ticker, c);
    await setCache(`company:${ticker}`, c, TTL.COMPANY);

    // Vanta-Glass: push live update to any client currently viewing this ticker
    getSockets().pushCompanyUpdate(ticker, c);

    stats.totalRefreshes++;
    return 'refresh';

  } catch (err) {
    if (err.isRateLimit) throw err; // bubble up so cycle can pause
    return 'error';
  }
}

// ── Batch runner (shared across tiers) ────────────────────────────────────────

async function runBatch(tickers, label) {
  const t0 = Date.now();
  let refreshed = 0, skipped = 0, errors = 0;

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    try {
      const outcomes = await Promise.allSettled(batch.map(harvestTicker));
      for (const o of outcomes) {
        const result = o.status === 'fulfilled' ? o.value : 'error';
        if (result === 'refresh') refreshed++;
        else if (result === 'skip') skipped++;
        else errors++;
        // Re-throw rate limit so the outer loop can pause
        if (o.status === 'rejected' && o.reason?.isRateLimit) throw o.reason;
      }
    } catch (err) {
      if (err.isRateLimit) {
        log.warn('[Harvester] Rate limited — pausing 60s', { tier: label });
        await new Promise(r => setTimeout(r, 60_000));
        i -= BATCH_SIZE; // retry this batch
        continue;
      }
    }
    if (i + BATCH_SIZE < tickers.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const ms = Date.now() - t0;
  log.info(`[Harvester] ${label} done`, { refreshed, skipped, errors, ms });
}

// ── Tier cycles ───────────────────────────────────────────────────────────────

async function runTier1() {
  const tickers = await fetchHeatTickers();
  if (tickers.length) await runBatch(tickers, 'Tier1(heat)');
  stats.tier1LastRun = new Date().toISOString();
}

async function runTier2() {
  const tickers = await fetchWatchlistTickers();
  if (tickers.length) await runBatch(tickers, 'Tier2(watchlist)');
  stats.tier2LastRun = new Date().toISOString();
}

const TIER3_TICKERS = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','LLY', 'JPM', 'V',
  'UNH', 'XOM', 'MA',  'JNJ', 'PG',  'AVGO','HD',  'MRK', 'COST','ABBV',
  'CVX', 'KO',  'PEP', 'WMT', 'ORCL','BAC', 'CRM', 'CSCO','AMD', 'ACN',
  'MCD', 'LIN', 'TMO', 'NFLX','TXN', 'PM',  'ADBE','WFC', 'DHR', 'MS',
  'ABT', 'INTU','GE',  'AMGN','RTX', 'IBM', 'CAT', 'SPGI','QCOM','INTC',
  'BLK', 'AXP', 'VZ',  'T',   'NEE', 'NOW', 'ISRG','PLD', 'GS',  'LOW',
  'UNP', 'HON', 'ELV', 'SYK', 'DE',  'MDLZ','ETN', 'ADP', 'BKNG','TJX',
  'CB',  'REGN','ADI', 'VRTX','LMT', 'MMM', 'PANW','MO',  'BSX', 'GILD',
  'SO',  'CI',  'SCHW','DUK', 'ZTS', 'PGR', 'CME', 'BDX', 'EOG', 'AMAT',
  'ITW', 'MMC', 'SLB', 'NOC', 'HUM', 'F',   'GM',  'DAL', 'COIN','SHOP',
];

async function runTier3() {
  await runBatch(TIER3_TICKERS, 'Tier3(global)');
  stats.tier3LastRun = new Date().toISOString();
}

// ── Boot ─────────────────────────────────────────────────────────────────────

let started = false;

function start() {
  if (started) return;
  started = true;

  // Stagger initial runs so they don't all fire at boot
  setTimeout(runTier1, INITIAL_DELAY);
  setTimeout(runTier2, INITIAL_DELAY + 30_000);
  setTimeout(runTier3, INITIAL_DELAY + 60_000);

  setInterval(runTier1, TIER1_INTERVAL);
  setInterval(runTier2, TIER2_INTERVAL);
  setInterval(runTier3, TIER3_INTERVAL);

  log.info('[Harvester] Priority-weighted worker started', {
    tier1: '15min', tier2: '30min', tier3: '60min',
  });
}

module.exports = { start, stats };
