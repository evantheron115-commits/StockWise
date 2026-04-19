import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { searchStocks } from '../lib/api';

const MARKETS = [
  {
    label: 'US Large Cap',
    flag: '🇺🇸',
    tickers: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM'],
  },
  {
    label: 'Technology',
    flag: '💻',
    tickers: ['AMD', 'INTC', 'AVGO', 'QCOM', 'CRM', 'ORCL', 'ADBE', 'NFLX'],
  },
  {
    label: 'European',
    flag: '🇪🇺',
    tickers: ['ASML', 'NVO', 'AZN', 'SHEL', 'SAP', 'UL', 'HSBC', 'BP'],
  },
  {
    label: 'Asia-Pacific',
    flag: '🌏',
    tickers: ['TSM', 'BABA', 'BIDU', 'SONY', 'TM', 'JD', 'NIO', 'TCEHY'],
  },
];

// Exchange badge color
function exchangeColor(exchange) {
  if (!exchange) return 'text-gray-600';
  const e = exchange.toUpperCase();
  if (e.includes('NASDAQ')) return 'text-blue-400';
  if (e.includes('NYSE'))   return 'text-emerald-400';
  if (e.includes('OTC'))    return 'text-amber-400';
  return 'text-gray-500';
}

export default function Home() {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [activeMarket, setActiveMarket] = useState(0);
  const router      = useRouter();
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

  const go = (ticker) => {
    setResults([]);
    setQuery('');
    router.push(`/stock/${ticker}`);
  };

  const showDropdown = results.length > 0 || loading;

  return (
    <div className="max-w-2xl mx-auto px-4 py-20">

      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs text-brand-400 font-medium">Global equity analysis</span>
        </div>
        <h1 className="text-5xl font-semibold text-white mb-4 tracking-tight leading-tight">
          Equity Analysis,{' '}
          <span className="text-brand-400">Simplified</span>
        </h1>
        <p className="text-gray-500 text-lg">
          Search any stock — US, European, or Asia-Pacific.{' '}
          Financials, DCF, and key ratios in seconds.
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
                if (e.key === 'Escape') { setResults([]); setQuery(''); }
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
        {showDropdown && (
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
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-semibold text-brand-400 text-sm w-16 shrink-0">
                    {r.ticker}
                  </span>
                  <span className="text-gray-300 text-sm truncate">{r.name}</span>
                </div>
                <span className={`text-xs shrink-0 ml-2 font-medium ${exchangeColor(r.exchange)}`}>
                  {r.exchange}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Browse Markets */}
      <div className="mt-12">
        <p className="text-xs text-gray-700 mb-4 uppercase tracking-widest font-medium">
          Browse Markets
        </p>

        {/* Market tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {MARKETS.map((m, i) => (
            <button
              key={m.label}
              onClick={() => setActiveMarket(i)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                activeMarket === i
                  ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                  : 'bg-surface-800 border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/15'
              }`}
            >
              <span>{m.flag}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Ticker chips */}
        <div className="flex flex-wrap gap-2">
          {MARKETS[activeMarket].tickers.map((t) => (
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

      {/* Coverage note */}
      <p className="text-center text-xs text-gray-700 mt-10">
        Covers NYSE · NASDAQ · AMEX · European ADRs · Asian ADRs · OTC markets
      </p>

    </div>
  );
}
