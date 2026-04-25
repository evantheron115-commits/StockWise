import { useState } from 'react';
import { useRouter } from 'next/router';
import CommandPalette from '../components/CommandPalette';

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

export default function Home() {
  const [activeMarket, setActiveMarket] = useState(0);
  const router = useRouter();

  const go = (ticker) => router.push(`/stock/${ticker}`);

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
      <CommandPalette />

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
