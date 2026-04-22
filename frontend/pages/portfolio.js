import Head        from 'next/head';
import Link        from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useSession }                        from 'next-auth/react';
import { useRouter }                         from 'next/router';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Portfolio() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [watchlist, setWatchlist] = useState([]);   // [{ ticker, name, added_at }]
  const [prices,    setPrices]    = useState({});   // { [ticker]: { price, changePercent } }
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r    = await fetch('/api/watchlist');
      if (!r.ok) throw new Error('Failed to load watchlist.');
      const data = await r.json();
      setWatchlist(data.watchlist || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/login');
  }, [status, router]);

  // Load watchlist once authenticated
  useEffect(() => {
    if (status === 'authenticated') loadWatchlist();
  }, [status, loadWatchlist]);

  // Fetch live prices for each ticker in parallel (fire-and-forget per ticker)
  useEffect(() => {
    if (!watchlist.length) return;
    watchlist.forEach(({ ticker }) => {
      fetch(`${API}/api/company/${ticker}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data) return;
          const c = data.data || data.payload;
          if (!c) return;
          setPrices((prev) => ({
            ...prev,
            [ticker]: { price: c.price, changePercent: c.changePercent },
          }));
        })
        .catch(() => {});
    });
  }, [watchlist]);

  async function remove(ticker) {
    try {
      const r = await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' });
      if (r.ok) {
        setWatchlist((prev) => prev.filter((w) => w.ticker !== ticker));
        setPrices((prev) => { const n = { ...prev }; delete n[ticker]; return n; });
      }
    } catch (e) {
      console.error('[Portfolio] remove failed', e);
    }
  }

  if (status === 'loading' || (status === 'unauthenticated')) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Watchlist — ValuBull</title>
        <meta name="description" content="Your saved stocks watchlist." />
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">My Watchlist</h1>
            <p className="text-xs text-gray-600 mt-0.5">
              {watchlist.length} saved {watchlist.length === 1 ? 'stock' : 'stocks'}
            </p>
          </div>
          <Link href="/" className="btn-primary text-xs">
            + Add Stocks
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="card text-center py-8">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={loadWatchlist} className="btn-primary text-xs">Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="card divide-y divide-white/[0.06]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-700" />
                  <div>
                    <div className="h-3.5 w-24 bg-surface-700 rounded mb-1.5" />
                    <div className="h-2.5 w-16 bg-surface-800 rounded" />
                  </div>
                </div>
                <div className="h-3.5 w-16 bg-surface-700 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && watchlist.length === 0 && (
          <div className="card text-center py-14">
            <div className="w-12 h-12 rounded-full bg-surface-800 border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm mb-1">Your watchlist is empty</p>
            <p className="text-gray-600 text-xs mb-5">Search for a stock and click "Add to Watchlist" to save it here.</p>
            <Link href="/" className="btn-primary text-xs">
              Search Stocks
            </Link>
          </div>
        )}

        {/* Watchlist table */}
        {!loading && !error && watchlist.length > 0 && (
          <div className="card overflow-hidden p-0">
            <div className="divide-y divide-white/[0.06]">
              {watchlist.map(({ ticker, name, added_at }) => {
                const px = prices[ticker];
                const up = px?.changePercent > 0;
                const dn = px?.changePercent < 0;
                return (
                  <div key={ticker} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">

                    {/* Logo + name */}
                    <TickerLogo ticker={ticker} name={name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm font-semibold text-white">{ticker}</span>
                        {name && (
                          <span className="text-xs text-gray-500 truncate hidden sm:block">{name}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-700">
                        Added {fmtDate(added_at)}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right w-24 shrink-0">
                      {px ? (
                        <>
                          <p className="font-mono text-sm text-white">
                            ${px.price?.toFixed(2) ?? '—'}
                          </p>
                          {px.changePercent != null && (
                            <p className={`text-xs font-mono ${up ? 'up' : dn ? 'down' : 'neutral'}`}>
                              {up ? '+' : ''}{px.changePercent?.toFixed(2)}%
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="space-y-1">
                          <div className="h-3 w-16 bg-surface-700 rounded animate-pulse ml-auto" />
                          <div className="h-2.5 w-10 bg-surface-800 rounded animate-pulse ml-auto" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/stock/${ticker}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-400 hover:bg-brand-600/30 transition-colors"
                      >
                        View →
                      </Link>
                      <button
                        onClick={() => remove(ticker)}
                        title="Remove from watchlist"
                        className="text-xs px-2 py-1.5 rounded-lg bg-surface-800 border border-white/[0.06] text-gray-600 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TickerLogo({ ticker, name }) {
  const [failed, setFailed] = useState(false);
  const initials = name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || ticker?.slice(0, 2);

  if (failed) {
    return (
      <div className="w-9 h-9 rounded-lg bg-surface-700 border border-white/10 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-gray-400 font-mono">{initials}</span>
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
      <img
        src={`https://financialmodelingprep.com/image-stock/${ticker}.png`}
        alt=""
        className="w-7 h-7 object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
