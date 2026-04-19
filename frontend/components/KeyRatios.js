import { useMemo } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n) {
  if (n == null || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function x(n, decimals = 2) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return `${n.toFixed(decimals)}x`;
}

function num(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(decimals);
}

function fmtB(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

function div(a, b) {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

// Rate a ratio: returns 'good' | 'ok' | 'weak' | 'neutral'
function rate(value, { goodAbove, okAbove, goodBelow, okBelow, neutral } = {}) {
  if (value == null || isNaN(value)) return 'neutral';
  if (neutral) return 'neutral';
  if (goodAbove != null) {
    if (value >= goodAbove) return 'good';
    if (okAbove != null && value >= okAbove) return 'ok';
    return 'weak';
  }
  if (goodBelow != null) {
    if (value <= goodBelow) return 'good';
    if (okBelow != null && value <= okBelow) return 'ok';
    return 'weak';
  }
  return 'neutral';
}

const RATING_STYLES = {
  good:    'text-emerald-400 bg-emerald-400/10',
  ok:      'text-amber-400   bg-amber-400/10',
  weak:    'text-red-400     bg-red-400/10',
  neutral: 'text-gray-500    bg-gray-800',
};

const RATING_LABELS = { good: 'Strong', ok: 'Fair', weak: 'Weak', neutral: '—' };

function Badge({ rating }) {
  if (!rating || rating === 'neutral') return null;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${RATING_STYLES[rating]}`}>
      {RATING_LABELS[rating]}
    </span>
  );
}

// ── Section component ─────────────────────────────────────────────────────────

function Section({ title, rows }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="divide-y divide-white/[0.04]">
        {rows.map(({ label, value, badge, note }) => (
          <div key={label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{label}</p>
              {note && <p className="text-[10px] text-gray-600 mt-0.5">{note}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-sm text-gray-200">{value}</span>
              {badge && <Badge rating={badge} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trend bar: shows last 3 years of a margin ─────────────────────────────────

function TrendRow({ label, values }) {
  const valid = values.filter((v) => v != null && !isNaN(v));
  if (!valid.length) return null;

  const max = Math.max(...valid.map(Math.abs), 0.01);

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-1 h-10">
        {values.map((v, i) => {
          if (v == null) return <div key={i} className="flex-1 bg-gray-800 rounded-sm h-1" />;
          const height = Math.max(4, Math.abs(v / max) * 40);
          const color  = v >= 0 ? 'bg-brand-500' : 'bg-red-500';
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-[9px] text-gray-600">{pct(v)}</span>
              <div className={`w-full rounded-sm ${color}`} style={{ height: `${height}px` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KeyRatios({ financials, company }) {
  const ratios = useMemo(() => computeRatios(financials, company), [financials, company]);

  if (!financials) {
    return (
      <div className="space-y-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="skeleton h-4 w-32 mb-4" />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex justify-between py-2">
                <div className="skeleton h-3 w-28" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!ratios) {
    return (
      <div className="card mb-6">
        <p className="text-sm text-gray-600">Financial data unavailable.</p>
      </div>
    );
  }

  const { val, prof, health, cf, trends } = ratios;

  return (
    <div className="space-y-4 mb-6">

      {/* Valuation */}
      <Section
        title="Valuation"
        rows={[
          {
            label: 'P/E Ratio',
            value: val.pe != null ? x(val.pe, 1) : '—',
            badge: rate(val.pe, { goodBelow: 20, okBelow: 35 }),
            note:  'Price ÷ Earnings per Share',
          },
          {
            label: 'Price / Sales',
            value: val.ps != null ? x(val.ps, 1) : '—',
            badge: rate(val.ps, { goodBelow: 3, okBelow: 8 }),
            note:  'Market Cap ÷ Revenue',
          },
          {
            label: 'Price / Book',
            value: val.pb != null ? x(val.pb, 1) : '—',
            badge: rate(val.pb, { goodBelow: 3, okBelow: 7 }),
            note:  'Market Cap ÷ Shareholders\' Equity',
          },
          {
            label: 'EV / EBITDA',
            value: val.evEbitda != null ? x(val.evEbitda, 1) : '—',
            badge: rate(val.evEbitda, { goodBelow: 12, okBelow: 20 }),
            note:  'Enterprise Value ÷ EBITDA',
          },
          {
            label: 'Market Cap',
            value: fmtB(company?.marketCap),
            badge: null,
          },
        ]}
      />

      {/* Profitability */}
      <Section
        title="Profitability"
        rows={[
          {
            label: 'Gross Margin',
            value: pct(prof.grossMargin),
            badge: rate(prof.grossMargin, { goodAbove: 0.40, okAbove: 0.20 }),
          },
          {
            label: 'Operating Margin',
            value: pct(prof.opMargin),
            badge: rate(prof.opMargin, { goodAbove: 0.15, okAbove: 0.05 }),
          },
          {
            label: 'Net Profit Margin',
            value: pct(prof.netMargin),
            badge: rate(prof.netMargin, { goodAbove: 0.10, okAbove: 0.03 }),
          },
          {
            label: 'EBITDA Margin',
            value: pct(prof.ebitdaMargin),
            badge: rate(prof.ebitdaMargin, { goodAbove: 0.20, okAbove: 0.10 }),
          },
          {
            label: 'Return on Equity (ROE)',
            value: pct(prof.roe),
            badge: rate(prof.roe, { goodAbove: 0.15, okAbove: 0.08 }),
            note:  'Net Income ÷ Shareholders\' Equity',
          },
          {
            label: 'Return on Assets (ROA)',
            value: pct(prof.roa),
            badge: rate(prof.roa, { goodAbove: 0.07, okAbove: 0.03 }),
            note:  'Net Income ÷ Total Assets',
          },
        ]}
      />

      {/* Margin Trends */}
      {trends.years.length > 1 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">
            Margin Trends
            <span className="text-xs font-normal text-gray-600 ml-2">
              {trends.years.join(' · ')}
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <TrendRow label="Gross Margin"    values={trends.grossMargins} />
            <TrendRow label="Operating Margin" values={trends.opMargins} />
            <TrendRow label="Net Margin"       values={trends.netMargins} />
          </div>
        </div>
      )}

      {/* Financial Health */}
      <Section
        title="Financial Health"
        rows={[
          {
            label: 'Current Ratio',
            value: health.currentRatio != null ? num(health.currentRatio) : '—',
            badge: rate(health.currentRatio, { goodAbove: 2, okAbove: 1 }),
            note:  'Current Assets ÷ Current Liabilities',
          },
          {
            label: 'Debt / Equity',
            value: health.debtEquity != null ? num(health.debtEquity) : '—',
            badge: rate(health.debtEquity, { goodBelow: 0.5, okBelow: 1.5 }),
            note:  'Total Debt ÷ Shareholders\' Equity',
          },
          {
            label: 'Debt / Assets',
            value: health.debtAssets != null ? num(health.debtAssets) : '—',
            badge: rate(health.debtAssets, { goodBelow: 0.3, okBelow: 0.6 }),
          },
          {
            label: 'Net Debt',
            value: fmtB(health.netDebt),
            badge: null,
            note:  'Total Debt − Cash & Equivalents',
          },
          {
            label: 'Cash & Equivalents',
            value: fmtB(health.cash),
            badge: null,
          },
        ]}
      />

      {/* Cash Flow Quality */}
      <Section
        title="Cash Flow Quality"
        rows={[
          {
            label: 'FCF Margin',
            value: pct(cf.fcfMargin),
            badge: rate(cf.fcfMargin, { goodAbove: 0.10, okAbove: 0.03 }),
            note:  'Free Cash Flow ÷ Revenue',
          },
          {
            label: 'Operating Cash Flow',
            value: fmtB(cf.ocf),
            badge: null,
          },
          {
            label: 'Free Cash Flow',
            value: fmtB(cf.fcf),
            badge: cf.fcf != null ? (cf.fcf > 0 ? 'good' : 'weak') : 'neutral',
          },
          {
            label: 'OCF / Net Income',
            value: cf.ocfToNI != null ? num(cf.ocfToNI) : '—',
            badge: rate(cf.ocfToNI, { goodAbove: 1.0, okAbove: 0.7 }),
            note:  '>1 means earnings are well-backed by cash',
          },
          {
            label: 'CapEx / Revenue',
            value: pct(cf.capexRatio),
            badge: null,
          },
        ]}
      />

    </div>
  );
}

// ── Ratio computation ─────────────────────────────────────────────────────────

function computeRatios(financials, company) {
  if (!financials) return null;

  const income   = financials.income?.[0]   || {};
  const balance  = financials.balance?.[0]  || {};
  const cashflow = financials.cashflow?.[0] || {};

  const price     = company?.price;
  const mktCap    = company?.marketCap;

  // Valuation
  const revenue  = income.revenue;
  const ebitda   = income.ebitda;
  const equity   = balance.shareholdersEquity;
  const totalDebt = balance.totalDebt;
  const cash     = balance.cashAndEquivalents;
  const ev       = mktCap != null && totalDebt != null && cash != null
    ? mktCap + totalDebt - cash
    : null;

  const val = {
    pe:      company?.peRatio ?? (price != null && income.eps ? div(price, income.eps) : null),
    ps:      div(mktCap, revenue),
    pb:      div(mktCap, equity),
    evEbitda: div(ev, ebitda),
  };

  // Profitability (use most recent year)
  const prof = {
    grossMargin:  income.grossMargin,
    opMargin:     income.operatingMargin,
    netMargin:    income.netMargin,
    ebitdaMargin: div(ebitda, revenue),
    roe:          div(income.netIncome, equity),
    roa:          div(income.netIncome, balance.totalAssets),
  };

  // Financial Health
  const health = {
    currentRatio: div(balance.totalCurrentAssets, balance.totalCurrentLiabilities),
    debtEquity:   div(totalDebt, equity),
    debtAssets:   div(totalDebt, balance.totalAssets),
    netDebt:      balance.netDebt,
    cash,
  };

  // Cash Flow
  const ocf = cashflow.operatingCashFlow;
  const fcf = cashflow.freeCashFlow;
  const cf = {
    ocf,
    fcf,
    fcfMargin:  div(fcf, revenue),
    ocfToNI:    div(ocf, income.netIncome),
    capexRatio: div(
      cashflow.capitalExpenditure != null ? Math.abs(cashflow.capitalExpenditure) : null,
      revenue
    ),
  };

  // Margin trends (last 3 years)
  const years      = (financials.income || []).slice(0, 3);
  const trendYears = years.map((y) => y.date?.slice(0, 4)).filter(Boolean);

  const trends = {
    years:        trendYears,
    grossMargins: years.map((y) => y.grossMargin),
    opMargins:    years.map((y) => y.operatingMargin),
    netMargins:   years.map((y) => y.netMargin),
  };

  return { val, prof, health, cf, trends };
}
