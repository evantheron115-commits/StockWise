import { useState, useEffect, useRef } from 'react';

export default function CompanySummary({ company, financials }) {

  if (!company) {
    return <div className="card mb-6 text-sm text-gray-600">Company data unavailable.</div>;
  }

  return (
    <div className="space-y-4 mb-6">

      {/* About */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">About {company.name}</h2>
          {company.exchange && <span className="badge badge-gray">{company.exchange}</span>}
        </div>

        {company.description ? (
          <p className="text-sm text-gray-400 leading-relaxed">{company.description}</p>
        ) : (
          <p className="text-sm text-gray-600">No description available.</p>
        )}

        {/* Company details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-5 pt-5 border-t border-white/[0.06]">
          {[
            ['Sector',      company.sector],
            ['Industry',    company.industry],
            ['Country',     company.country],
            ['Exchange',    company.exchange],
            ['Employees',   company.employees?.toLocaleString()],
            ['IPO Date',    company.ipoDate],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-600 mb-0.5">{label}</p>
              <p className="text-sm text-gray-300">{value}</p>
            </div>
          ))}
        </div>

        {/* Website */}
        {company.website && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-gray-600 mb-1">Website</p>
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-400 hover:text-brand-300 hover:underline transition-colors"
            >
              {company.website}
            </a>
          </div>
        )}
      </div>

      {/* Key stats */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Key Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(() => {
            const latestIncome = financials?.income?.[0];
            const resolvedEps = company.eps ?? latestIncome?.epsDiluted ?? latestIncome?.eps ?? null;
            const resolvedMarketCap = company.marketCap
              ?? ((company.price > 0 && company.sharesOutstanding > 0)
                  ? company.price * company.sharesOutstanding : null);
            const resolvedPE = (company.peRatio > 0 && company.peRatio <= 5000)
              ? company.peRatio
              : (company.price > 0 && resolvedEps > 0 ? company.price / resolvedEps : null);
            return [
              ['Market Cap',    fmtMktCap(resolvedMarketCap)],
              ['P/E Ratio',     resolvedPE ? resolvedPE.toFixed(1) : '—'],
              ['EPS (TTM)',     resolvedEps != null ? `$${resolvedEps.toFixed(2)}` : '—'],
              ['Beta',          company.beta?.toFixed(2) ?? '—'],
              ['52W High',      company.high52w ? `$${company.high52w.toFixed(2)}` : '—'],
              ['52W Low',       company.low52w  ? `$${company.low52w.toFixed(2)}`  : '—'],
              ['Avg Volume',    company.avgVolume ? fmtVolume(company.avgVolume) : '—'],
              ['Current Price', company.price ? `$${company.price.toFixed(2)}` : '—'],
            ];
          })().map(([label, value]) => (
            <div key={label} className="stat-card">
              <p className="text-xs text-gray-600 mb-1">{label}</p>
              <p className="font-mono text-sm text-gray-200">{value}</p>
            </div>
          ))}
        </div>
      </div>

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

function fmtVolume(n) {
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr.slice(0, 10);
  }
}
