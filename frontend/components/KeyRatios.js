import { useMemo } from 'react';
import FinancialSkeleton from './FinancialSkeleton';
import RatioHeatmap from './RatioHeatmap';
import { useSpatialHaptic } from '../lib/useSpatialHaptic';

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
  const ref = useSpatialHaptic(0.2);
  return (
    <div className="card" ref={ref}>
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="divide-y divide-white/[0.04]">
        {rows.map(({ label, value, badge, note, heatmap }, i) => (
          <div
            key={label}
            className="stagger-row flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3"
            style={{ '--i': i }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{label}</p>
              {note && <p className="text-[10px] text-gray-600 mt-0.5">{note}</p>}
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {/* Heatmap hidden on small screens to keep rows legible */}
              {heatmap && (
                <div className="hidden sm:flex">
                  <RatioHeatmap {...heatmap} />
                </div>
              )}
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
      {/* Labels in their own fixed row — zero overlap with bars regardless of bar height */}
      <div className="flex gap-1 mb-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex-1 text-center">
            {v != null && !isNaN(v) ? (
              <span className={`text-[9px] font-mono font-medium block leading-tight ${
                v >= 0 ? 'text-brand-400' : 'text-red-400'
              }`}>
                {pct(v)}
              </span>
            ) : (
              <span className="text-[9px] block">&nbsp;</span>
            )}
          </div>
        ))}
      </div>
      {/* Bars grow from the bottom */}
      <div className="flex items-end gap-1 h-10">
        {values.map((v, i) => {
          if (v == null || isNaN(v)) return <div key={i} className="flex-1 bg-gray-800 rounded-sm h-1" />;
          const height = Math.max(4, Math.abs(v / max) * 40);
          const color  = v >= 0 ? 'bg-brand-500' : 'bg-red-500';
          return (
            <div key={i} className={`flex-1 rounded-sm ${color}`} style={{ height: `${height}px` }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KeyRatios({ financials, company }) {
  const ratios = useMemo(() => {
    try { return computeRatios(financials, company); }
    catch { return null; }
  }, [financials, company]);

  if (!financials) {
    return <FinancialSkeleton />;
  }

  if (!ratios) {
    return (
      <div className="card mb-6">
        <p className="text-sm text-gray-600">Financial data unavailable.</p>
      </div>
    );
  }

  const { val, prof, health, cf, trends, ranges } = ratios;

  // Helper: return historical heatmap if range available, otherwise benchmark, otherwise null
  function h(value, historical, benchmark) {
    if (historical) return { value, ...historical };
    if (benchmark)  return { value, ...benchmark };
    return null;
  }

  return (
    <div className="space-y-4 mb-6">

      {/* Valuation — benchmark ranges (no 5Y price history) */}
      <Section
        title="Valuation"
        rows={[
          {
            label:   'P/E Ratio',
            value:   val.pe != null ? x(val.pe, 1) : '—',
            badge:   rate(val.pe, { goodBelow: 20, okBelow: 35 }),
            note:    'Price ÷ Earnings per Share',
            heatmap: val.pe != null ? { value: val.pe, min: 5, max: 60, higherIsBetter: false } : null,
          },
          {
            label:   'Price / Sales',
            value:   val.ps != null ? x(val.ps, 1) : '—',
            badge:   rate(val.ps, { goodBelow: 3, okBelow: 8 }),
            note:    'Market Cap ÷ Revenue',
            heatmap: val.ps != null ? { value: val.ps, min: 0, max: 20, higherIsBetter: false } : null,
          },
          {
            label:   'Price / Book',
            value:   val.pb != null ? x(val.pb, 1) : '—',
            badge:   rate(val.pb, { goodBelow: 3, okBelow: 7 }),
            note:    'Market Cap ÷ Shareholders\' Equity',
            heatmap: val.pb != null ? { value: val.pb, min: 0, max: 15, higherIsBetter: false } : null,
          },
          {
            label:   'EV / EBITDA',
            value:   val.evEbitda != null ? x(val.evEbitda, 1) : '—',
            badge:   rate(val.evEbitda, { goodBelow: 12, okBelow: 20 }),
            note:    'Enterprise Value ÷ EBITDA',
            heatmap: val.evEbitda != null ? { value: val.evEbitda, min: 0, max: 35, higherIsBetter: false } : null,
          },
          {
            label:   'Market Cap',
            value:   fmtB(company?.marketCap),
            badge:   null,
            heatmap: null,
          },
        ]}
      />

      {/* Profitability — historical ranges from 5Y financial data */}
      <Section
        title="Profitability"
        rows={[
          {
            label:   'Gross Margin',
            value:   pct(prof.grossMargin),
            badge:   rate(prof.grossMargin, { goodAbove: 0.40, okAbove: 0.20 }),
            heatmap: h(prof.grossMargin, ranges.grossMargin,
                       { min: 0, max: 0.80, higherIsBetter: true }),
          },
          {
            label:   'Operating Margin',
            value:   pct(prof.opMargin),
            badge:   rate(prof.opMargin, { goodAbove: 0.15, okAbove: 0.05 }),
            heatmap: h(prof.opMargin, ranges.opMargin,
                       { min: -0.05, max: 0.40, higherIsBetter: true }),
          },
          {
            label:   'Net Profit Margin',
            value:   pct(prof.netMargin),
            badge:   rate(prof.netMargin, { goodAbove: 0.10, okAbove: 0.03 }),
            heatmap: h(prof.netMargin, ranges.netMargin,
                       { min: -0.05, max: 0.35, higherIsBetter: true }),
          },
          {
            label:   'EBITDA Margin',
            value:   pct(prof.ebitdaMargin),
            badge:   rate(prof.ebitdaMargin, { goodAbove: 0.20, okAbove: 0.10 }),
            heatmap: h(prof.ebitdaMargin, ranges.ebitdaMargin,
                       { min: 0, max: 0.50, higherIsBetter: true }),
          },
          {
            label:   'Return on Equity (ROE)',
            value:   pct(prof.roe),
            badge:   rate(prof.roe, { goodAbove: 0.15, okAbove: 0.08 }),
            note:    'Net Income ÷ Shareholders\' Equity',
            heatmap: h(prof.roe, ranges.roe,
                       { min: 0, max: 0.40, higherIsBetter: true }),
          },
          {
            label:   'Return on Assets (ROA)',
            value:   pct(prof.roa),
            badge:   rate(prof.roa, { goodAbove: 0.07, okAbove: 0.03 }),
            note:    'Net Income ÷ Total Assets',
            heatmap: h(prof.roa, ranges.roa,
                       { min: 0, max: 0.20, higherIsBetter: true }),
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
            <TrendRow label="Gross Margin"     values={trends.grossMargins} />
            <TrendRow label="Operating Margin" values={trends.opMargins} />
            <TrendRow label="Net Margin"        values={trends.netMargins} />
          </div>
        </div>
      )}

      {/* Financial Health — historical ranges from 5Y balance sheet */}
      <Section
        title="Financial Health"
        rows={[
          {
            label:   'Current Ratio',
            value:   health.currentRatio != null ? num(health.currentRatio) : '—',
            badge:   rate(health.currentRatio, { goodAbove: 2, okAbove: 1 }),
            note:    'Current Assets ÷ Current Liabilities',
            heatmap: h(health.currentRatio, ranges.currentRatio,
                       { min: 0, max: 5, higherIsBetter: true }),
          },
          {
            label:   'Debt / Equity',
            value:   health.debtEquity != null ? num(health.debtEquity) : '—',
            badge:   rate(health.debtEquity, { goodBelow: 0.5, okBelow: 1.5 }),
            note:    'Total Debt ÷ Shareholders\' Equity',
            heatmap: h(health.debtEquity, ranges.debtEquity,
                       { min: 0, max: 3, higherIsBetter: false }),
          },
          {
            label:   'Debt / Assets',
            value:   health.debtAssets != null ? num(health.debtAssets) : '—',
            badge:   rate(health.debtAssets, { goodBelow: 0.3, okBelow: 0.6 }),
            heatmap: h(health.debtAssets, ranges.debtAssets,
                       { min: 0, max: 0.8, higherIsBetter: false }),
          },
          {
            label:   'Net Debt',
            value:   fmtB(health.netDebt),
            badge:   null,
            note:    'Total Debt − Cash & Equivalents',
            heatmap: null,
          },
          {
            label:   'Cash & Equivalents',
            value:   fmtB(health.cash),
            badge:   null,
            heatmap: null,
          },
        ]}
      />

      {/* Cash Flow Quality */}
      <Section
        title="Cash Flow Quality"
        rows={[
          {
            label:   'FCF Margin',
            value:   pct(cf.fcfMargin),
            badge:   rate(cf.fcfMargin, { goodAbove: 0.10, okAbove: 0.03 }),
            note:    'Free Cash Flow ÷ Revenue',
            heatmap: h(cf.fcfMargin, ranges.fcfMargin,
                       { min: -0.05, max: 0.30, higherIsBetter: true }),
          },
          {
            label:   'Operating Cash Flow',
            value:   fmtB(cf.ocf),
            badge:   null,
            heatmap: null,
          },
          {
            label:   'Free Cash Flow',
            value:   fmtB(cf.fcf),
            badge:   cf.fcf != null ? (cf.fcf > 0 ? 'good' : 'weak') : 'neutral',
            heatmap: null,
          },
          {
            label:   'OCF / Net Income',
            value:   cf.ocfToNI != null ? num(cf.ocfToNI) : '—',
            badge:   rate(cf.ocfToNI, { goodAbove: 1.0, okAbove: 0.7 }),
            note:    '>1 means earnings are well-backed by cash',
            heatmap: cf.ocfToNI != null
              ? { value: cf.ocfToNI, min: 0, max: 2.5, higherIsBetter: true }
              : null,
          },
          {
            label:   'CapEx / Revenue',
            value:   pct(cf.capexRatio),
            badge:   null,
            heatmap: null,
          },
        ]}
      />

    </div>
  );
}

// ── Ratio computation ─────────────────────────────────────────────────────────

function histRange(arr) {
  const valid = arr.filter(v => v != null && isFinite(v) && !isNaN(v));
  if (valid.length < 2) return null;
  return { min: Math.min(...valid), max: Math.max(...valid), higherIsBetter: undefined };
}

function computeRatios(financials, company) {
  if (!financials) return null;

  const incomeArr   = financials.income   || [];
  const balanceArr  = financials.balance  || [];
  const cashflowArr = financials.cashflow || [];

  const income   = incomeArr[0]   || {};
  const balance  = balanceArr[0]  || {};
  const cashflow = cashflowArr[0] || {};

  const price    = company?.price;
  const mktCap   = company?.marketCap;

  const revenue   = income.revenue;
  const ebitda    = income.ebitda;
  const equity    = balance.shareholdersEquity;
  const totalDebt = balance.totalDebt;
  const cash      = balance.cashAndEquivalents;
  const ev        = mktCap != null && totalDebt != null && cash != null
    ? mktCap + totalDebt - cash : null;

  const val = {
    pe:       company?.peRatio ?? (price != null && income.eps ? div(price, income.eps) : null),
    ps:       company?.psRatio ?? div(mktCap, revenue),
    pb:       company?.pbRatio ?? div(mktCap, equity),
    evEbitda: company?.evEbitda ?? div(ev, ebitda),
  };

  const prof = {
    grossMargin:  income.grossMargin,
    opMargin:     income.operatingMargin,
    netMargin:    income.netMargin,
    ebitdaMargin: div(ebitda, revenue),
    roe:          div(income.netIncome, equity),
    roa:          div(income.netIncome, balance.totalAssets),
  };

  const health = {
    currentRatio: div(balance.totalCurrentAssets, balance.totalCurrentLiabilities),
    debtEquity:   div(totalDebt, equity),
    debtAssets:   div(totalDebt, balance.totalAssets),
    netDebt:      balance.netDebt,
    cash,
  };

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
  const trendYrs = incomeArr.slice(0, 3);
  const trends = {
    years:        trendYrs.map(y => y.date?.slice(0, 4)).filter(Boolean),
    grossMargins: trendYrs.map(y => y.grossMargin),
    opMargins:    trendYrs.map(y => y.operatingMargin),
    netMargins:   trendYrs.map(y => y.netMargin),
  };

  // Historical ranges for heatmaps — zips income[i] with balance[i] by array position
  const len = Math.min(incomeArr.length, balanceArr.length, cashflowArr.length);
  const ranges = {
    grossMargin:  histRange(incomeArr.map(y => y.grossMargin)),
    opMargin:     histRange(incomeArr.map(y => y.operatingMargin)),
    netMargin:    histRange(incomeArr.map(y => y.netMargin)),
    ebitdaMargin: histRange(incomeArr.map(y => y.revenue ? div(y.ebitda, y.revenue) : null)),
    roe:          histRange(Array.from({ length: len }, (_, i) =>
      div(incomeArr[i]?.netIncome, balanceArr[i]?.shareholdersEquity)
    )),
    roa:          histRange(Array.from({ length: len }, (_, i) =>
      div(incomeArr[i]?.netIncome, balanceArr[i]?.totalAssets)
    )),
    currentRatio: histRange(Array.from({ length: len }, (_, i) =>
      div(balanceArr[i]?.totalCurrentAssets, balanceArr[i]?.totalCurrentLiabilities)
    )),
    debtEquity:   histRange(Array.from({ length: len }, (_, i) =>
      div(balanceArr[i]?.totalDebt, balanceArr[i]?.shareholdersEquity)
    )),
    debtAssets:   histRange(Array.from({ length: len }, (_, i) =>
      div(balanceArr[i]?.totalDebt, balanceArr[i]?.totalAssets)
    )),
    fcfMargin:    histRange(Array.from({ length: len }, (_, i) =>
      div(cashflowArr[i]?.freeCashFlow, incomeArr[i]?.revenue)
    )),
  };

  // Attach higherIsBetter direction to each historical range
  if (ranges.grossMargin)  ranges.grossMargin.higherIsBetter  = true;
  if (ranges.opMargin)     ranges.opMargin.higherIsBetter     = true;
  if (ranges.netMargin)    ranges.netMargin.higherIsBetter    = true;
  if (ranges.ebitdaMargin) ranges.ebitdaMargin.higherIsBetter = true;
  if (ranges.roe)          ranges.roe.higherIsBetter          = true;
  if (ranges.roa)          ranges.roa.higherIsBetter          = true;
  if (ranges.currentRatio) ranges.currentRatio.higherIsBetter = true;
  if (ranges.debtEquity)   ranges.debtEquity.higherIsBetter   = false;
  if (ranges.debtAssets)   ranges.debtAssets.higherIsBetter   = false;
  if (ranges.fcfMargin)    ranges.fcfMargin.higherIsBetter    = true;

  return { val, prof, health, cf, trends, ranges };
}
