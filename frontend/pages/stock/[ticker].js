import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import Head from 'next/head';
import { useTickerData } from '../../hooks/useTickerData';
import { useRealTimePrice } from '../../hooks/useRealTimePrice';
import { hapticLight } from '../../lib/haptics';
import CompanyHeader     from '../../components/CompanyHeader';
import PriceChart        from '../../components/PriceChart';
import FinancialTable    from '../../components/FinancialTable';
import DCFTool           from '../../components/DCFTool';
import CompanySummary    from '../../components/CompanySummary';
import DataStreamOverlay from '../../components/DataStreamOverlay';
import KeyRatios         from '../../components/KeyRatios';
import CommunityChat     from '../../components/CommunityChat';
import NeuralAlpha       from '../../components/NeuralAlpha';

const TABS = [
  { id: 'price',      label: 'Price + Chart' },
  { id: 'summary',    label: 'Company Summary' },
  { id: 'financials', label: 'Financial Statements' },
  { id: 'ratios',     label: 'Key Ratios' },
  { id: 'dcf',        label: 'DCF Valuation' },
  { id: 'chat',       label: 'Community Chat' },
];

const VALID_TABS = new Set(TABS.map((t) => t.id));

export default function StockPage() {
  const router     = useRouter();
  const { ticker } = router.query;

  const { company, financials, loading, financialsLoading, error, rateLimited, isWaking, dataSource, isStale } =
    useTickerData(ticker);

  const { price: livePrice, changePercent: liveChangePercent, isLive } =
    useRealTimePrice(ticker);

  // Predictive pre-warm — fires once per ticker, kicks off background cache
  // warming for the 5 most likely "next click" peers before the user navigates
  useEffect(() => {
    if (!ticker) return;
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${API}/api/company/predictive-warm`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ticker: ticker.toUpperCase() }),
    }).catch(() => {});
  }, [ticker]);

  const [tab,       setTab]       = useState('price');
  const tabRefs     = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  // ── Restore active tab from URL hash on mount ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);
    if (VALID_TABS.has(hash)) setTab(hash);
  }, []);

  // ── Reset tab when ticker changes ─────────────────────────────────────────
  useEffect(() => {
    if (ticker) setTab('price');
  }, [ticker]);

  // ── Sync URL hash when tab changes ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.location.hash = tab;
  }, [tab]);

  // ── Measure active tab button for liquid indicator ─────────────────────────
  useEffect(() => {
    const el = tabRefs.current[tab];
    if (!el) return;
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
  }, [tab]);

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!ticker) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600 text-sm">
        Loading...
      </div>
    );
  }

  if (loading || isWaking) {
    return (
      <>
        <DataStreamOverlay />
        <div className="max-w-5xl mx-auto px-4 py-16 text-center relative" style={{ zIndex: 1 }}>
          <p className="text-gray-600 text-sm font-mono animate-pulse">
            {isWaking
              ? `Optimizing Data Stream for ${ticker?.toUpperCase()}…`
              : `Loading ${ticker?.toUpperCase()}...`}
          </p>
          {isWaking && (
            <p className="text-gray-700 text-xs font-mono mt-2">
              Establishing connection — retrying automatically
            </p>
          )}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        {rateLimited ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 max-w-sm mx-auto">
              The FMP free tier has a daily request limit. Wait a few minutes and try again.
            </p>
            <div className="flex gap-3 justify-center mt-2">
              <button onClick={() => window.location.reload()} className="btn-primary">
                Try Again
              </button>
              <Link href="/" className="btn-primary inline-block">← Back to Search</Link>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 justify-center">
            <Link href="/" className="btn-primary inline-block">← Back to Search</Link>
          </div>
        )}
      </div>
    );
  }

  if (!company) return null;

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>{company?.name || ticker} ({ticker?.toUpperCase()}) — ValuBull</title>
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb + badges */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Link href="/" className="hover:text-gray-400 transition-colors">Search</Link>
            <span>/</span>
            <span className="text-gray-400 font-mono">{ticker?.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            {isStale && (
              <span className="text-xs text-amber-600/70 font-mono flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse inline-block" />
                syncing
              </span>
            )}
            {dataSource && dataSource !== 'api' && dataSource !== 'snap' && (
              <span className="text-xs text-gray-600 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded font-mono">
                cached
              </span>
            )}
          </div>
        </div>

        {/* Company header — dims slightly while snapshot is stale, fades to full when fresh data arrives */}
        <div style={{ opacity: isStale ? 0.82 : 1, transition: 'opacity 0.35s ease' }}>
          <CompanyHeader
            company={company}
            financials={financials}
            livePrice={livePrice}
            liveChangePercent={liveChangePercent}
            isLive={isLive}
          />
        </div>

        {/* Neural Alpha orb — shown once financials are loaded, sits between header and tabs */}
        {!financialsLoading && financials && (
          <div className="flex items-center gap-2 mb-5">
            <NeuralAlpha company={company} financials={financials} isStale={isStale} />
            <span className="text-[10px] text-gray-700 font-mono">neural alpha</span>
          </div>
        )}

        {/* Tab navigation — liquid mercury indicator */}
        <div className="relative flex border-b border-gray-800 mb-6 gap-1 overflow-x-auto">
          {indicator.ready && (
            <div
              style={{
                position:     'absolute',
                bottom:       -1,
                left:         indicator.left,
                width:        indicator.width,
                height:       2,
                borderRadius: 999,
                background:   '#6366f1',
                boxShadow:    '0 0 8px rgba(99,102,241,0.7)',
                transition:   'left 0.35s cubic-bezier(0.34,1.56,0.64,1), width 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                pointerEvents: 'none',
              }}
            />
          )}
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={el => { tabRefs.current[t.id] = el; }}
              onClick={() => {
                if (t.id === tab) return;
                setTab(t.id);
                setTimeout(() => hapticLight(), 350);
              }}
              className={`pb-3 px-3 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap border-b-2 border-transparent ${
                tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
        {tab === 'price' && (
          <motion.div key="price" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <PriceChart ticker={ticker?.toUpperCase()} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {[
                ['Revenue (TTM)',        financials?.income?.[0]?.revenue],
                ['Net Income',           financials?.income?.[0]?.netIncome],
                ['Free Cash Flow',       financials?.cashflow?.[0]?.freeCashFlow],
                ['Total Assets',         financials?.balance?.[0]?.totalAssets],
                ['Total Debt',           financials?.balance?.[0]?.totalDebt],
                ["Shareholders' Equity", financials?.balance?.[0]?.shareholdersEquity],
              ].map(([label, val]) => (
                <div key={label} className="stat-card">
                  <p className="text-xs text-gray-600 mb-1">{label}</p>
                  <p className="font-mono text-sm text-gray-200" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(val)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 text-center mt-2 mb-6" style={{ opacity: 0.6 }}>
              For informational purposes only. Not financial advice.
            </p>
          </motion.div>
        )}

        {tab === 'summary' && (
          <motion.div key="summary" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <CompanySummary company={company} financials={financials} />
            <p className="text-xs text-gray-600 text-center mt-6 mb-2" style={{ opacity: 0.6 }}>
              For informational purposes only. Not financial advice.
            </p>
          </motion.div>
        )}

        {tab === 'financials' && (
          <motion.div key="financials" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {financialsLoading ? <FinancialsSkeleton /> : <FinancialTable financials={financials} />}
            {!financialsLoading && (
              <p className="text-xs text-gray-600 text-center mt-6 mb-2" style={{ opacity: 0.6 }}>
                For informational purposes only. Not financial advice.
              </p>
            )}
          </motion.div>
        )}

        {tab === 'ratios' && (
          <motion.div key="ratios" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {financialsLoading ? <FinancialsSkeleton /> : <KeyRatios ticker={ticker?.toUpperCase()} financials={financials} company={company} />}
            {!financialsLoading && (
              <p className="text-xs text-gray-600 text-center mt-6 mb-2" style={{ opacity: 0.6 }}>
                For informational purposes only. Not financial advice.
              </p>
            )}
          </motion.div>
        )}

        {tab === 'dcf' && (
          <motion.div key="dcf" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <DCFTool ticker={ticker?.toUpperCase()} currentPrice={company?.price} />
            <p className="text-xs text-gray-600 text-center mt-2 mb-6" style={{ opacity: 0.6 }}>
              For informational purposes only. Not financial advice.
            </p>
          </motion.div>
        )}

        {tab === 'chat' && (
          <motion.div key="chat" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <CommunityChat ticker={ticker?.toUpperCase()} />
            <p className="text-xs text-gray-600 text-center mt-2 mb-6" style={{ opacity: 0.6 }}>
              For informational purposes only. Not financial advice.
            </p>
          </motion.div>
        )}
        </AnimatePresence>

      </div>
    </>
  );
}

function FinancialsSkeleton() {
  return (
    <div className="card space-y-3 py-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="shimmer h-8 w-full rounded" style={{ opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

function fmtMoney(n) {
  if (n == null || isNaN(+n)) return '—';
  const v   = +n;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}
