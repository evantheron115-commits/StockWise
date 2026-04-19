'use strict';
const fmp = require('../services/fmp');
const polygon = require('../services/polygon');
const { getCache, setCache, withDedup, TTL } = require('../utils/cache');
const {
  normalizeCompany,
  normalizeIncomeStatement,
  normalizeBalanceSheet,
  normalizeCashFlow,
  normalizeHistoricalPrices,
} = require('../utils/normalize');
const { calculateDCF } = require('../utils/dcf');
const db = require('../db/queries');

// Shared rate-limit response — keeps all endpoints consistent
function sendRateLimit(res) {
  return res.status(429).json({
    error: 'FMP API rate limit reached. Please wait a few minutes and try again.',
  });
}

// ── GET /api/company/:ticker ───────────────────────────────────────────────────

async function getCompany(req, res) {
  const ticker   = req.params.ticker.toUpperCase();
  const cacheKey = `company:${ticker}`;

  try {
    // 1. Cache hit (Redis or in-memory)
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`[getCompany] Cache hit: ${ticker}`);
      return res.json({ source: 'cache', data: cached });
    }

    // 2. Deduplicated upstream fetch — only ONE FMP call fires even if
    //    multiple requests arrive simultaneously for the same ticker
    const company = await withDedup(cacheKey, async () => {
      try {
        const [profileData, quoteData] = await Promise.all([
          fmp.fetchCompanyProfile(ticker),
          fmp.fetchQuote(ticker),
        ]);

        if (!profileData || !profileData.length) {
          const dbRow = await db.getCompanyFromDB(ticker);
          if (dbRow) {
            await setCache(cacheKey, dbRow, TTL.COMPANY);
            return dbRow;
          }
          const e = new Error(`Ticker "${ticker}" not found.`);
          e.status = 404;
          throw e;
        }

        const c = normalizeCompany(profileData);
        if (quoteData && quoteData.length) {
          const q = quoteData[0];
          c.price         = q.price            ?? c.price;
          c.change        = q.change            ?? null;
          c.changePercent = q.changesPercentage ?? null;
          c.high52w       = q.yearHigh          ?? null;
          c.low52w        = q.yearLow           ?? null;
          c.avgVolume     = q.avgVolume         ?? null;
          c.peRatio       = q.pe                ?? null;
          c.eps           = q.eps               ?? null;
        }

        // Polygon enrichment — best-effort, never blocks the response
        try {
          const prevClose = await polygon.fetchPreviousClose(ticker);
          if (prevClose?.resultsCount > 0) {
            const p = prevClose.results[0];
            c.prevClose = p.c ?? null;
            c.openPrice = p.o ?? null;
            c.dayHigh   = p.h ?? null;
            c.dayLow    = p.l ?? null;
            c.volume    = p.v ?? null;
          }
        } catch { /* Polygon down — FMP data is sufficient */ }

        db.upsertCompany(c).catch((e) =>
          console.error('[DB] upsertCompany failed:', e.message)
        );
        await setCache(cacheKey, c, TTL.COMPANY);
        return c;

      } catch (apiErr) {
        // Propagate rate-limit and 404 immediately — no DB fallback for these
        if (apiErr.isRateLimit || apiErr.status === 404) throw apiErr;

        console.warn(`[getCompany] API error for ${ticker}, trying DB:`, apiErr.message);
        const dbRow = await db.getCompanyFromDB(ticker);
        if (dbRow) {
          await setCache(cacheKey, dbRow, TTL.COMPANY);
          return dbRow;
        }
        throw apiErr;
      }
    });

    return res.json({ source: 'api', data: company });

  } catch (err) {
    if (err.isRateLimit)  return sendRateLimit(res);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    console.error(`[getCompany] ${ticker}:`, err.message);
    const detail = process.env.NODE_ENV === 'development' ? err.message : undefined;
    return res.status(500).json({ error: 'Failed to fetch company data.', detail });
  }
}

// ── GET /api/company/:ticker/financials ────────────────────────────────────────

async function getFinancials(req, res) {
  const ticker   = req.params.ticker.toUpperCase();
  const cacheKey = `financials:${ticker}`;

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`[getFinancials] Cache hit: ${ticker}`);
      return res.json({ source: 'cache', data: cached });
    }

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
          ...result.income.map((r)   => ({ ...r, period: r.period   || 'FY' })),
          ...result.balance.map((r)  => ({ ...r, period: r.period   || 'FY' })),
          ...result.cashflow.map((r) => ({ ...r, period: r.period   || 'FY' })),
        ];
        db.upsertFinancials(ticker, allRows).catch((e) =>
          console.error('[DB] upsertFinancials failed:', e.message)
        );

        await setCache(cacheKey, result, TTL.FINANCIALS);
        return result;

      } catch (apiErr) {
        if (apiErr.isRateLimit) throw apiErr;
        console.warn(`[getFinancials] API error for ${ticker}, trying DB:`, apiErr.message);
        const rows = await db.getFinancialsFromDB(ticker);
        if (rows.length) {
          await setCache(cacheKey, rows, TTL.FINANCIALS);
          return rows;
        }
        throw apiErr;
      }
    });

    return res.json({ source: 'api', data });

  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error(`[getFinancials] ${ticker}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch financial statements.' });
  }
}

// ── GET /api/company/:ticker/chart ─────────────────────────────────────────────

async function getChart(req, res) {
  const ticker   = req.params.ticker.toUpperCase();
  const years    = Math.min(parseInt(req.query.years) || 5, 10);
  const cacheKey = `chart:${ticker}:${years}y`;

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`[getChart] Cache hit: ${ticker} ${years}Y`);
      return res.json({ source: 'cache', data: cached });
    }

    const data = await withDedup(cacheKey, async () => {
      try {
        const raw  = await fmp.fetchHistoricalPrices(ticker, years);
        const result = normalizeHistoricalPrices(raw);

        db.upsertPrices(ticker, result).catch((e) =>
          console.error('[DB] upsertPrices failed:', e.message)
        );
        await setCache(cacheKey, result, TTL.CHART);
        return result;

      } catch (apiErr) {
        if (apiErr.isRateLimit) throw apiErr;
        console.warn(`[getChart] API error for ${ticker}, trying DB:`, apiErr.message);
        const rows = await db.getPricesFromDB(ticker, years);
        if (rows.length) {
          await setCache(cacheKey, rows, TTL.CHART);
          return rows;
        }
        throw apiErr;
      }
    });

    return res.json({ source: 'api', data });

  } catch (err) {
    if (err.isRateLimit) return sendRateLimit(res);
    console.error(`[getChart] ${ticker}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch price history.' });
  }
}

// ── POST /api/company/:ticker/dcf ──────────────────────────────────────────────

async function runDCF(req, res) {
  const ticker       = req.params.ticker.toUpperCase();
  const rawBody      = req.body;
  const growthRate   = parseFloat(rawBody.growthRate)     || 0.1;
  const discountRate = parseFloat(rawBody.discountRate)   || 0.1;
  const termGrowth   = parseFloat(rawBody.terminalGrowth) || 0.03;
  const forecastYrs  = Math.min(Math.max(1, parseInt(rawBody.forecastYears) || 10), 50);

  try {
    // Reuse cached financials if available — avoids extra FMP calls
    const cacheKey = `financials:${ticker}`;
    let financials  = await getCache(cacheKey);

    if (!financials) {
      try {
        const [cashflowRaw, balanceRaw, incomeRaw] = await Promise.all([
          fmp.fetchCashFlow(ticker, 1),
          fmp.fetchBalanceSheet(ticker, 1),
          fmp.fetchIncomeStatement(ticker, 1),
        ]);
        financials = {
          cashflow: normalizeCashFlow(cashflowRaw),
          balance:  normalizeBalanceSheet(balanceRaw),
          income:   normalizeIncomeStatement(incomeRaw),
        };
        await setCache(cacheKey, financials, TTL.FINANCIALS);
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
      growthRate:       growthRate,
      discountRate:     discountRate,
      terminalGrowth:   termGrowth,
      forecastYears:    forecastYrs,
      netDebt:          latestBS?.netDebt || 0,
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
  const ticker   = req.params.ticker.toUpperCase();
  const limit    = Math.min(parseInt(req.query.limit) || 10, 20);
  const cacheKey = `news:${ticker}`;

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`[getNews] Cache hit: ${ticker}`);
      return res.json({ source: 'cache', data: cached });
    }

    const raw = await fmp.fetchNews(ticker, limit);
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

    // Cache news for 30 minutes — it updates frequently
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
  const query = req.query.q;
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

module.exports = { getCompany, getFinancials, getChart, runDCF, searchCompanies, getNews };
