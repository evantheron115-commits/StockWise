export default function CompanyHeader({ company }) {
  const up = company.changePercent > 0;
  const dn = company.changePercent < 0;
  const priceRange = company.high52w - company.low52w;
  const pricePct = priceRange > 0
    ? Math.max(2, Math.min(98, ((company.price - company.low52w) / priceRange) * 100))
    : 50;

  return (
    <div className="card mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-semibold text-white">{company.name}</h1>
            <span className="font-mono text-sm text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">
              {company.ticker}
            </span>
            <span className="text-xs text-gray-500">{company.exchange}</span>
          </div>
          <p className="text-sm text-gray-500">{company.sector} · {company.industry}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-semibold text-white">
            ${company.price?.toFixed(2) ?? '—'}
          </div>
          {company.changePercent != null && (
            <div className={`text-sm font-mono mt-1 ${up ? 'up' : dn ? 'down' : 'text-gray-500'}`}>
              {up ? '+' : ''}{company.changePercent?.toFixed(2)}% today
            </div>
          )}
        </div>
      </div>

      {/* 52-week range */}
      {company.high52w && company.low52w && (
        <div className="mt-3">
          <p className="text-xs text-gray-600 mb-2">52-week range</p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-500">${company.low52w?.toFixed(2)}</span>
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-500 border-2 border-gray-900"
                style={{ left: `${pricePct}%`, transform: 'translateX(-50%) translateY(-50%)' }}
              />
            </div>
            <span className="text-xs font-mono text-gray-500">${company.high52w?.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-800">
        {[
          ['Market Cap', fmtMktCap(company.marketCap)],
          ['P/E Ratio', company.peRatio?.toFixed(1) ?? '—'],
          ['EPS (TTM)', company.eps ? `$${company.eps.toFixed(2)}` : '—'],
          ['Beta', company.beta?.toFixed(2) ?? '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-gray-600 mb-0.5">{label}</p>
            <p className="font-mono text-sm text-gray-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      {company.description && (
        <p className="mt-4 text-sm text-gray-400 leading-relaxed line-clamp-3">
          {company.description}
        </p>
      )}
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
