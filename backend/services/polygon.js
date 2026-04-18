const axios = require('axios');

const BASE_URL = 'https://api.polygon.io';
const API_KEY = process.env.POLYGON_API_KEY;

async function fetchWithRetry(url, retries = 1) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Polygon] GET ${url}`);
      const response = await axios.get(url, {
        timeout: 4000,
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      return response.data;
    } catch (err) {
      const isLast = attempt === retries;
      if (isLast) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

// Most recent trade price for a ticker
async function fetchLastTrade(ticker) {
  const url = `${BASE_URL}/v2/last/trade/${ticker}`;
  return fetchWithRetry(url);
}

// Previous day's open/high/low/close/volume
async function fetchPreviousClose(ticker) {
  const url = `${BASE_URL}/v2/aggs/ticker/${ticker}/prev?adjusted=true`;
  return fetchWithRetry(url);
}

// Ticker details (name, exchange, market cap, etc.)
async function fetchTickerDetails(ticker) {
  const url = `${BASE_URL}/v3/reference/tickers/${ticker}`;
  return fetchWithRetry(url);
}

// Search tickers by name or symbol
async function searchTickers(query) {
  const url = `${BASE_URL}/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=10`;
  return fetchWithRetry(url);
}

module.exports = { fetchLastTrade, fetchPreviousClose, fetchTickerDetails, searchTickers };
