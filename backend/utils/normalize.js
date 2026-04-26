/**
 * Normalization Layer
 * Converts raw API data into a consistent, clean format.
 * Handles missing fields, null values, and different response shapes.
 */

// Safely parse any value as a number — returns null if invalid
function safeNum(val, fallback = null) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// Safely parse a string — returns empty string if invalid
function safeStr(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim() || fallback;
}

// ─── Company Profile ──────────────────────────────────────────────────────────

function normalizeCompany(fmpData) {
  // Handle both array and object responses
  const raw = Array.isArray(fmpData) ? fmpData : [fmpData];
  if (!raw || !raw.length || !raw[0]) return null;
  const d = raw[0];

  return {
    ticker:      safeStr(d.symbol).toUpperCase(),
    name:        safeStr(d.companyName || d.name),
    exchange:    safeStr(d.exchangeShortName || d.exchange),
    sector:      safeStr(d.sector),
    industry:    safeStr(d.industry),
    description: safeStr(d.description),
    ceo:         safeStr(d.ceo),
    employees:   safeNum(d.fullTimeEmployees),
    website:     safeStr(d.website),
    country:     safeStr(d.country),
    currency:    safeStr(d.currency) || 'USD',
    price:       safeNum(d.price),
    marketCap:   safeNum(d.mktCap) || (() => {
      const p = safeNum(d.price), s = safeNum(d.sharesOutstanding);
      return (p && s) ? p * s : null;
    })(),
    beta:        safeNum(d.beta),
    sharesOutstanding: safeNum(d.sharesOutstanding),
  };
}

// ─── Income Statement ─────────────────────────────────────────────────────────

function normalizeIncomeStatement(data) {
  const arr = Array.isArray(data) ? data : (data?.financials || []);
  if (!arr.length) return [];

  return arr.map((d) => {
    const revenue         = safeNum(d.revenue);
    const grossProfit     = safeNum(d.grossProfit);
    const operatingIncome = safeNum(d.operatingIncome);
    const netIncome       = safeNum(d.netIncome);

    // Calculate margins from raw numbers (stable API doesn't return ratio fields)
    // Guard: null / revenue = 0 in JS, which is a silent wrong value — check both
    const ratio = (num) => (revenue && num != null) ? safeNum((num / revenue).toFixed(4)) : null;

    return {
      date:               safeStr(d.date),
      period:             safeStr(d.period) || 'FY',
      revenue,
      costOfRevenue:      safeNum(d.costOfRevenue),
      grossProfit,
      grossMargin:        safeNum(d.grossProfitRatio) ?? ratio(grossProfit),
      operatingExpenses:  safeNum(d.operatingExpenses),
      operatingIncome,
      operatingMargin:    safeNum(d.operatingIncomeRatio) ?? ratio(operatingIncome),
      ebitda:             safeNum(d.ebitda),
      netIncome,
      netMargin:          safeNum(d.netIncomeRatio) ?? ratio(netIncome),
      eps:                safeNum(d.eps),
      epsDiluted:         safeNum(d.epsDiluted),
      sharesOutstanding:  safeNum(d.weightedAverageShsOut),
    };
  });
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

function normalizeBalanceSheet(data) {
  const arr = Array.isArray(data) ? data : (data?.financials || []);
  if (!arr.length) return [];

  return arr.map((d) => ({
    date:                  safeStr(d.date),
    period:                safeStr(d.period) || 'FY',
    cashAndEquivalents:    safeNum(d.cashAndCashEquivalents),
    shortTermInvestments:  safeNum(d.shortTermInvestments),
    totalCurrentAssets:    safeNum(d.totalCurrentAssets),
    totalAssets:           safeNum(d.totalAssets),
    totalCurrentLiabilities: safeNum(d.totalCurrentLiabilities),
    totalLiabilities:      safeNum(d.totalLiabilities),
    longTermDebt:          safeNum(d.longTermDebt),
    totalDebt:             safeNum(d.totalDebt),
    shareholdersEquity:    safeNum(d.totalStockholdersEquity),
    retainedEarnings:      safeNum(d.retainedEarnings),
    netDebt:               safeNum(d.netDebt),
  }));
}

// ─── Cash Flow Statement ──────────────────────────────────────────────────────

function normalizeCashFlow(data) {
  const arr = Array.isArray(data) ? data : (data?.financials || []);
  if (!arr.length) return [];

  return arr.map((d) => ({
    date:               safeStr(d.date),
    period:             safeStr(d.period) || 'FY',
    operatingCashFlow:  safeNum(d.operatingCashFlow),
    capitalExpenditure: safeNum(d.capitalExpenditure),
    freeCashFlow:       safeNum(d.freeCashFlow),
    investingCashFlow:  safeNum(d.netCashUsedForInvestingActivites),
    financingCashFlow:  safeNum(d.netCashUsedProvidedByFinancingActivities),
    netChangeInCash:    safeNum(d.netChangeInCash),
    stockRepurchase:    safeNum(d.commonStockRepurchased),
    dividendsPaid:      safeNum(d.dividendsPaid),
  }));
}

// ─── Historical Prices ────────────────────────────────────────────────────────

function normalizeHistoricalPrices(data) {
  // Handle: { historical: [...] }  OR  plain array
  let arr = [];
  if (!data) return [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data.historical && Array.isArray(data.historical)) {
    arr = data.historical;
  } else if (data.results && Array.isArray(data.results)) {
    // Polygon format fallback
    arr = data.results;
  } else {
    return [];
  }

  return arr
    .map((d) => ({
      date:   safeStr(d.date || d.t),
      open:   safeNum(d.open  || d.o),
      high:   safeNum(d.high  || d.h),
      low:    safeNum(d.low   || d.l),
      close:  safeNum(d.close || d.c),
      volume: safeNum(d.volume || d.v),
    }))
    .filter((d) => d.date && d.close !== null)
    .reverse(); // oldest → newest for charting
}

module.exports = {
  normalizeCompany,
  normalizeIncomeStatement,
  normalizeBalanceSheet,
  normalizeCashFlow,
  normalizeHistoricalPrices,
};
