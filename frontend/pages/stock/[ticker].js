import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { getCompany, getFinancials } from '../../lib/api';
import CompanyHeader  from '../../components/CompanyHeader';
import PriceChart     from '../../components/PriceChart';
import FinancialTable from '../../components/FinancialTable';
import DCFTool        from '../../components/DCFTool';

const TABS = ['Overview', 'Financials', 'DCF Valuation'];

export default function StockPage() {
  const router     = useRouter();
  const { ticker } = router.query;

  const [company,     setCompany]     = useState(null);
  const [financials,  setFinancials]  = useState(null);
  const [tab,         setTab]         = useState('Overview');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [dataLoaded,  setDataLoaded]  = useState(false);
  const [dataSource,  setDataSource]  = useState(null); // 'cache' | 'api' | 'db'

  const financialsFetched = useRef(false);
  const inFlight          = useRef(false);
  const loadId            = useRef(0);

  // Reset state when ticker changes — do NOT auto-fetch
  useEffect(() => {
    if (!ticker) return;
    loadId.current += 1;
    console.log('[StockPage] Ticker changed to', ticker, '— waiting for user to load data');
    setCompany(null);
    setFinancials(null);
    setError(null);
    setRateLimited(false);
    setTab('Overview');
    setDataLoaded(false);
    setDataSource(null);
    financialsFetched.current = false;
    inFlight.current = false;
  }, [ticker]);

  function loadData() {
    if (!ticker || inFlight.current) return;
    inFlight.current = true;
    loadId.current += 1;
    const thisLoadId = loadId.current;
    console.log('[StockPage] User clicked Load Data for', ticker, '(loadId=' + thisLoadId + ')');
    setLoading(true);
    setError(null);
    setRateLimited(false);
    setCompany(null);
    setFinancials(null);
    setDataSource(null);
    financialsFetched.current = false;

    getCompany(ticker.toUpperCase())
      .then(({ payload, source }) => {
        if (loadId.current !== thisLoadId) {
          console.log('[StockPage] Discarding stale company result (loadId mismatch)');
          return;
        }
        console.log(`[StockPage] Company loaded for ${ticker} — source: ${source}`);
        setCompany(payload);
        setDataSource(source);
        setDataLoaded(true);
      })
      .catch((err) => {
        if (loadId.current !== thisLoadId) return;
        if (err.isRateLimit) {
          console.warn('[StockPage] Rate limited:', err.message);
          setRateLimited(true);
          setError(err.message);
        } else {
          console.error('[StockPage] Failed to load company data:', err.message);
          setError(`Could not find data for "${ticker.toUpperCase()}". Check the ticker and try again.`);
        }
      })
      .finally(() => {
        if (loadId.current !== thisLoadId) return;
        setLoading(false);
        inFlight.current = false;
      });
  }

  // Fetch financials lazily — only when a tab that needs them is opened
  useEffect(() => {
    if (!ticker || !dataLoaded || financialsFetched.current) return;
    if (tab !== 'Financials' && tab !== 'DCF Valuation') return;

    let cancelled = false;
    financialsFetched.current = true;
    console.log('[StockPage] Loading financials for', ticker);

    getFinancials(ticker.toUpperCase())
      .then(({ payload, source }) => {
        if (!cancelled) {
          console.log(`[StockPage] Financials loaded for ${ticker} — source: ${source}`);
          setFinancials(payload);
        }
      })
      .catch((err) => {
        console.warn('[StockPage] Financials failed (non-fatal):', err.message);
        financialsFetched.current = false; // allow retry on next tab switch
      });
    return () => { cancelled = true; };
  }, [tab, ticker, dataLoaded]);

  if (!ticker) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600 text-sm">
        Loading...
      </div>
    );
  }

  // Pre-load state — nothing has been fetched yet
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
              The FMP free tier has a daily request limit. Wait a few minutes
              or start Redis to serve from cache without hitting the API.
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

  return (
    <>
      <Head>
        <title>{company?.name || ticker} ({ticker}) — StockWise</title>
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

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tab ${tab === t ? 'tab-active' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Overview' && (
          <>
            <PriceChart ticker={ticker?.toUpperCase()} />

            {company && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {[
                  ['Revenue (TTM)',       financials?.income?.[0]?.revenue],
                  ['Net Income',          financials?.income?.[0]?.netIncome],
                  ['Free Cash Flow',      financials?.cashflow?.[0]?.freeCashFlow],
                  ['Total Assets',        financials?.balance?.[0]?.totalAssets],
                  ['Total Debt',          financials?.balance?.[0]?.totalDebt],
                  ["Shareholders' Equity",financials?.balance?.[0]?.shareholdersEquity],
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

        {tab === 'Financials' && (
          <FinancialTable financials={financials} />
        )}

        {tab === 'DCF Valuation' && (
          <DCFTool
            ticker={ticker?.toUpperCase()}
            currentPrice={company?.price}
          />
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
