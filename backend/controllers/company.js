'use strict';
const fmp = require('../services/fmp');
const polygon = require('../services/polygon');
const { getCache, setCache, deleteCache, withDedup, TTL } = require('../utils/cache');
const tc = require('../models/TickerCache');
const { tickerVariants } = require('../utils/sanitizer');
const {
  normalizeCompany,
  normalizeIncomeStatement,
  normalizeBalanceSheet,
  normalizeCashFlow,
  normalizeHistoricalPrices,
} = require('../utils/normalize');
const { calculateDCF } = require('../utils/dcf');
const db = require('../db/queries');

// Build a minimal company object from Polygon ticker details.
// Used as Phase-2 fallback when FMP returns empty for a valid ticker.
async function _companyFromPolygon(ticker) {
  const details = await polygon.fetchTickerDetails(ticker);
  const r = details?.results;
  if (!r?.ticker) return null;
  return {
    ticker:            r.ticker,
    name:              r.name              || ticker,
    exchange:          r.primary_exchange  || '',
    sector:            r.sic_description   || '',
    industry:          r.sic_description   || '',
    description:       r.description       || '',
    currency:          r.currency_name     ? r.currency_name.toUpperCase() : 'USD',
    country:           r.locale === 'us'   ? 'US' : (r.locale || ''),
    website:           r.homepage_url      || '',
    price:             null,
    marketCap:         r.market_cap        || null,
    sharesOutstanding: r.share_class_shares_outstanding || null,
    beta:              null,
    peRatio:           null,
    eps:               null,
    changePercent:     null,
    high52w:           null,
    low52w:            null,
    avgVolume:         null,
    _dataSource:       'polygon_snapshot',
  };
}

function sendRateLimit(res) {
  return res.status(429).json({
    error: 'FMP API rate limit reached. Please wait a few minutes and try again.',
  });
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;
function validateTicker(ticker, res) {
  if (!TICKER_RE.test(ticker)) {
    res.status(400).json({ error: 'Invalid ticker symbol.' });
    return false;
  }
  return true;
}

// ── Private data-fetching helpers ─────────────────────────────────────────────
// Each helper is self-contained: checks its own cache, deduplicates concurrent
// requests, falls back to the DB, and writes through to cache on success.
// Route handlers and getFullSpectrum both delegate to these.

async function _fetchCompany(ticker, { skipDbCache = false } = {}) {
  const cacheKey = `company:${ticker}`;

  // ── 1. Hot cache (Redis / in-memory) ─────────────────────────────────────────
  const cached = await getCache(cacheKey);
  if (cached) return { data: cached, source: 'cache' };

  // ── 2. DB Fortress — serves even when FMP is unreachable ─────────────────────
  if (!skipDbCache) {
    const dbHit = await tc.getTickerCacheCompany(ticker);
    if (dbHit) {
      if (dbHit.isFresh) {
        await setCache(cacheKey, dbHit.data, TTL.COMPANY);
      } else {
        setImmediate(() =>
          _fetchCompany(ticker, { skipDbCache: true }).catch(() => {})
        );
      }
      return { data: dbHit.data, source: 'db' };
    }
  }

  // ── 3. Live API fetch (deduped) ───────────────────────────────────────────────
  const company = await withDedup(cacheKey, async () => {
    // Phase 1: try all ticker variants against FMP (handles BRK.B / BRK-B etc.)
    const variants = tickerVariants(ticker);
    let profileData = null;
    let usedTicker  = ticker;

    for (const v of variants) {
      try {
        const data = await fmp.fetchCompanyProfile(v);
        if (data?.length) { profileData = data; usedTicker = v; break; }
      } catch (e) {
        if (e.isRateLimit) throw e;
        console.warn(`[_fetchCompany] FMP profile failed for variant ${v}:`, e.message);
      }
    }

    // Phase 2: Polygon ticker details fallback
    if (!profileData?.length) {
      console.warn(`[_fetchCompany] FMP returned empty for all variants of ${ticker} — trying Polygon`);
      try {
        const polyCompany = await _companyFromPolygon(usedTicker);
        if (polyCompany) {
          try {
            const prev = await polygon.fetchPreviousClose(usedTicker);
            if (prev?.resultsCount > 0) {
              polyCompany.price         = prev.results[0].c   ?? null;
              polyCompany.changePercent = prev.results[0].todaysChangePerc ?? null;
            }
          } catch { /* price enrichment optional */ }
          db.upsertCompany(polyCompany).catch(() => {});
          tc.setTickerCacheCompany(ticker, polyCompany).catch(() => {});
          await setCache(cacheKey, polyCompany, TTL.COMPANY);
          return polyCompany;
        }
      } catch (polyErr) {
        console.warn(`[_fetchCompany] Polygon fallback failed for ${ticker}:`, polyErr.message);
      }

      // Phase 3: DB snapshot (stale but better than nothing)
      const snap = await tc.getTickerCacheCompany(ticker);
      if (snap) { await setCache(cacheKey, snap.data, TTL.COMPANY); return snap.data; }
      const dbRow = await db.getCompanyFromDB(ticker);
      if (dbRow) { await setCache(cacheKey, dbRow, TTL.COMPANY); return dbRow; }

      const e = new Error(`Ticker "${ticker}" not found.`);
      e.status = 404;
      throw e;
    }

    const c = normalizeCompany(profileData);
    if (!c) {
      const e = new Error(`Ticker "${ticker}" not found.`);
      e.status = 404;
      throw e;
    }

    // Enrich with real-time quote
    try {
      const quoteData = await fmp.fetchQuote(usedTicker);
      if (quoteData?.length) {
        const q = quoteData[0];
        c.price         = q.price            ?? c.price;
        c.change        = q.change            ?? null;
        c.changePercent = q.changesPercentage ?? null;
        c.high52w       = q.yearHigh          ?? null;
        c.low52w        = q.yearLow           ?? null;
        c.avgVolume     = q.avgVolume         ?? null;
        c.peRatio       = q.pe                ?? null;
        c.eps           = q.eps               ?? null;

        if (c.peRatio !== null && (c.peRatio <= 0 || c.peRatio > 5000)) {
          c.peRatio = (c.price > 0 && c.eps > 0) ? +(c.price / c.eps).toFixed(2) : null;
        }
      }
    } catch (qErr) {
      console.warn(`[_fetchCompany] Quote fetch failed for ${ticker}:`, qErr.message);
    }

    // Enrich with Polygon prev-close
    try {
      const prevClose = await polygon.fetchPreviousClose(usedTicker);
      if (prevClose?.resultsCount > 0) {
        const p = prevClose.results[0];
        c.prevClose = p.c ?? null;
        c.openPrice = p.o ?? null;
        c.dayHigh   = p.h ?? null;
        c.dayLow    = p.l ?? null;
        c.volume    = p.v ?? null;
      }
    } catch { /* optional enrichment */ }

    // Zero-dash: compute missing values from available fields
    if (!c.marketCap && c.price > 0 && c.sharesOutstanding > 0)
      c.marketCap = c.price * c.sharesOutstanding;
    if ((!c.peRatio || c.peRatio <= 0) && c.price > 0 && c.eps > 0)
      c.peRatio = +(c.price / c.eps).toFixed(2);

    db.upsertCompany(c).catch((e) => console.error('[DB] upsertCompany:', e.message));
    tc.setTickerCacheCompany(ticker, c).catch((e) => console.error('[TickerCache]:', e.message));
    await setCache(cacheKey, c, TTL.COMPANY);
    return c;
  }).catch(async (apiErr) => {
    if (apiErr.isRateLimit || apiErr.status === 404) throw apiErr;
    console.error(`[_fetchCompany] All sources failed for ${ticker}:`, apiErr.message);
    // Emergency: use whatever DB has, even if stale
    const snap = await tc.getTickerCacheCompany(ticker);
    if (snap) { await setCache(cacheKey, snap.data, TTL.COMPANY); return snap.data; }
    const dbRow = await db.getCompanyFromDB(ticker);
    if (dbRow) { await setCache(cacheKey, dbRow, TTL.COMPANY); return dbRow; }
    throw apiErr;
  });

  return { data: company, source: 'api' };
}

async function _fetchFinancials(ticker, { skipDbCache = false } = {}) {
  const cacheKey = `financials:${ticker}`;

  // ── 1. Hot cache ──────────────────────────────────────────────────────────────
  const cached = await getCache(cacheKey);
  if (cached) return { data: cached, source: 'cache' };

  // ── 2. DB Fortress Cache ──────────────────────────────────────────────────────
  if (!skipDbCache) {
    const dbHit = await tc.getTickerCacheFinancials(ticker);
    if (dbHit) {
      if (dbHit.isFresh) {
        await setCache(cacheKey, dbHit.data, TTL.FINANCIALS);
      } else {
        setImmediate(() =>
          _fetchFinancials(ticker, { skipDbCache: true }).catch(() => {})
        );
      }
      return { data: dbHit.data, source: 'db' };
    }
  }

  // ── 3. API fetch ──────────────────────────────────────────────────────────────
  const data = await withDedup(cacheKey, async () => {
    try {
      const [incomeRaw, balanceRaw, cashflowRaw] = await Promise.all([
        fmp.fetchIncomeStatement(ticker, 5),
        fmp.fetchBalanceSheet(ticker, 5),
        fmp.fetchCashFlow(ticker, 5),
      ]);

      const result = {
        income:   normalizeIncomeStatement(incomeRaw),
        balance:  normalizeBalanceSheet(balanceRaw),
        cashflow: normalizeCashFlow(cashflowRaw),
      };

      const allRows = [
        ...result.income.map((r)   => ({ ...r, period: r.period || 'FY' })),
        ...result.balance.map((r)  => ({ ...r, period: r.period || 'FY' })),
        ...result.cashflow.map((r) => ({ ...r, period: r.period || 'FY' })),
      ];
      db.upsertFinancials(ticker, allRows).catch((e) =>
        console.error('[DB] upsertFinancials:', e.message)
      );
      tc.setTickerCacheFinancials(ticker, result).catch((e) =>
        console.error('[TickerCache] financials:', e.message)
      );
      await setCache(cacheKey, result, TTL.FINANCIALS);
      return result;

    } catch (apiErr) {
      if (apiErr.isRateLimit) throw apiErr;
      console.warn(`[_fetchFinancials] API error for ${ticker}, trying DB:`, apiErr.message);
      const rows = await db.getFinancialsFromDB(ticker);
      if (rows.length) { await setCache(cacheKey, rows, TTL.FINANCIALS); return rows; }
      throw apiErr;
    }
  });

  return { data, source: 'api' };
}

async function _fetchChart(ticker, years = 1) {
  const cacheKey = `chart:${ticker}:${years}y`;
  const cached = await getCache(cacheKey);
  if (cached) return { data: cached, source: 'cache' };

  const data = await withDedup(cacheKey, async () => {
    try {
      const raw    = await fmp.fetchHistoricalPrices(ticker, years);
      const result = normalizeHistoricalPrices(raw);
      db.upsertPrices(ticker, result).catch((e) =>
        console.error('[DB] upsertPrices:', e.message)
      );
      await setCache(cacheKey, result, TTL.CHART);
      return result;

    } catch (apiErr) {
      if (apiErr.isRateLimit) throw apiErr;
      console.warn(`[_fetchChart] API error for ${ticker}, trying DB:`, apiErr.message);
      const rows = await db.getPricesFromDB(ticker, years);
      if (rows.length) { await setCache(cacheKey, rows, TTL.CHART); return rows; }
      throw apiErr;
    }
  });

  return { data, source: 'api' };
}

// ── GET /api/company/:ticker ───────────────────────────────────────────────────

async function getCompany(req, res) {
  const ticker = req.params.ticker.toUpperCase();
  if (!validateTicker(ticker, res)) return;
  try {
    const { data, source } = await _fetchCompany(ticker);
    return res.json({ source, data });
  } catch (err) {
    if (err.isRateLimit)    return sendRateLimit(res);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    console.error(`[getCompany] ${ticker}:`, err.message);
    const detail = process.env.NODE_ENV === 'development' ? err.message : undefined;
    return res.status(500).json({ error: 'Failed to fetch company data.', detail });
  }
}

// ── GET /api/company/:ticker/financials ────────────────────────────────────────

async function getFinancials(req, res) {
  const ticker = req.params.ticker.toUpperCase();
  if (!validateTicker(ticker, res)) return;
  try {
    const { data, source } = await _fetchFinancials(ticker);
    return res.json({ source, data });
  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error(`[getFinancials] ${ticker}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch financial statements.' });
  }
}

// ── GET /api/company/:ticker/chart ─────────────────────────────────────────────

async function getChart(req, res) {
  const ticker = req.params.ticker.toUpperCase();
  if (!validateTicker(ticker, res)) return;
  const years = Math.min(parseInt(req.query.years) || 5, 10);
  try {
    const { data, source } = await _fetchChart(ticker, years);
    return res.json({ source, data });
  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error(`[getChart] ${ticker}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch price history.' });
  }
}

// ── GET /api/company/:ticker/full-spectrum ─────────────────────────────────────
// Fetches company profile, full financials, and 1Y price history in a single
// parallel burst. Each sub-fetch respects its own cache independently.
// Financial ratios missing from the API are backfilled from raw statement data.

async function getFullSpectrum(req, res) {
  const ticker = req.params.ticker.toUpperCase();
  if (!validateTicker(ticker, res)) return;

  try {
    const [companyResult, financialsResult, chartResult] = await Promise.allSettled([
      _fetchCompany(ticker),
      _fetchFinancials(ticker),
      _fetchChart(ticker, 1),
    ]);

    // Company is required — fail fast if it's missing
    if (companyResult.status === 'rejected') {
      const err = companyResult.reason;
      if (err.isRateLimit)    return sendRateLimit(res);
      if (err.status === 404) return res.status(404).json({ error: err.message });
      console.error(`[getFullSpectrum] company fetch failed for ${ticker}:`, err.message);
      return res.status(500).json({ error: 'Failed to fetch stock data.' });
    }

    const company    = companyResult.value.data;
    const financials = financialsResult.status === 'fulfilled'
      ? financialsResult.value.data : null;
    const chart      = chartResult.status === 'fulfilled'
      ? chartResult.value.data : null;

    // Backfill valuation ratios the API may not have returned
    if (company && financials) {
      const income  = financials.income?.[0]  || {};
      const balance = financials.balance?.[0] || {};

      // EPS fallback: income statement epsDiluted → eps
      if (company.eps == null) {
        const stmtEps = income.epsDiluted ?? income.eps ?? null;
        if (stmtEps != null) company.eps = stmtEps;
      }

      // Market cap fallback: price × sharesOutstanding
      if (company.marketCap == null && company.price > 0) {
        const shares = income.sharesOutstanding ?? company.sharesOutstanding ?? null;
        if (shares > 0) company.marketCap = company.price * shares;
      }

      // P/E sanity + fallback
      if ((company.peRatio == null || company.peRatio <= 0 || company.peRatio > 5000)
          && company.price > 0 && company.eps > 0) {
        company.peRatio = +(company.price / company.eps).toFixed(2);
      }

      const mktCap    = company.marketCap;
      const revenue   = income.revenue;
      const equity    = balance.shareholdersEquity;
      const totalDebt = balance.totalDebt;
      const cash      = balance.cashAndEquivalents;
      const ebitda    = income.ebitda;

      if (company.psRatio == null && mktCap && revenue)
        company.psRatio = mktCap / revenue;
      if (company.pbRatio == null && mktCap && equity && equity > 0)
        company.pbRatio = mktCap / equity;
      if (company.evEbitda == null && mktCap != null && totalDebt != null
          && cash != null && ebitda && ebitda > 0)
        company.evEbitda = (mktCap + totalDebt - cash) / ebitda;
    }

    const allFromCache = [companyResult, financialsResult, chartResult]
      .filter(r => r.status === 'fulfilled')
      .every(r => r.value.source === 'cache');

    return res.json({
      source: allFromCache ? 'cache' : 'api',
      data: { company, financials, chart },
    });

  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error(`[getFullSpectrum] ${ticker}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch stock data.' });
  }
}

// ── POST /api/company/:ticker/dcf ──────────────────────────────────────────────

async function runDCF(req, res) {
  const ticker = req.params.ticker.toUpperCase();
  if (!validateTicker(ticker, res)) return;

  const rawBody = req.body;
  const growthRate   = Math.min(Math.max(parseFloat(rawBody.growthRate)     || 0.10, -0.50), 1.00);
  const discountRate = Math.min(Math.max(parseFloat(rawBody.discountRate)   || 0.10,  0.01), 1.00);
  const termGrowth   = Math.min(Math.max(parseFloat(rawBody.terminalGrowth) || 0.03, -0.10), 0.50);
  const forecastYrs  = Math.min(Math.max(parseInt(rawBody.forecastYears)    || 10,   1),    50);

  try {
    const cacheKey = `financials:${ticker}`;
    let financials  = await getCache(cacheKey);

    if (!financials) {
      try {
        const { data } = await _fetchFinancials(ticker);
        financials = data;
      } catch (apiErr) {
        if (apiErr.isRateLimit) return sendRateLimit(res);
        throw apiErr;
      }
    }

    const latestCF = financials.cashflow?.[0];
    const latestBS = financials.balance?.[0];
    const latestIS = financials.income?.[0];

    const freeCashFlow = latestCF?.freeCashFlow;
    if (!freeCashFlow || freeCashFlow <= 0) {
      return res.status(400).json({
        error: 'This company has negative or zero free cash flow. DCF valuation requires positive FCF.',
      });
    }

    const result = calculateDCF({
      freeCashFlow,
      growthRate:        growthRate,
      discountRate:      discountRate,
      terminalGrowth:    termGrowth,
      forecastYears:     forecastYrs,
      netDebt:           latestBS?.netDebt || 0,
      sharesOutstanding: latestIS?.sharesOutstanding || 1,
    });

    return res.json({ ticker, data: result });

  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error(`[runDCF] ${ticker}:`, err.message);
    return res.status(400).json({ error: err.message });
  }
}

// ── GET /api/company/:ticker/news ─────────────────────────────────────────────

async function getNews(req, res) {
  const ticker = req.params.ticker.toUpperCase();
  if (!validateTicker(ticker, res)) return;
  const limit    = Math.min(parseInt(req.query.limit) || 10, 20);
  const cacheKey = `news:${ticker}`;

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ source: 'cache', data: cached });

    const raw      = await fmp.fetchNews(ticker, limit);
    const articles = (Array.isArray(raw) ? raw : []).slice(0, limit).map((a) => ({
      title:       a.title       || '',
      url:         a.url         || '',
      source:      a.site        || a.publisher || '',
      publishedAt: a.publishedDate || a.date || '',
      summary:     a.text
        ? a.text.slice(0, 200) + (a.text.length > 200 ? '…' : '')
        : '',
      image:       a.image       || null,
    }));

    await setCache(cacheKey, articles, 30 * 60);
    return res.json({ source: 'api', data: articles });

  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error(`[getNews] ${ticker}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch news.' });
  }
}

// Maps Polygon MIC codes / market strings to short display labels
function friendlyExchange(raw) {
  const map = {
    'XNAS': 'NASDAQ', 'XNYS': 'NYSE', 'XASE': 'AMEX',
    'ARCX': 'NYSE Arca', 'BATS': 'CBOE', 'OTCM': 'OTC',
    'XLON': 'LSE', 'XPAR': 'Euronext', 'XFRA': 'Frankfurt',
    'XTSE': 'TSX', 'XHKG': 'HKEX', 'XTOK': 'TSE',
    'stocks': 'US', 'otc': 'OTC', 'fx': 'FX', 'crypto': 'Crypto',
  };
  return map[raw] || raw;
}

// ── GET /api/company/search?q= ─────────────────────────────────────────────────

async function searchCompanies(req, res) {
  const query = (req.query.q || '').trim().slice(0, 50);
  if (!query || query.length < 1) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  try {
    const response = await polygon.searchTickers(query);
    const filtered  = (response?.results || []).slice(0, 10).map((r) => ({
      ticker:   r.ticker,
      name:     r.name,
      exchange: friendlyExchange(r.primary_exchange || r.market || ''),
      market:   r.market || '',
      locale:   r.locale || '',
    }));
    return res.json({ data: filtered });
  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error('[searchCompanies]', err.message);
    const detail = process.env.NODE_ENV === 'development' ? err.message : undefined;
    return res.status(500).json({ error: 'Search failed.', detail });
  }
}

module.exports = {
  getCompany,
  getFinancials,
  getChart,
  getFullSpectrum,
  runDCF,
  searchCompanies,
  getNews,
};
