import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { searchStocks } from '../lib/api';
import { TOP_TICKERS } from '../constants/tickers';

const SECTOR_LEADERS = [
  { ticker: 'AAPL',  name: 'Apple',       sector: 'Tech' },
  { ticker: 'MSFT',  name: 'Microsoft',   sector: 'Tech' },
  { ticker: 'NVDA',  name: 'NVIDIA',      sector: 'AI' },
  { ticker: 'AMZN',  name: 'Amazon',      sector: 'Commerce' },
  { ticker: 'JPM',   name: 'JPMorgan',    sector: 'Finance' },
  { ticker: 'LLY',   name: 'Eli Lilly',   sector: 'Pharma' },
  { ticker: 'XOM',   name: 'ExxonMobil',  sector: 'Energy' },
  { ticker: 'TSLA',  name: 'Tesla',       sector: 'EV' },
];

function getRecent() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('valubull_recent') || '[]'); }
  catch { return []; }
}

export function saveRecent(company) {
  if (typeof window === 'undefined' || !company?.ticker) return;
  try {
    const prev    = JSON.parse(localStorage.getItem('valubull_recent') || '[]');
    const updated = [
      { ticker: company.ticker, name: company.name, price: company.price, changePercent: company.changePercent },
      ...prev.filter(r => r.ticker !== company.ticker),
    ].slice(0, 5);
    localStorage.setItem('valubull_recent', JSON.stringify(updated));
  } catch {}
}

function exchangeColor(exchange) {
  const e = (exchange || '').toUpperCase();
  if (e.includes('NASDAQ')) return 'text-blue-400';
  if (e.includes('NYSE'))   return 'text-emerald-400';
  if (e.includes('OTC'))    return 'text-amber-400';
  return 'text-gray-500';
}

export default function CommandPalette() {
  const router      = useRouter();
  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  const [open,     setOpen]    = useState(false);
  const [query,    setQuery]   = useState('');
  const [results,  setResults] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [recent,   setRecent]  = useState([]);

  // Mount flag — createPortal requires a DOM node (not available during SSR)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Instant local filter — 0ms, no network
  const localResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toUpperCase();
    return TOP_TICKERS.filter(t =>
      t.ticker.startsWith(q) || t.name.toUpperCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  // Load recent on open
  useEffect(() => {
    if (open) setRecent(getRecent());
  }, [open]);

  // API search — only fires when local results are thin (< 4 matches)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || localResults.length >= 4) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try { setResults(await searchStocks(query)); }
      catch { setResults([]); }
      finally { setFetching(false); }
    }, 320);
    return () => clearTimeout(debounceRef.current);
  }, [query, localResults.length]);

  // ⌘K / Ctrl+K — open from anywhere
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openPalette();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Scale page down to create depth effect while palette is open
  useEffect(() => {
    document.body.classList.toggle('palette-open', open);
    return () => document.body.classList.remove('palette-open');
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function openPalette() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function close() {
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  const go = useCallback((ticker) => {
    close();
    router.push(`/stock/${ticker}`);
  }, [router]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && query.trim()) go(query.trim().toUpperCase());
  };

  return (
    <>
      {/* Trigger: search bar on the home page */}
      <div
        className="flex items-center gap-3 input-base cursor-text h-12 text-gray-600"
        onClick={openPalette}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && openPalette()}
        aria-label="Open search"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="flex-shrink-0">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span className="text-sm">Ticker or company name...</span>
        <span className="ml-auto text-[10px] font-mono bg-surface-700/80 border border-white/[0.08] rounded px-1.5 py-0.5 text-gray-600 hidden sm:inline">
          ⌘K
        </span>
      </div>

      {mounted && open && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            onClick={close}
            aria-hidden
          />

          {/* Panel */}
          <div
            className="fixed left-1/2 z-50 w-full max-w-lg px-4"
            style={{ top: '12vh', transform: 'translateX(-50%)' }}
          >
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background:         'rgba(11, 13, 21, 0.92)',
                backdropFilter:     'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border:             '1px solid rgba(255,255,255,0.10)',
                boxShadow:          '0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
                transform:          'translateZ(0)',
              }}
            >
              {/* Light leak orb */}
              <div
                aria-hidden
                style={{
                  position:     'absolute',
                  top:          -40,
                  right:        -40,
                  width:        180,
                  height:       180,
                  borderRadius: '50%',
                  background:   'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
                  animation:    'light-leak 5s ease-in-out infinite',
                  pointerEvents:'none',
                }}
              />

              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
                {fetching ? (
                  <svg className="text-brand-400 animate-spin flex-shrink-0" width="16" height="16"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/>
                  </svg>
                ) : (
                  <svg className="text-gray-600 flex-shrink-0" width="16" height="16"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                )}
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ticker or company..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-gray-600 hover:text-gray-400 text-xs">
                    ✕
                  </button>
                )}
              </div>

              <div className="max-h-[60vh] overflow-y-auto">

                {/* Search results — local list first, API fallback */}
                {(localResults.length > 0 || results.length > 0) && (
                  <div className="py-2">
                    {(localResults.length > 0 ? localResults : results).map(r => (
                      <button
                        key={r.ticker}
                        onClick={() => go(r.ticker)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono font-semibold text-brand-400 text-sm w-16 shrink-0">
                            {r.ticker}
                          </span>
                          <span className="text-gray-300 text-sm truncate">{r.name}</span>
                        </div>
                        {r.exchange && (
                          <span className={`text-xs shrink-0 ml-2 font-medium ${exchangeColor(r.exchange)}`}>
                            {r.exchange}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {query && !fetching && localResults.length === 0 && results.length === 0 && (
                  <p className="px-4 py-4 text-sm text-gray-600">
                    No results for "{query}"
                  </p>
                )}

                {/* Default view — shown when no query */}
                {!query && (
                  <>
                    {/* Recently analyzed */}
                    {recent.length > 0 && (
                      <div className="px-4 pt-4 pb-2">
                        <p className="text-[10px] font-medium text-gray-600 uppercase tracking-widest mb-2">
                          Recently Analyzed
                        </p>
                        <div className="space-y-1">
                          {recent.map(r => (
                            <button
                              key={r.ticker}
                              onClick={() => go(r.ticker)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-mono text-sm font-semibold text-brand-400 w-14 shrink-0">
                                  {r.ticker}
                                </span>
                                <span className="text-gray-400 text-xs truncate">{r.name}</span>
                              </div>
                              {r.price != null && (
                                <div className="text-right flex-shrink-0 ml-2">
                                  <span className="text-xs font-mono text-gray-400">${r.price?.toFixed(2)}</span>
                                  {r.changePercent != null && (
                                    <span className={`text-[10px] font-mono ml-1.5 ${r.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {r.changePercent >= 0 ? '+' : ''}{r.changePercent?.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Separator */}
                    {recent.length > 0 && (
                      <div className="mx-4 my-2 border-t border-white/[0.06]" />
                    )}

                    {/* Sector leaders */}
                    <div className="px-4 pt-2 pb-4">
                      <p className="text-[10px] font-medium text-gray-600 uppercase tracking-widest mb-3">
                        Sector Leaders
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SECTOR_LEADERS.map(s => (
                          <button
                            key={s.ticker}
                            onClick={() => go(s.ticker)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors text-left border border-white/[0.05] hover:border-white/[0.10]"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold text-brand-400 leading-tight">{s.ticker}</p>
                              <p className="text-[10px] text-gray-600 leading-tight">{s.sector}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.05]">
                <span className="text-[10px] text-gray-700 font-mono">↵ go</span>
                <span className="text-[10px] text-gray-700 font-mono">esc close</span>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
