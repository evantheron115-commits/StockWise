import axios from 'axios';

// NEXT_PUBLIC_API_URL is replaced with the literal string at compile time by Next.js SWC.
// In the mobile bundle this is the Railway URL. The dev fallback is dead code in production.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30s — accounts for Railway cold-start wakeup on first request
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Tag rate-limit responses so callers can show the right message
    if (error.response?.status === 429) {
      error.isRateLimit = true;
      error.message =
        error.response.data?.error ||
        'API rate limit reached. Please wait a few minutes and try again.';
    }
    // Tag network/timeout failures (no response at all) for ConnectionGate
    if (!error.response) {
      error.isNetworkError = true;
    }
    return Promise.reject(error);
  }
);

export async function searchStocks(query) {
  const { data } = await api.get(`/api/company/search?q=${encodeURIComponent(query)}`);
  return data.data || [];
}

export async function getCompany(ticker) {
  const { data } = await api.get(`/api/company/${ticker}`);
  return { payload: data.data, source: data.source };
}

export async function getFullSpectrum(ticker) {
  const { data } = await api.get(`/api/company/${ticker}/full-spectrum`);
  return { payload: data.data, source: data.source };
}

export async function getFinancials(ticker) {
  const { data } = await api.get(`/api/company/${ticker}/financials`);
  return { payload: data.data, source: data.source };
}

export async function getChart(ticker, years = 5) {
  const { data } = await api.get(`/api/company/${ticker}/chart?years=${years}`);
  return { payload: data.data, source: data.source };
}

export async function runDCF(ticker, params) {
  const { data } = await api.post(`/api/company/${ticker}/dcf`, params);
  // Return the full response so callers can access projectionMethod + dcfDefaults
  return data;
}

export async function getNews(ticker) {
  const { data } = await api.get(`/api/company/${ticker}/news`);
  return { payload: data.data, source: data.source };
}

// Lightweight reachability probe used by ConnectionGate
export async function pingHealth() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(id);
  }
}
