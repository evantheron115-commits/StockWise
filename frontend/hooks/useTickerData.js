import { useState, useEffect, useRef, useCallback } from 'react';
import { getCompany, getFinancials } from '../lib/api';
import { saveRecent } from '../components/CommandPalette';

const SNAP_TTL         = 60 * 60 * 1000; // 60 min — matches backend quote cache
const RETRY_DELAY      = 6000;           // 6s between retries while backend wakes
const MAX_RETRIES      = 8;             // 48s max wait
const FIN_RETRY_DELAY  = 8000;          // slightly longer delay for financials retries
const FIN_MAX_RETRIES  = 5;            // 40s max wait for financials

function snapKey(t) { return `valubull_snap_${t}`; }

function readSnap(t) {
  try {
    const raw = localStorage.getItem(snapKey(t));
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (Date.now() - snap.ts > SNAP_TTL) return null;
    return snap;
  } catch { return null; }
}

function writeSnap(t, company, financials) {
  try {
    localStorage.setItem(snapKey(t), JSON.stringify({ company, financials, ts: Date.now() }));
  } catch {} // storage quota exceeded — silently skip
}

// Stale-while-revalidate data hook.
// On repeat visits: returns snapshot data instantly (isStale=true) while
// background-fetching fresh data. On first visit: normal loading flow.
export function useTickerData(ticker) {
  const [company,           setCompany]           = useState(null);
  const [financials,        setFinancials]         = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [error,             setError]             = useState(null);
  const [rateLimited,       setRateLimited]       = useState(false);
  const [isWaking,          setIsWaking]          = useState(false);
  const [dataSource,        setDataSource]        = useState(null);
  const [isStale,           setIsStale]           = useState(false);

  const loadId        = useRef(0);
  const retryRef      = useRef(null);
  const retryCount    = useRef(0);
  const finRetryRef   = useRef(null);
  const finRetryCount = useRef(0);

  useEffect(() => {
    if (!ticker) return;

    clearTimeout(retryRef.current);
    clearTimeout(finRetryRef.current);
    loadId.current += 1;
    retryCount.current    = 0;
    finRetryCount.current = 0;
    const id = loadId.current;
    const t  = ticker.toUpperCase();

    setError(null);
    setRateLimited(false);
    setIsWaking(false);

    const snap = readSnap(t);

    if (snap) {
      // Snapshot hit — render immediately, refresh silently in background
      setCompany(snap.company);
      setFinancials(snap.financials);
      setDataSource('snap');
      setIsStale(true);
      setLoading(false);
      setFinancialsLoading(false);

      Promise.allSettled([getCompany(t), getFinancials(t)]).then(([cr, fr]) => {
        if (loadId.current !== id) return;
        const c = cr.status === 'fulfilled' ? cr.value.payload : snap.company;
        const f = fr.status === 'fulfilled' ? fr.value.payload : snap.financials;
        setCompany(c);
        setFinancials(f);
        setDataSource(cr.status === 'fulfilled' ? cr.value.source : 'snap');
        setIsStale(false);
        if (cr.status === 'fulfilled') saveRecent(c);
        writeSnap(t, c, f);
      });

    } else {
      // Cold load
      setCompany(null);
      setFinancials(null);
      setIsStale(false);
      setLoading(true);
      setFinancialsLoading(true);

      // Capture refs so the faster-arriving result can save the snapshot
      // once both are available (whichever arrives second does the write)
      let freshCompany    = null;
      let freshFinancials = null;

      function attemptFetch() {
        getCompany(t)
          .then(({ payload, source }) => {
            if (loadId.current !== id) return;
            clearTimeout(retryRef.current);
            freshCompany = payload;
            setCompany(payload);
            setDataSource(source);
            setIsWaking(false);
            setError(null);
            saveRecent(payload);
            if (freshFinancials) writeSnap(t, payload, freshFinancials);
            setLoading(false);
          })
          .catch((err) => {
            if (loadId.current !== id) return;

            const status   = err.response?.status;
            const isNotFound   = status === 404;
            const isRateLimit  = err.isRateLimit || status === 429;
            // Anything that isn't a definitive "ticker not found" should be retried:
            // network timeouts, Railway cold-start 500s, ECONNABORTED, ERR_CANCELED, etc.
            const isRetryable  = !isNotFound && !isRateLimit;

            if (isRateLimit) {
              setRateLimited(true);
              setError(err.message || 'API rate limit reached. Please wait a few minutes and try again.');
              setLoading(false);
            } else if (isNotFound) {
              setIsWaking(false);
              setError(`"${t}" was not found. Double-check the ticker symbol.`);
              setLoading(false);
            } else if (isRetryable && retryCount.current < MAX_RETRIES) {
              retryCount.current += 1;
              setIsWaking(true);
              retryRef.current = setTimeout(attemptFetch, RETRY_DELAY);
            } else {
              setIsWaking(false);
              setError(`Could not load "${t}". Please try again.`);
              setLoading(false);
            }
          });
      }

      attemptFetch();

      function attemptFinancials() {
        getFinancials(t)
          .then(({ payload }) => {
            if (loadId.current !== id) return;
            freshFinancials = payload;
            setFinancials(payload);
            if (freshCompany) writeSnap(t, freshCompany, payload);
          })
          .catch((err) => {
            if (loadId.current !== id) return;
            const status = err.response?.status;
            const isNotFound  = status === 404;
            const isRateLimit = err.isRateLimit || status === 429;
            if (!isNotFound && !isRateLimit && finRetryCount.current < FIN_MAX_RETRIES) {
              finRetryCount.current += 1;
              finRetryRef.current = setTimeout(attemptFinancials, FIN_RETRY_DELAY);
              return;
            }
            // Exhausted retries or definitive failure — leave financials null
          })
          .finally(() => {
            // Stop spinner only if we're not about to retry
            if (loadId.current === id && !finRetryRef.current) {
              setFinancialsLoading(false);
            }
          });
      }

      attemptFinancials();
    }

    return () => {
      clearTimeout(retryRef.current);
      clearTimeout(finRetryRef.current);
    };
  }, [ticker]);

  return { company, financials, loading, financialsLoading, error, rateLimited, isWaking, dataSource, isStale };
}
