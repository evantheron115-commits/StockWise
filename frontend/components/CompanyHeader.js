import { useState } from 'react';
import WatchlistButton from './WatchlistButton';

export default function CompanyHeader({ company }) {
  const up = company.changePercent > 0;
  const dn = company.changePercent < 0;

  const capTier = company.marketCap >= 500e9 ? 'font-bold'
                : company.marketCap >= 100e9 ? 'font-semibold'
                : 'font-medium';

  const priceRange = company.high52w - company.low52w;
  const pricePct = priceRange > 0
    ? Math.max(2, Math.min(98, ((company.price - company.low52w) / priceRange) * 100))
    : 50;

  const logoUrl = `https://financialmodelingprep.com/image-stock/${company.ticker}.png`;

  return (
    <div className="card mb-5">

      {/* Top row — identity + price */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">

        {/* Left: logo + name */}
        <div className="flex items-center gap-3">
          <CompanyLogo ticker={company.ticker} logoUrl={logoUrl} name={company.name} />
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="text-xl font-semibold text-white leading-tight">{company.name}</h1>
              <span className="badge badge-blue">{company.ticker}</span>
              {company.exchange && (
                <span className="text-xs text-gray-600">{company.exchange}</span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {[company.sector, company.industry].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Right: price + watchlist */}
        <div className="text-right flex flex-col items-end gap-2">
          <div>
            <div className="relative inline-block">
              <div
                aria-hidden
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: '-8px -20px',
                  background: 'radial-gradient(ellipse, rgba(99,102,241,0.16) 0%, transparent 70%)',
                  animation: 'light-leak 4s ease-in-out infinite',
                }}
              />
              <div
                className="text-3xl font-mono font-extrabold text-white relative"
                style={{ textShadow: '0 0 15px rgba(99,102,241,0.50)', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}
              >
                ${company.price?.toFixed(2) ?? '—'}
              </div>
            </div>
            {company.changePercent != null && (
              <div className={`text-sm font-mono mt-0.5 ${up ? 'up' : dn ? 'down' : 'neutral'}`}>
                {up ? '▲' : dn ? '▼' : ''}{' '}
                {up ? '+' : ''}{company.changePercent?.toFixed(2)}%
                <span className="text-gray-600 text-xs ml-1">today</span>
              </div>
            )}
          </div>
          <WatchlistButton ticker={company.ticker} />
        </div>
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 pt-4 border-t border-white/[0.06]">
        {[
          ['Market Cap',  fmtMktCap(company.marketCap)],
          // Compute P/E from price÷EPS when the API omits it
          ['P/E Ratio',   fmtPE(company.peRatio, company.price, company.eps)],
          ['EPS (TTM)',   company.eps != null ? `$${company.eps.toFixed(2)}` : '—'],
          ['Beta',        company.beta?.toFixed(2) ?? '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-gray-600 mb-0.5">{label}</p>
            <p className="font-mono text-sm text-gray-200">{value}</p>
          </div>
        ))}
      </div>

      {/* 52-week range */}
      {company.high52w && company.low52w && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-gray-600 mb-2">52-week range</p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-500 w-16 text-right">
              ${company.low52w?.toFixed(2)}
            </span>
            <div className="flex-1 h-1 bg-surface-700 rounded-full relative">
              <div
                className="absolute top-1/2 w-3 h-3 rounded-full bg-brand-500 border-2 border-surface-950 shadow-glow"
                style={{ left: `${pricePct}%`, transform: 'translateX(-50%) translateY(-50%)' }}
              />
              {/* Filled range bar */}
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-brand-500/20"
                style={{ width: `${pricePct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-500 w-16">
              ${company.high52w?.toFixed(2)}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}

function CompanyLogo({ ticker, logoUrl, name }) {
  const [failed, setFailed] = useState(false);
  const initials = name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || ticker?.slice(0, 2);

  if (failed) {
    return (
      <div className="w-11 h-11 rounded-xl bg-surface-700 border border-white/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-gray-400 font-mono">{initials}</span>
      </div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10">
      <img
        src={logoUrl}
        alt={`${ticker} logo`}
        className="w-9 h-9 object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function fmtMktCap(n) {
  if (!n) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n}`;
}

function fmtPE(peRatio, price, eps) {
  // Use API value if valid
  if (peRatio != null && peRatio > 0 && peRatio <= 5000) return peRatio.toFixed(1);
  // Fall back to price ÷ EPS when API omits it
  if (price > 0 && eps > 0) return (price / eps).toFixed(1);
  return '—';
}
