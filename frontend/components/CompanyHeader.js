import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import WatchlistButton from './WatchlistButton';
import { hapticLight } from '../lib/haptics';

export default function CompanyHeader({ company, financials, livePrice, liveChangePercent, isLive }) {
  // Prefer live socket data when available
  const displayPrice  = livePrice         ?? company.price;
  const displayChange = liveChangePercent ?? company.changePercent;

  // Haptic on price direction flip (green→red or red→green)
  const prevDirectionRef = useRef(null);
  useEffect(() => {
    if (livePrice == null) return;
    const dir = displayChange > 0 ? 'up' : displayChange < 0 ? 'dn' : 'flat';
    if (prevDirectionRef.current && prevDirectionRef.current !== dir) hapticLight();
    prevDirectionRef.current = dir;
  }, [livePrice, displayChange]);

  const up = displayChange > 0;
  const dn = displayChange < 0;

  // Resolve EPS: quote field first, then income statement
  const latestIncome = financials?.income?.[0];
  const resolvedEps = company.eps ?? latestIncome?.epsDiluted ?? latestIncome?.eps ?? null;

  // Resolve Market Cap: API field first, then price × shares
  const resolvedMarketCap = company.marketCap
    ?? ((company.price > 0 && company.sharesOutstanding > 0)
        ? company.price * company.sharesOutstanding
        : null);

  const capTier = resolvedMarketCap >= 500e9 ? 'font-bold'
                : resolvedMarketCap >= 100e9 ? 'font-semibold'
                : 'font-medium';

  const priceRange = company.high52w - company.low52w;
  const pricePct = priceRange > 0
    ? Math.max(2, Math.min(98, ((company.price - company.low52w) / priceRange) * 100))
    : 50;

  // Web: route through Vercel rewrite → edge CDN caches for 30 days
  // Mobile: use full Railway URL (Capacitor can't resolve relative paths)
  const isMobile = process.env.NEXT_PUBLIC_BUILD_TARGET === 'mobile';
  const logoUrl  = isMobile
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/company/logo/${company.ticker}`
    : `/logo/${company.ticker}`;

  const dotGlow = Math.min(12, 4 + Math.abs(displayChange ?? 0) * 0.8);

  return (
    <motion.div
      className="card mb-5"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >

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
              <div className="flex items-center gap-2 justify-end">
                {/* Bioluminescent live dot — visible only when socket stream is active */}
                {isLive && (
                  <span className="relative flex h-2 w-2 flex-shrink-0" aria-label="Live">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" style={{ boxShadow: `0 0 ${dotGlow}px #4ade80` }} />
                  </span>
                )}
                <div
                  className="text-3xl font-mono font-extrabold text-white relative"
                  style={{ textShadow: '0 0 15px rgba(99,102,241,0.50)', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}
                >
                  ${displayPrice?.toFixed(2) ?? '—'}
                </div>
              </div>
            </div>
            {displayChange != null && (
              <div className={`text-sm font-mono mt-0.5 ${up ? 'up' : dn ? 'down' : 'neutral'}`}>
                {up ? '▲' : dn ? '▼' : ''}{' '}
                {up ? '+' : ''}{displayChange?.toFixed(2)}%
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
          ['Market Cap',  fmtMktCap(resolvedMarketCap)],
          ['P/E Ratio',   fmtPE(company.peRatio, company.price, resolvedEps)],
          ['EPS (TTM)',   resolvedEps != null ? `$${resolvedEps.toFixed(2)}` : '—'],
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

    </motion.div>
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
      <Image
        src={logoUrl}
        alt={`${ticker} logo`}
        width={36}
        height={36}
        priority
        className="object-contain"
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
