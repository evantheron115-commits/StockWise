import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { searchStocks } from '../lib/api';

const POPULAR = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'JPM'];

export default function Home() {
  const [query, setQuery] = useState('');
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
    <div className="max-w-2xl mx-auto px-4 py-20">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-semibold text-white mb-3">
          Equity Analysis,{' '}
          <span className="text-brand-500">Simplified</span>
        </h1>
        <p className="text-gray-400 text-lg">
          Search any stock. View financials. Run a DCF valuation in seconds.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            autoFocus
            className="input-base text-lg h-14"
            placeholder="Search ticker or company name..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) go(query.trim().toUpperCase());
            }}
          />
          <button
            className="btn-primary h-14 px-7 text-base whitespace-nowrap"
            onClick={() => query.trim() && go(query.trim().toUpperCase())}
          >
            Analyse →
          </button>
        </div>

        {/* Dropdown results */}
        {(results.length > 0 || loading) && (
          <div className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl z-20">
            {loading && (
              <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
            )}
            {results.map((r) => (
              <button
                key={r.ticker}
                onClick={() => go(r.ticker)}
                className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors flex items-center justify-between border-b border-gray-800 last:border-0"
              >
                <div>
                  <span className="font-mono font-medium text-brand-400">{r.ticker}</span>
                  <span className="ml-3 text-gray-300 text-sm">{r.name}</span>
                </div>
                <span className="text-xs text-gray-600">{r.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popular */}
      <div className="mt-8">
        <p className="text-xs text-gray-600 mb-3 uppercase tracking-wider">Popular stocks</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map((t) => (
            <button
              key={t}
              onClick={() => go(t)}
              className="font-mono text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 transition-colors text-gray-300 hover:text-white"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
