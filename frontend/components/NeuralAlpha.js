import { useState, useMemo } from 'react';

function analyzeStock(company, financials) {
  const income   = financials?.income?.[0]   || {};
  const balance  = financials?.balance?.[0]  || {};
  const cashflow = financials?.cashflow?.[0] || {};

  const revenue = income.revenue;
  const equity  = balance.shareholdersEquity;
  const debt    = balance.totalDebt;

  let pts = 0;
  const factors = [];

  // Return on Equity
  const roe = equity > 0 && income.netIncome != null ? income.netIncome / equity : null;
  if (roe != null) {
    if (roe >= 0.20)      { pts += 2; factors.push({ label: 'ROE',        note: `${(roe*100).toFixed(1)}% — exceptional`,       good: true  }); }
    else if (roe >= 0.10) { pts += 1; factors.push({ label: 'ROE',        note: `${(roe*100).toFixed(1)}% — healthy`,            good: true  }); }
    else                  {           factors.push({ label: 'ROE',        note: `${(roe*100).toFixed(1)}% — below threshold`,    good: false }); }
  }

  // FCF Margin
  const fcfM = revenue > 0 && cashflow.freeCashFlow != null ? cashflow.freeCashFlow / revenue : null;
  if (fcfM != null) {
    if (fcfM >= 0.15)      { pts += 2; factors.push({ label: 'FCF Margin', note: `${(fcfM*100).toFixed(1)}% — strong cash generation`, good: true  }); }
    else if (fcfM >= 0.05) { pts += 1; factors.push({ label: 'FCF Margin', note: `${(fcfM*100).toFixed(1)}% — positive`,               good: true  }); }
    else                   {           factors.push({ label: 'FCF Margin', note: `${(fcfM*100).toFixed(1)}% — weak`,                    good: false }); }
  }

  // Debt / Equity
  const de = equity > 0 && debt != null ? debt / equity : null;
  if (de != null) {
    if (de <= 0.5)      { pts += 2; factors.push({ label: 'Leverage', note: `D/E ${de.toFixed(2)} — low debt`,      good: true  }); }
    else if (de <= 1.5) { pts += 1; factors.push({ label: 'Leverage', note: `D/E ${de.toFixed(2)} — moderate`,      good: true  }); }
    else                {           factors.push({ label: 'Leverage', note: `D/E ${de.toFixed(2)} — elevated debt`, good: false }); }
  }

  // Net Margin
  const nm = revenue > 0 && income.netIncome != null ? income.netIncome / revenue : null;
  if (nm != null) {
    if (nm >= 0.15)      { pts += 2; factors.push({ label: 'Net Margin', note: `${(nm*100).toFixed(1)}% — high profitability`, good: true  }); }
    else if (nm >= 0.05) { pts += 1; factors.push({ label: 'Net Margin', note: `${(nm*100).toFixed(1)}% — profitable`,         good: true  }); }
    else                 {           factors.push({ label: 'Net Margin', note: `${(nm*100).toFixed(1)}% — thin margins`,        good: false }); }
  }

  if (factors.length === 0) return null;

  const maxPts = factors.length * 2;
  const ratio  = maxPts > 0 ? pts / maxPts : 0;

  const headline =
    ratio >= 0.75 ? 'Strong cash generation and low leverage suggest potential undervaluation vs. sector peers.' :
    ratio >= 0.50 ? 'Solid fundamentals with moderate valuation — reasonable risk/reward at current price.' :
    ratio >= 0.25 ? 'Mixed signals: profitability diverges from balance sheet health. Caution warranted.' :
                    'Elevated leverage and weak FCF create risk. Stress-test DCF assumptions before committing.';

  const orbColor =
    ratio >= 0.75 ? '#34d399' :
    ratio >= 0.50 ? '#6366f1' :
    ratio >= 0.25 ? '#fbbf24' :
                    '#f87171';

  return { pts, maxPts, ratio, headline, factors, orbColor };
}

export default function NeuralAlpha({ company, financials }) {
  const [open, setOpen] = useState(false);

  const analysis = useMemo(
    () => (company && financials ? analyzeStock(company, financials) : null),
    [company, financials]
  );

  if (!analysis) return null;

  const { pts, maxPts, headline, factors, orbColor } = analysis;

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Neural Alpha — local fundamental analysis"
        title="Neural Alpha"
        style={{
          width:        8,
          height:       8,
          borderRadius: '50%',
          background:   orbColor,
          boxShadow:    `0 0 8px 3px ${orbColor}80`,
          animation:    'neural-pulse 2.5s ease-in-out infinite',
          border:       'none',
          cursor:       'pointer',
          padding:      0,
          flexShrink:   0,
          display:      'block',
        }}
      />

      {open && (
        <>
          {/* Backdrop — clicking outside closes the card */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Insight card */}
          <div
            className="absolute left-4 top-5 z-50 w-72 rounded-xl p-4"
            style={{
              background:           'rgba(11,13,21,0.95)',
              backdropFilter:       'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border:               '1px solid rgba(255,255,255,0.10)',
              boxShadow:            '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: orbColor, boxShadow: `0 0 6px 1px ${orbColor}`, flexShrink: 0 }} />
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Neural Alpha</span>
              <span className="ml-auto text-[10px] font-mono font-semibold" style={{ color: orbColor }}>
                {pts}/{maxPts}
              </span>
            </div>

            {/* Headline insight */}
            <p className="text-xs text-gray-300 leading-relaxed mb-3">{headline}</p>

            {/* Factor breakdown */}
            <div className="space-y-1.5 mb-3">
              {factors.map(f => (
                <div key={f.label} className="flex items-start gap-2">
                  <span style={{ color: f.good ? '#34d399' : '#f87171', fontSize: 7, marginTop: 4, flexShrink: 0 }}>●</span>
                  <span className="text-[10px] text-gray-500 leading-snug">
                    <span className="text-gray-400 font-medium">{f.label}:</span> {f.note}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-gray-700 leading-relaxed border-t border-white/[0.06] pt-2">
              Local scoring model only. Not financial advice.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
