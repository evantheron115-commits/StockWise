import { useState } from 'react';

const TABS = [
  { key: 'income',   label: 'Income Statement' },
  { key: 'balance',  label: 'Balance Sheet' },
  { key: 'cashflow', label: 'Cash Flow' },
];

const INCOME_ROWS = [
  { key: 'revenue',          label: 'Revenue',           money: true },
  { key: 'grossProfit',      label: 'Gross Profit',       money: true },
  { key: 'grossMargin',      label: 'Gross Margin',       pct: true },
  { key: 'operatingIncome',  label: 'Operating Income',   money: true },
  { key: 'operatingMargin',  label: 'Operating Margin',   pct: true },
  { key: 'ebitda',           label: 'EBITDA',             money: true },
  { key: 'netIncome',        label: 'Net Income',         money: true },
  { key: 'netMargin',        label: 'Net Margin',         pct: true },
  { key: 'eps',              label: 'EPS (Basic)',        dollar: true },
];

const BALANCE_ROWS = [
  { key: 'cashAndEquivalents',    label: 'Cash & Equivalents',    money: true },
  { key: 'totalCurrentAssets',    label: 'Total Current Assets',  money: true },
  { key: 'totalAssets',           label: 'Total Assets',          money: true, bold: true },
  { key: 'totalCurrentLiabilities', label: 'Current Liabilities', money: true },
  { key: 'longTermDebt',          label: 'Long-Term Debt',        money: true },
  { key: 'totalLiabilities',      label: 'Total Liabilities',     money: true, bold: true },
  { key: 'shareholdersEquity',    label: "Shareholders' Equity",  money: true, bold: true },
  { key: 'netDebt',               label: 'Net Debt',              money: true },
];

const CASHFLOW_ROWS = [
  { key: 'operatingCashFlow',  label: 'Operating Cash Flow',  money: true, bold: true },
  { key: 'capitalExpenditure', label: 'Capital Expenditure',  money: true },
  { key: 'freeCashFlow',       label: 'Free Cash Flow',       money: true, bold: true },
  { key: 'investingCashFlow',  label: 'Investing Cash Flow',  money: true },
  { key: 'financingCashFlow',  label: 'Financing Cash Flow',  money: true },
  { key: 'dividendsPaid',      label: 'Dividends Paid',       money: true },
  { key: 'stockRepurchase',    label: 'Share Buybacks',       money: true },
];

const ROW_MAP = { income: INCOME_ROWS, balance: BALANCE_ROWS, cashflow: CASHFLOW_ROWS };

function fmt(val, { money, pct, dollar } = {}) {
  if (val == null || isNaN(+val)) return <span className="text-gray-700">—</span>;
  const n = +val;
  if (pct)    return `${(n * 100).toFixed(1)}%`;
  if (dollar) return `$${n.toFixed(2)}`;
  if (money) {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    return `${sign}$${abs.toLocaleString()}`;
  }
  return n.toLocaleString();
}

function growthColor(curr, prev) {
  if (!prev || !curr) return '';
  return curr > prev ? 'up' : curr < prev ? 'down' : '';
}

export default function FinancialTable({ financials }) {
  const [tab, setTab] = useState('income');

  if (!financials) return (
    <div className="card mb-6 text-sm text-gray-600">Financial data unavailable.</div>
  );

  const rows = ROW_MAP[tab];
  const years = financials[tab] || [];
  // Newest year first
  const sorted = [...years].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return (
    <div className="card mb-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 mb-5 gap-1 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`tab whitespace-nowrap ${tab === key ? 'tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-600">No data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left pb-3 text-gray-600 font-normal text-xs w-48">
                  Metric
                </th>
                {sorted.map((y) => (
                  <th key={y.date} className="text-right pb-3 font-mono text-gray-400 font-normal text-xs pr-2">
                    {y.date?.slice(0, 4)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, label, bold, ...fmtOpts }) => (
                <tr
                  key={key}
                  className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
                >
                  <td className={`py-2.5 text-xs ${bold ? 'text-gray-200 font-medium' : 'text-gray-500'}`}>
                    {label}
                  </td>
                  {sorted.map((y, i) => {
                    const val  = y[key];
                    const prev = sorted[i + 1]?.[key];
                    const gc   = !fmtOpts.pct ? growthColor(val, prev) : '';
                    return (
                      <td
                        key={y.date}
                        className={`py-2.5 text-right font-mono text-xs pr-2 ${bold ? 'font-medium' : ''} ${gc}`}
                      >
                        {fmt(val, fmtOpts)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-700 mt-4">
        Figures in USD. Green = year-over-year growth. Red = decline.
      </p>
    </div>
  );
}
