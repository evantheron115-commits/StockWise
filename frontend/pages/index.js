import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { searchStocks } from '../lib/api';

const POPULAR = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'JPM'];

export default function Home() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef(null);

  const handleSearch = useCallback((value) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchStocks(value)); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  }, []);

  const go = (ticker) => router.push(`/stock/${ticker}`);

  return (
    <div className="max-w-2xl mx-auto px-4 py-24">

      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs text-brand-400 font-medium">Professional equity analysis</span>
        </div>
        <h1 className="text-5xl font-semibold text-white mb-4 tracking-tight leading-tight">
          Equity Analysis,{' '}
          <span className="text-brand-400">Simplified</span>
        </h1>
        <p className="text-gray-500 text-lg">
          Search any stock. View financials. Run a DCF valuation in seconds.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              autoFocus
              className="input-base pl-10 text-base h-12"
              placeholder="Ticker or company name..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) go(query.trim().toUpperCase());
              }}
            />
          </div>
          <button
            className="btn-primary h-12 px-6 text-sm font-semibold whitespace-nowrap"
            onClick={() => query.trim() && go(query.trim().toUpperCase())}
          >
            Analyse →
          </button>
        </div>

        {/* Dropdown */}
        {(results.length > 0 || loading) && (
          <div className="absolute top-full mt-2 w-full bg-surface-900 border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl z-20">
            {loading && (
              <div className="px-4 py-3 text-sm text-gray-600">Searching...</div>
            )}
            {results.map((r) => (
              <button
                key={r.ticker}
                onClick={() => go(r.ticker)}
                className="w-full text-left px-4 py-3 hover:bg-surface-800 transition-colors flex items-center justify-between border-b border-white/[0.05] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-brand-400 text-sm w-16 shrink-0">
                    {r.ticker}
                  </span>
                  <span className="text-gray-300 text-sm truncate">{r.name}</span>
                </div>
                <span className="text-xs text-gray-600 shrink-0 ml-2">{r.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popular */}
      <div className="mt-10">
        <p className="text-xs text-gray-700 mb-3 uppercase tracking-widest font-medium">
          Popular stocks
        </p>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map((t) => (
            <button
              key={t}
              onClick={() => go(t)}
              className="font-mono text-xs bg-surface-800 hover:bg-surface-700 border border-white/[0.08] hover:border-white/15 rounded-lg px-4 py-2 transition-all text-gray-400 hover:text-white"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
