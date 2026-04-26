import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getChart } from '../lib/api';
import { hapticLight } from '../lib/haptics';

const TIMEFRAMES = [
  { label: '1Y', years: 1 },
  { label: '3Y', years: 3 },
  { label: '5Y', years: 5 },
];

// Formats "2024-03-15" → "Mar 2024"
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// Premium tooltip — high contrast, shows delta from period start
function PremiumTooltip({ active, payload, label, firstPrice }) {
  if (!active || !payload?.length) return null;
  const price = payload[0].value;
  const delta = firstPrice > 0 ? ((price - firstPrice) / firstPrice) * 100 : 0;
  const up    = delta >= 0;
  return (
    <div
      className="rounded-xl px-4 py-3 shadow-2xl pointer-events-none"
      style={{
        background: 'rgba(13,15,23,0.96)',
        border: `1px solid ${up ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <p className="text-[10px] text-gray-500 mb-1 font-mono uppercase tracking-widest">
        {fmtDate(label)}
      </p>
      <p className="text-xl font-mono font-semibold text-white leading-none">
        ${price?.toFixed(2)}
      </p>
      <p className={`text-xs font-mono mt-1 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}% from period start
      </p>
    </div>
  );
}

export default function PriceChart({ ticker }) {
  const [data,        setData]        = useState([]);
  const [tf,          setTf]          = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [loaded,      setLoaded]      = useState(false);
  const [chartSource, setChartSource] = useState(null);
  const [crosshairX,  setCrosshairX]  = useState(null); // active date string for ReferenceLine

  const abortRef          = useRef(null);
  const activeTicker      = useRef(ticker);
  const prevCursorIdx     = useRef(null);
  const chartContainerRef = useRef(null);
  const retryRef          = useRef(null);
  const retryCount        = useRef(0);

  const CHART_RETRY_DELAY = 7000;
  const CHART_MAX_RETRIES = 5;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearTimeout(retryRef.current);
    };
  }, []);

  useEffect(() => {
    activeTicker.current = ticker;
    abortRef.current?.abort();
    abortRef.current = null;
    clearTimeout(retryRef.current);
    retryRef.current  = null;
    retryCount.current = 0;
    setLoaded(false);
    setData([]);
    setError(null);
    setTf(1);
    setChartSource(null);
    setCrosshairX(null);
    prevCursorIdx.current = null;
    // Auto-fetch 1Y on every ticker — abortRef is null here so fetchChart's guard passes
    if (ticker) fetchChart(1);
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  function fetchChart(years, isAutoRetry = false) {
    if (!ticker || abortRef.current) return;
    const controller     = new AbortController();
    abortRef.current     = controller;
    const snapshotTicker = ticker;

    setLoading(true);
    setError(null);
    if (!isAutoRetry) setData([]);

    getChart(ticker, years)
      .then(({ payload, source }) => {
        if (activeTicker.current !== snapshotTicker) return;
        retryCount.current = 0;
        setData(payload ?? []);
        setChartSource(source);
        setLoaded(true);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        if (activeTicker.current !== snapshotTicker) return;

        const status      = err.response?.status;
        const isNotFound  = status === 404;
        const isRateLimit = err.isRateLimit || status === 429;

        if (!isNotFound && !isRateLimit && retryCount.current < CHART_MAX_RETRIES) {
          retryCount.current += 1;
          retryRef.current = setTimeout(() => {
            retryRef.current = null;
            abortRef.current = null;
            fetchChart(years, true);
          }, CHART_RETRY_DELAY);
        } else {
          setError(isRateLimit
            ? 'API rate limit reached. Please wait and try again.'
            : 'Could not load price data.'
          );
        }
      })
      .finally(() => {
        if (activeTicker.current !== snapshotTicker) return;
        setLoading(false);
        if (!retryRef.current) abortRef.current = null;
      });
  }

  function handleTfChange(years) {
    if (years === tf) return;
    setTf(years);
    if (loaded) fetchChart(years);
  }

  const handleChartMouseMove = useCallback((e) => {
    if (!e?.activePayload?.length) return;
    const idx = e.activeTooltipIndex;
    setCrosshairX(thinned[idx]?.date ?? null);
    // Haptic tick only fires when the cursor crosses into a new data point
    if (idx !== prevCursorIdx.current) {
      prevCursorIdx.current = idx;
      hapticLight();
    }
  }, []);  // thinned is computed below — safe because this cb only runs inside the chart

  function handleChartMouseLeave() {
    setCrosshairX(null);
    prevCursorIdx.current = null;
  }

  // Stroke-dasharray draw animation — fires after Recharts commits its SVG path
  useEffect(() => {
    if (!loaded || !thinned.length) return;
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const path = chartContainerRef.current?.querySelector('.recharts-area-curve');
        if (!path) return;
        const len = path.getTotalLength();
        path.style.transition  = 'none';
        path.style.strokeDasharray  = len;
        path.style.strokeDashoffset = len;
        void path.getBoundingClientRect(); // force reflow
        path.style.transition  = 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
        path.style.strokeDashoffset = 0;
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [loaded, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  const thinned = data.filter((_, i) =>
    i % Math.max(1, Math.floor(data.length / 200)) === 0
  );

  const firstPrice = thinned[0]?.close;
  const lastPrice  = thinned[thinned.length - 1]?.close;
  const gain       = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const isUp       = gain >= 0;
  const lineColor  = isUp ? '#34d399' : '#f87171';
  const gradientId = `grad-${ticker}`;

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-white">Price History</h2>
            {loaded && chartSource && chartSource !== 'api' && (
              <span className="text-xs text-gray-600 bg-surface-800 border border-white/[0.06] px-2 py-0.5 rounded font-mono">
                cached
              </span>
            )}
          </div>
          {loaded && thinned.length > 0 && (
            <p className={`text-sm font-mono mt-0.5 ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{gain.toFixed(2)}% over {tf}Y
            </p>
          )}
        </div>
        {(loaded || loading) && (
          <div className="flex gap-1">
            {TIMEFRAMES.map(({ label, years }) => (
              <button
                key={label}
                onClick={() => handleTfChange(years)}
                disabled={loading}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 ${
                  tf === years
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="h-56 flex items-center justify-center">
          <div className="space-y-3 w-full px-2">
            <div className="shimmer h-28 w-full" />
            <div className="flex gap-2">
              <div className="shimmer h-3 flex-1" />
              <div className="shimmer h-3 flex-1" />
              <div className="shimmer h-3 flex-1" />
              <div className="shimmer h-3 flex-1" />
              <div className="shimmer h-3 flex-1" />
              <div className="shimmer h-3 flex-1" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="h-56 flex flex-col items-center justify-center gap-3">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => fetchChart(tf)}
            className="text-xs text-gray-500 hover:text-gray-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {loaded && !loading && !error && thinned.length > 0 && (
        <ResponsiveContainer width="100%" height={220} ref={chartContainerRef}>
          <AreaChart
            data={thinned}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor={lineColor} stopOpacity={0.20} />
                <stop offset="60%" stopColor={lineColor} stopOpacity={0.04} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="2 6"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tick={{ fill: '#374151', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtDate}
              interval={Math.floor(thinned.length / 5)}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#374151', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={52}
            />

            {/* Vertical crosshair — follows cursor with haptic ticks */}
            {crosshairX && (
              <ReferenceLine
                x={crosshairX}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            )}

            <Tooltip
              content={<PremiumTooltip firstPrice={firstPrice} />}
              cursor={false}
            />

            <Area
              type="monotone"
              dataKey="close"
              stroke={lineColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: lineColor,
                stroke: 'rgba(13,15,23,0.8)',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {loaded && !loading && !error && thinned.length === 0 && (
        <div className="h-56 flex items-center justify-center text-gray-600 text-sm">
          No price data available.
        </div>
      )}
    </div>
  );
}
