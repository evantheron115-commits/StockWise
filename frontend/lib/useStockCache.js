import { useState, useEffect, useRef } from 'react';
import { getCompany } from './api';

const TTL_MS  = 15 * 60 * 1000; // 15 min — short enough for live prices, long enough to feel instant
const KEY     = (t) => `vb:co:${t.toUpperCase()}`;

function cacheRead(ticker) {
  try {
    const raw = localStorage.getItem(KEY(ticker));
    if (!raw) return null;
    const { ts, payload } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) { localStorage.removeItem(KEY(ticker)); return null; }
    return payload;
  } catch { return null; }
}

function cacheWrite(ticker, payload) {
  try {
    localStorage.setItem(KEY(ticker), JSON.stringify({ ts: Date.now(), payload }));
  } catch {}
}

// Stale-While-Revalidate hook for company data.
//
// On first call for a ticker:   loading=true until data arrives, then cached.
// On subsequent calls (cache hit): data appears instantly, loading=false.
//   A silent background fetch runs and updates data when it resolves.
//   fromCache=true during the brief window between cache hit and fresh response.
//
// Usage in stock/[ticker].js (replaces the manual handleLoad pattern for returning users):
//   const { data: company, fromCache, loading, error } = useStockCache(ticker);

export function useStockCache(ticker) {
  const cached = ticker ? cacheRead(ticker) : null;

  const [data,      setData]      = useState(cached);
  const [fromCache, setFromCache] = useState(!!cached);
  const [loading,   setLoading]   = useState(!cached);   // skip spinner when we have cache
  const [error,     setError]     = useState(null);

  const fetchedFor = useRef(null);

  useEffect(() => {
    if (!ticker) return;

    // Always run a fresh fetch, even if we have cache.
    // If fetchedFor matches, a request is already in flight for this ticker.
    if (fetchedFor.current === ticker) return;
    fetchedFor.current = ticker;

    const hit = cacheRead(ticker);
    if (hit) {
      setData(hit);
      setFromCache(true);
      setLoading(false);
      setError(null);
    } else {
      setData(null);
      setFromCache(false);
      setLoading(true);
      setError(null);
    }

    getCompany(ticker)
      .then(({ payload }) => {
        setData(payload);
        setFromCache(false);
        setLoading(false);
        setError(null);
        cacheWrite(ticker, payload);
      })
      .catch((err) => {
        setLoading(false);
        if (!hit) setError(err); // only surface error if we have nothing to show
        // If cache hit exists, silently stay on stale data
      });
  }, [ticker]);

  return { data, fromCache, loading, error };
}
