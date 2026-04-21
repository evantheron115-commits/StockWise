import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getChart } from '../lib/api';

const TIMEFRAMES = [
  { label: '1Y', years: 1 },
  { label: '3Y', years: 3 },
  { label: '5Y', years: 5 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-mono font-medium text-white">${payload[0].value?.toFixed(2)}</p>
    </div>
  );
};

export default function PriceChart({ ticker }) {
  const [data,        setData]        = useState([]);
  const [tf,          setTf]          = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [loaded,      setLoaded]      = useState(false);
  const [chartSource, setChartSource] = useState(null); // 'cache' | 'api'

  const inFlight     = useRef(false);
  const activeTicker = useRef(ticker);

  // Reset all state when the ticker prop changes
  useEffect(() => {
    activeTicker.current = ticker;
    setLoaded(false);
    setData([]);
    setError(null);
    setTf(1);
    setChartSource(null);
    inFlight.current = false;
    console.log('[PriceChart] Ticker changed to', ticker, '— chart reset');
  }, [ticker]);

  function fetchChart(years) {
    if (!ticker || inFlight.current) return;
    const snapshotTicker = ticker;
    inFlight.current = true;
    console.log(`[PriceChart] Fetching ${ticker} ${years}Y chart`);
    setLoading(true);
    setError(null);
    setData([]);

    getChart(ticker, years)
      .then(({ payload, source }) => {
        if (activeTicker.current !== snapshotTicker) {
          console.log(`[PriceChart] Discarding stale result for ${snapshotTicker}`);
          return;
        }
        console.log(`[PriceChart] Received ${payload?.length ?? 0} points for ${ticker} — source: ${source}`);
        setData(payload ?? []);
        setChartSource(source);
        setLoaded(true);
      })
      .catch((err) => {
        if (activeTicker.current !== snapshotTicker) return;
        console.error(`[PriceChart] Chart fetch failed for ${ticker}:`, err.message);
        setError(err.isRateLimit
          ? 'API rate limit reached. Please wait and try again.'
          : 'Could not load price data.'
        );
      })
      .finally(() => {
        if (activeTicker.current !== snapshotTicker) return;
        setLoading(false);
        inFlight.current = false;
      });
  }

  function handleTfChange(years) {
    if (years === tf) return;
    setTf(years);
    if (loaded) fetchChart(years);
  }

  // Thin out data points for performance (~200 points max)
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
              <span className="text-xs text-gray-600 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded font-mono">
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
        {loaded && (
          <div className="flex gap-1">
            {TIMEFRAMES.map(({ label, years }) => (
              <button
                key={label}
                onClick={() => handleTfChange(years)}
                disabled={loading}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 ${
                  tf === years
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pre-load state */}
      {!loaded && !loading && !error && (
        <div className="h-56 flex items-center justify-center">
          <button onClick={() => fetchChart(tf)} className="btn-primary text-sm">
            Load Price Chart →
          </button>
        </div>
      )}

      {loading && (
        <div className="h-56 flex items-center justify-center text-gray-600 text-sm">
          Loading chart...
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
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={thinned} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={lineColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#4b5563', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d) => d?.slice(0, 7)}
              interval={Math.floor(thinned.length / 6)}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#4b5563', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="close"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
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
