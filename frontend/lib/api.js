import axios from 'axios';

// Single source of truth for the backend URL.
// In development: set NEXT_PUBLIC_API_URL in frontend/.env.local (defaults to localhost:4000).
// In production:  set NEXT_PUBLIC_API_URL in Vercel environment variables.
//                 next.config.js will abort the build if it is missing or localhost.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  (API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1'))
) {
  console.error(
    '[Stoxora] NEXT_PUBLIC_API_URL is pointing to localhost in production. ' +
    'All API calls will fail. Set it in Vercel → Settings → Environment Variables.'
  );
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Intercept 429 responses and tag them so callers can show the right message
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      error.isRateLimit = true;
      error.message =
        error.response.data?.error ||
        'FMP API rate limit reached. Please wait a few minutes and try again.';
    }
    return Promise.reject(error);
  }
);

// Returns { payload, source } so the UI can show "Using cached data"
// source is 'cache' | 'api' | 'db' as set by the backend

export async function searchStocks(query) {
  console.log('[API] searchStocks:', query);
  const { data } = await api.get(`/api/company/search?q=${encodeURIComponent(query)}`);
  return data.data || [];
}

export async function getCompany(ticker) {
  console.log('[API] getCompany:', ticker);
  const { data } = await api.get(`/api/company/${ticker}`);
  return { payload: data.data, source: data.source };
}

export async function getFinancials(ticker) {
  console.log('[API] getFinancials:', ticker);
  const { data } = await api.get(`/api/company/${ticker}/financials`);
  return { payload: data.data, source: data.source };
}

export async function getChart(ticker, years = 5) {
  console.log('[API] getChart:', ticker, years + 'Y');
  const { data } = await api.get(`/api/company/${ticker}/chart?years=${years}`);
  return { payload: data.data, source: data.source };
}

export async function runDCF(ticker, params) {
  console.log('[API] runDCF:', ticker, params);
  const { data } = await api.post(`/api/company/${ticker}/dcf`, params);
  return data.data;
}
