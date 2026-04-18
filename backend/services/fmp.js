const axios = require('axios');

/**
 * Financial Modeling Prep — Stable API
 * Updated from deprecated v3 endpoints to the current stable API.
 * Base URL: https://financialmodelingprep.com/stable
 * Params: symbol={ticker} instead of path /{ticker}
 */

const BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;

// Patterns that indicate a free-tier rate limit has been hit
const RATE_LIMIT_PATTERNS = [
  'limit reach', 'rate limit', 'too many requests',
  'upgrade your plan', 'access denied', 'premium endpoint',
];

function makeRateLimitError(message) {
  const err = new Error(message || 'FMP API rate limit reached');
  err.isRateLimit = true;
  err.code = 'RATE_LIMITED';
  return err;
}

// Single attempt with fast timeout. Never retries rate-limit responses.
async function fetchWithRetry(url, retries = 1) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[FMP] GET ${url.replace(/apikey=[^&]+/, 'apikey=***')}`);
      const response = await axios.get(url, { timeout: 5000 });

      // FMP embeds errors in 200 responses
      if (response.data && response.data['Error Message']) {
        const msg = response.data['Error Message'];
        const lower = msg.toLowerCase();
        if (RATE_LIMIT_PATTERNS.some((p) => lower.includes(p))) {
          throw makeRateLimitError(msg);
        }
        throw new Error(msg);
      }

      return response.data;
    } catch (err) {
      // HTTP 429 — never retry
      if (err.response?.status === 429) throw makeRateLimitError();
      // Rate limit detected in body — never retry
      if (err.isRateLimit) throw err;

      const isLast = attempt === retries;
      if (isLast) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

// Company profile — name, sector, market cap, description, etc.
async function fetchCompanyProfile(ticker) {
  const url = `${BASE_URL}/profile?symbol=${ticker}&apikey=${API_KEY}`;
  return fetchWithRetry(url);
}

// Real-time quote — price, change, 52w high/low, PE, EPS, volume
async function fetchQuote(ticker) {
  const url = `${BASE_URL}/quote?symbol=${ticker}&apikey=${API_KEY}`;
  return fetchWithRetry(url);
}

// Annual income statements (revenue, gross profit, net income, etc.)
async function fetchIncomeStatement(ticker, limit = 5) {
  const url = `${BASE_URL}/income-statement?symbol=${ticker}&period=annual&limit=${limit}&apikey=${API_KEY}`;
  return fetchWithRetry(url);
}

// Annual balance sheets (assets, liabilities, debt, equity)
async function fetchBalanceSheet(ticker, limit = 5) {
  const url = `${BASE_URL}/balance-sheet-statement?symbol=${ticker}&period=annual&limit=${limit}&apikey=${API_KEY}`;
  return fetchWithRetry(url);
}

// Annual cash flow statements (operating CF, capex, free cash flow)
async function fetchCashFlow(ticker, limit = 5) {
  const url = `${BASE_URL}/cash-flow-statement?symbol=${ticker}&period=annual&limit=${limit}&apikey=${API_KEY}`;
  return fetchWithRetry(url);
}

// Daily OHLCV price history — returns { symbol, historical: [...] }
async function fetchHistoricalPrices(ticker, years = 5) {
  const from = new Date();
  from.setFullYear(from.getFullYear() - years);
  const fromStr = from.toISOString().split('T')[0];
  const url = `${BASE_URL}/historical-price-eod/full?symbol=${ticker}&from=${fromStr}&apikey=${API_KEY}`;
  return fetchWithRetry(url);
}

// Ticker search — returns array of { symbol, name, exchangeShortName }
async function searchTickers(query) {
  const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}&limit=10&apikey=${API_KEY}`;
  return fetchWithRetry(url);
}

module.exports = {
  fetchCompanyProfile,
  fetchQuote,
  fetchIncomeStatement,
  fetchBalanceSheet,
  fetchCashFlow,
  fetchHistoricalPrices,
  searchTickers,
};
