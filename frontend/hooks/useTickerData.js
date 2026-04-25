import { useState, useEffect, useRef } from 'react';
import { getCompany, getFinancials } from '../lib/api';
import { saveRecent } from '../components/CommandPalette';

const SNAP_TTL = 60 * 60 * 1000; // 60 min — matches backend quote cache

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
  const [dataSource,        setDataSource]        = useState(null);
  const [isStale,           setIsStale]           = useState(false);

  const loadId = useRef(0);

  useEffect(() => {
    if (!ticker) return;

    loadId.current += 1;
    const id = loadId.current;
    const t  = ticker.toUpperCase();

    setError(null);
    setRateLimited(false);

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

      getCompany(t)
        .then(({ payload, source }) => {
          if (loadId.current !== id) return;
          freshCompany = payload;
          setCompany(payload);
          setDataSource(source);
          saveRecent(payload);
          if (freshFinancials) writeSnap(t, payload, freshFinancials);
        })
        .catch((err) => {
          if (loadId.current !== id) return;
          if (err.isRateLimit) {
            setRateLimited(true);
            setError(err.message || 'API rate limit reached. Please wait a few minutes and try again.');
          } else {
            setError(`Could not find data for "${t}". Check the ticker and try again.`);
          }
        })
        .finally(() => { if (loadId.current === id) setLoading(false); });

      getFinancials(t)
        .then(({ payload }) => {
          if (loadId.current !== id) return;
          freshFinancials = payload;
          setFinancials(payload);
          if (freshCompany) writeSnap(t, freshCompany, payload);
        })
        .catch(() => {})
        .finally(() => { if (loadId.current === id) setFinancialsLoading(false); });
    }
  }, [ticker]);

  return { company, financials, loading, financialsLoading, error, rateLimited, dataSource, isStale };
}
