// Sovereign-Edge Gateway
// Wraps Railway API calls with a Vercel proxy fallback.
// If Railway fails with a network error (unreachable / cold-start timeout),
// the request is automatically rerouted to the Vercel edge proxy, which calls
// FMP directly from Vercel's servers. The UI sees the same data shape either way.
//
// 404 and 429 are real errors — they pass through without fallback.
// Only genuine network failures (ECONNABORTED, ERR_CANCELED, no response) trigger the switch.

import { api } from './api';

async function withProxyFallback(railwayFn, proxyFn) {
  try {
    return await railwayFn();
  } catch (err) {
    // Real errors — don't swallow them with a fallback
    if (err.response?.status === 404) throw err;
    if (err.isRateLimit || err.response?.status === 429) throw err;

    // Network failure or Railway unreachable — try Vercel proxy
    if (!err.response || err.isNetworkError) {
      console.warn('[Gateway] Railway unreachable — routing to Vercel proxy');
      return await proxyFn();
    }

    throw err;
  }
}

// Proxy version of getCompany — served from /api/proxy/[ticker] (Vercel serverless)
async function getCompanyViaProxy(ticker) {
  const { data } = await api.get(`/api/proxy/${ticker}`);
  return { payload: data.data, source: data.source };
}

// Gateway-aware version of getCompany.
// Drop-in replacement: same signature as the original in api.js.
export async function getCompanyWithFallback(ticker) {
  return withProxyFallback(
    async () => {
      const { data } = await api.get(`/api/company/${ticker}`);
      return { payload: data.data, source: data.source };
    },
    () => getCompanyViaProxy(ticker)
  );
}
