import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { getCompany, getFinancials } from '../../lib/api';
import CompanyHeader  from '../../components/CompanyHeader';
import PriceChart     from '../../components/PriceChart';
import FinancialTable from '../../components/FinancialTable';
import DCFTool        from '../../components/DCFTool';
import CompanySummary from '../../components/CompanySummary';
import KeyRatios      from '../../components/KeyRatios';
import CommunityChat  from '../../components/CommunityChat';

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

  const [company,     setCompany]     = useState(null);
  const [financials,  setFinancials]  = useState(null);
  const [tab,         setTab]         = useState('price');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [dataLoaded,  setDataLoaded]  = useState(false);
  const [dataSource,  setDataSource]  = useState(null);

  const financialsFetched = useRef(false);
  const inFlight          = useRef(false);
  const loadId            = useRef(0);
  // Tracks which tabs have been opened at least once — avoids redundant fetches
  const loadedTabs        = useRef(new Set());

  // ── Restore active tab from URL hash on mount ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);
    if (VALID_TABS.has(hash)) setTab(hash);
  }, []);

  // ── Sync URL hash when tab changes ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.location.hash = tab;
  }, [tab]);

  // ── Reset state when ticker changes ───────────────────────────────────────
  useEffect(() => {
    if (!ticker) return;
    loadId.current += 1;
    setCompany(null);
    setFinancials(null);
    setError(null);
    setRateLimited(false);
    setTab('price');
    setDataLoaded(false);
    setDataSource(null);
    financialsFetched.current = false;
    inFlight.current = false;
    loadedTabs.current = new Set();
  }, [ticker]);

  // ── Track which tabs have been opened ─────────────────────────────────────
  useEffect(() => {
    if (dataLoaded) loadedTabs.current.add(tab);
  }, [tab, dataLoaded]);

  function loadData() {
    if (!ticker || inFlight.current) return;
    inFlight.current = true;
    loadId.current += 1;
    const thisLoadId = loadId.current;
    setLoading(true);
    setError(null);
    setRateLimited(false);
    setCompany(null);
    setFinancials(null);
    setDataSource(null);
    financialsFetched.current = false;

    getCompany(ticker.toUpperCase())
      .then(({ payload, source }) => {
        if (loadId.current !== thisLoadId) return;
        setCompany(payload);
        setDataSource(source);
        setDataLoaded(true);
      })
      .catch((err) => {
        if (loadId.current !== thisLoadId) return;
        if (err.isRateLimit) {
          setRateLimited(true);
          setError(err.message);
        } else {
          setError(`Could not find data for "${ticker.toUpperCase()}". Check the ticker and try again.`);
        }
      })
      .finally(() => {
        if (loadId.current !== thisLoadId) return;
        setLoading(false);
        inFlight.current = false;
      });
  }

  // ── Lazy-fetch financials — only when first opening a tab that needs them ──
  useEffect(() => {
    const needsFinancials = tab === 'financials' || tab === 'dcf' || tab === 'ratios';
    if (!ticker || !dataLoaded || financialsFetched.current || !needsFinancials) return;

    let cancelled = false;
    financialsFetched.current = true;

    getFinancials(ticker.toUpperCase())
      .then(({ payload }) => {
        if (!cancelled) setFinancials(payload);
      })
      .catch((err) => {
        console.warn('[StockPage] Financials failed (non-fatal):', err.message);
        financialsFetched.current = false;
      });

    return () => { cancelled = true; };
  }, [tab, ticker, dataLoaded]);

  function handleTabChange(id) {
    setTab(id);
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!ticker) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600 text-sm">
        Loading...
      </div>
    );
  }

  if (!loading && !dataLoaded && !error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-8 justify-center">
          <Link href="/" className="hover:text-gray-400 transition-colors">Search</Link>
          <span>/</span>
          <span className="text-gray-400 font-mono">{ticker?.toUpperCase()}</span>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Ready to load data for{' '}
          <span className="font-mono text-brand-400">{ticker?.toUpperCase()}</span>
        </p>
        <button onClick={loadData} className="btn-primary">
          Load Stock Data →
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600 text-sm">
        Loading {ticker?.toUpperCase()}...
      </div>
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
              <button onClick={loadData} className="btn-primary">Try Again</button>
              <Link href="/" className="btn-primary inline-block">← Back to Search</Link>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 justify-center">
            <button onClick={loadData} className="btn-primary">Retry</button>
            <Link href="/" className="btn-primary inline-block">← Back to Search</Link>
          </div>
        )}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>{company?.name || ticker} ({ticker?.toUpperCase()}) — Stoxora</title>
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb + cache badge */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Link href="/" className="hover:text-gray-400 transition-colors">Search</Link>
            <span>/</span>
            <span className="text-gray-400 font-mono">{ticker?.toUpperCase()}</span>
          </div>
          {dataSource && dataSource !== 'api' && (
            <span className="text-xs text-gray-600 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded font-mono">
              cached
            </span>
          )}
        </div>

        {/* Company header */}
        {company && <CompanyHeader company={company} />}

        {/* 6-tab navigation */}
        <div className="flex border-b border-gray-800 mb-6 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`tab whitespace-nowrap ${tab === t.id ? 'tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content — each tab mounts only when active */}

        {tab === 'price' && (
          <>
            <PriceChart ticker={ticker?.toUpperCase()} />
            {company && (
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
                    <p className="font-mono text-sm text-gray-200">{fmtMoney(val)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'summary' && (
          <CompanySummary company={company} />
        )}

        {tab === 'financials' && (
          <FinancialTable financials={financials} />
        )}

        {tab === 'ratios' && (
          <KeyRatios
            ticker={ticker?.toUpperCase()}
            financials={financials}
            company={company}
          />
        )}

        {tab === 'dcf' && (
          <DCFTool
            ticker={ticker?.toUpperCase()}
            currentPrice={company?.price}
          />
        )}

        {tab === 'chat' && (
          <CommunityChat ticker={ticker?.toUpperCase()} />
        )}

      </div>
    </>
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
