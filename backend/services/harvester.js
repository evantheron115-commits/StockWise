'use strict';

// Background Data Harvester
// Proactively refreshes the Top 100 tickers in DB + Redis every 60 minutes so
// users always hit warm cache on first request. Runs staggered batches to stay
// well under FMP rate limits.

const fmp             = require('./fmp');
const tc              = require('../models/TickerCache');
const { setCache, TTL } = require('../utils/cache');
const { normalizeCompany } = require('../utils/normalize');
const { fillCompanyMetrics } = require('../utils/smartFill');

const INTERVAL_MS  = 60 * 60 * 1000; // 60 minutes
const BATCH_SIZE   = 5;
const BATCH_DELAY  = 3000;            // 3s between batches — stays under FMP limits
const STALE_HOURS  = 3;              // Re-fetch only if cache is older than 3 hours
const INITIAL_DELAY = 2 * 60 * 1000; // Wait 2 min after boot before first run

const TOP_100 = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'LLY',  'JPM',  'V',
  'UNH',  'XOM',  'MA',   'JNJ',  'PG',   'AVGO', 'HD',   'MRK',  'COST', 'ABBV',
  'CVX',  'KO',   'PEP',  'WMT',  'ORCL', 'BAC',  'CRM',  'CSCO', 'AMD',  'ACN',
  'MCD',  'LIN',  'TMO',  'NFLX', 'TXN',  'PM',   'ADBE', 'WFC',  'DHR',  'MS',
  'ABT',  'INTU', 'GE',   'AMGN', 'RTX',  'IBM',  'CAT',  'SPGI', 'QCOM', 'INTC',
  'BLK',  'AXP',  'VZ',   'T',    'NEE',  'NOW',  'ISRG', 'PLD',  'GS',   'LOW',
  'UNP',  'HON',  'ELV',  'SYK',  'DE',   'MDLZ', 'ETN',  'ADP',  'BKNG', 'TJX',
  'CB',   'REGN', 'ADI',  'VRTX', 'LMT',  'MMM',  'PANW', 'MO',   'BSX',  'GILD',
  'SO',   'CI',   'SCHW', 'DUK',  'ZTS',  'PGR',  'CME',  'BDX',  'EOG',  'AMAT',
  'ITW',  'MMC',  'SLB',  'NOC',  'HUM',  'F',    'GM',   'DAL',  'COIN', 'SHOP',
];

async function harvestTicker(ticker) {
  try {
    // Skip if DB cache is still fresh (< STALE_HOURS old)
    const existing = await tc.getTickerCacheCompany(ticker);
    if (existing?.isFresh) return 'skip';

    const [profileData, quoteData] = await Promise.all([
      fmp.fetchCompanyProfile(ticker).catch(() => null),
      fmp.fetchQuote(ticker).catch(() => null),
    ]);

    const c = normalizeCompany(profileData);
    if (!c?.ticker) return 'miss';

    // Enrich with real-time quote fields (same logic as company controller)
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
    return 'refresh';

  } catch (err) {
    if (err.isRateLimit) {
      // Bubble rate-limit up so the cycle loop can pause
      throw err;
    }
    // All other errors: silently skip this ticker
    return 'error';
  }
}

async function runHarvestCycle() {
  const t0 = Date.now();
  let refreshed = 0, skipped = 0, errors = 0;

  console.log(`[Harvester] Cycle started — ${TOP_100.length} tickers`);

  for (let i = 0; i < TOP_100.length; i += BATCH_SIZE) {
    const batch = TOP_100.slice(i, i + BATCH_SIZE);

    try {
      const outcomes = await Promise.all(batch.map(harvestTicker));
      for (const o of outcomes) {
        if (o === 'refresh') refreshed++;
        else if (o === 'skip') skipped++;
        else errors++;
      }
    } catch (err) {
      if (err.isRateLimit) {
        console.warn('[Harvester] Rate limited — pausing 60s then resuming');
        await new Promise(r => setTimeout(r, 60_000));
        i -= BATCH_SIZE; // retry this batch
        continue;
      }
    }

    if (i + BATCH_SIZE < TOP_100.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[Harvester] Cycle done in ${elapsed}s — refreshed:${refreshed} skipped:${skipped} errors:${errors}`);
}

let started = false;

function start() {
  if (started) return;
  started = true;
  setTimeout(runHarvestCycle, INITIAL_DELAY);
  setInterval(runHarvestCycle, INTERVAL_MS);
  console.log('[Harvester] Background worker started — 60min cycle, first run in 2min');
}

module.exports = { start };
