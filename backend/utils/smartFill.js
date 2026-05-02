'use strict';

// Sector-indexed default profiles used by DCF autopilot.
// Conservative median assumptions; not investment advice.
const SECTOR_PROFILES = {
  'Technology':             { growthRate: 0.10, discountRate: 0.10, terminalGrowth: 0.03  },
  'Healthcare':             { growthRate: 0.08, discountRate: 0.09, terminalGrowth: 0.025 },
  'Consumer Cyclical':      { growthRate: 0.07, discountRate: 0.10, terminalGrowth: 0.025 },
  'Consumer Defensive':     { growthRate: 0.05, discountRate: 0.08, terminalGrowth: 0.025 },
  'Financial Services':     { growthRate: 0.07, discountRate: 0.10, terminalGrowth: 0.025 },
  'Industrials':            { growthRate: 0.07, discountRate: 0.09, terminalGrowth: 0.025 },
  'Energy':                 { growthRate: 0.05, discountRate: 0.10, terminalGrowth: 0.02  },
  'Utilities':              { growthRate: 0.03, discountRate: 0.07, terminalGrowth: 0.02  },
  'Real Estate':            { growthRate: 0.05, discountRate: 0.08, terminalGrowth: 0.025 },
  'Communication Services': { growthRate: 0.08, discountRate: 0.10, terminalGrowth: 0.03  },
  'Basic Materials':        { growthRate: 0.05, discountRate: 0.09, terminalGrowth: 0.02  },
};
const DEFAULT_PROFILE = { growthRate: 0.08, discountRate: 0.10, terminalGrowth: 0.025 };

// FCF margin proxies used when no cash-flow statement is available
const SECTOR_FCF_MARGINS = {
  'Technology':             0.18,
  'Healthcare':             0.12,
  'Consumer Cyclical':      0.06,
  'Consumer Defensive':     0.07,
  'Financial Services':     0.15,
  'Industrials':            0.08,
  'Energy':                 0.10,
  'Utilities':              0.09,
  'Real Estate':            0.20,
  'Communication Services': 0.14,
  'Basic Materials':        0.08,
};

function matchSector(sector, map) {
  if (!sector) return null;
  const lower = sector.toLowerCase();
  const key   = Object.keys(map).find(
    (k) => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  return key ? map[key] : null;
}

function getSectorProfile(sector) {
  return matchSector(sector, SECTOR_PROFILES) || DEFAULT_PROFILE;
}

// Fill missing scalar metrics in-place on a company object.
// Pass the full financials object (with .income / .balance / .cashflow arrays)
// when available — derived ratios (PS, PB, EV/EBITDA) require them.
// Safe to call multiple times; will not overwrite already-present values.
function fillCompanyMetrics(company, financials) {
  if (!company) return company;

  const income   = financials?.income?.[0]   || {};
  const balance  = financials?.balance?.[0]  || {};

  // EPS — three tiers: income statement field → derived from net income / shares
  if (company.eps == null) {
    const v = income.epsDiluted ?? income.eps ?? null;
    if (v != null) {
      company.eps = v;
    } else if (income.netIncome != null && income.sharesOutstanding > 0) {
      // EDGAR path: income rows carry sharesOutstanding; FMP rows carry epsDiluted.
      // When epsDiluted is absent (common for EDGAR), derive it here.
      company.eps = +(income.netIncome / income.sharesOutstanding).toFixed(4);
    }
  }

  // Market cap
  if (!company.marketCap || company.marketCap <= 0) {
    const shares = income.sharesOutstanding ?? company.sharesOutstanding ?? null;
    if (company.price > 0 && shares > 0)
      company.marketCap = company.price * shares;
  }

  // P/E
  if (!company.peRatio || company.peRatio <= 0 || company.peRatio > 5000) {
    if (company.price > 0 && company.eps > 0)
      company.peRatio = +(company.price / company.eps).toFixed(2);
  }

  // Dividend yield — (dividendPerShare / price) * 100
  if (company.dividendYield == null) {
    const div = company.dividendPerShare ?? income.dividendPerShare ?? null;
    if (div != null && company.price > 0)
      company.dividendYield = +((div / company.price) * 100).toFixed(4);
  }

  // Derived valuation multiples (require market cap + financials)
  if (company.marketCap > 0) {
    const rev    = income.revenue;
    const equity = balance.shareholdersEquity;
    const debt   = balance.totalDebt;
    const cash   = balance.cashAndEquivalents;
    const ebitda = income.ebitda;

    if (company.psRatio == null && rev > 0)
      company.psRatio = +(company.marketCap / rev).toFixed(2);
    if (company.pbRatio == null && equity > 0)
      company.pbRatio = +(company.marketCap / equity).toFixed(2);
    if (company.evEbitda == null && debt != null && cash != null && ebitda > 0)
      company.evEbitda = +((company.marketCap + debt - cash) / ebitda).toFixed(2);
  }

  return company;
}

// Sector target net-income margins for Ascension Model convergence.
// Represents a mature, profitable company in each sector.
const SECTOR_TARGET_MARGINS = {
  'Technology':             0.22,
  'Healthcare':             0.16,
  'Consumer Cyclical':      0.08,
  'Consumer Defensive':     0.09,
  'Financial Services':     0.20,
  'Industrials':            0.10,
  'Energy':                 0.12,
  'Utilities':              0.12,
  'Real Estate':            0.25,
  'Communication Services': 0.16,
  'Basic Materials':        0.10,
};

// Sector-specific FCF/net-income conversion ratios.
// Capital-light software converts above 1x (minimal capex, working capital release).
// Capital-heavy sectors (energy, industrials, materials) convert well below 1x.
const SECTOR_FCF_CONVERSION = {
  'Technology':             1.20,
  'Healthcare':             0.85,
  'Consumer Cyclical':      0.85,
  'Consumer Defensive':     0.85,
  'Financial Services':     0.75,
  'Industrials':            0.35,
  'Energy':                 0.35,
  'Utilities':              0.60,
  'Real Estate':            0.75,
  'Communication Services': 0.90,
  'Basic Materials':        0.35,
};

// Parse a row's date to Unix ms for sorting. FMP may supply .date (ISO string),
// .calendarYear (number), or .fillingDate. Falls back to original array index
// so rows with no date metadata preserve their existing order.
function rowDateMs(row, fallbackIndex) {
  if (row.date) {
    const t = new Date(row.date).getTime();
    if (!isNaN(t)) return t;
  }
  if (row.calendarYear) {
    const t = new Date(`${row.calendarYear}-01-01`).getTime();
    if (!isNaN(t)) return t;
  }
  if (row.fillingDate) {
    const t = new Date(row.fillingDate).getTime();
    if (!isNaN(t)) return t;
  }
  return fallbackIndex;
}

// Ascension Model: synthetic FCF for companies with negative/zero reported FCF.
//
// 1. Revenue CAGR — computed from up to 3 years of income history.
//    Capped at (sector growth rate + 15pp) to prevent fantasy projections.
// 2. Margin expansion — current net margin linearly expands toward the sector
//    target over 5 years.  If the company is already above target, the target
//    is used as the floor (no regression assumed).
// 3. Year-5 synthetic FCF — projected NI × sector FCF conversion ratio.
//
// Returns null if insufficient history to compute a CAGR.
function ascensionFCF(incomeHistory, sector) {
  if (!Array.isArray(incomeHistory) || incomeHistory.length < 2) return null;

  // Sort oldest-first for CAGR; rowDateMs with index fallback handles undated rows
  const sorted = [...incomeHistory]
    .filter((r) => r?.revenue > 0)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rowDateMs(a.r, a.i) - rowDateMs(b.r, b.i))
    .map(({ r }) => r);

  if (sorted.length < 2) return null;

  const latest = sorted[sorted.length - 1];
  const base   = sorted[Math.max(0, sorted.length - 4)]; // up to 3 years back
  const years  = Math.min(sorted.length - 1, 3);

  // Revenue CAGR
  const rawCAGR = Math.pow(latest.revenue / base.revenue, 1 / years) - 1;
  const profile = getSectorProfile(sector);
  const cagrCap = profile.growthRate + 0.15;
  const cagr    = Math.min(Math.max(rawCAGR, 0), cagrCap);

  // Current net margin (may be negative for loss-making companies)
  const currentMargin = latest.netIncome != null && latest.revenue > 0
    ? latest.netIncome / latest.revenue
    : 0;

  // Sector target margin
  const targetMargin = matchSector(sector, SECTOR_TARGET_MARGINS) ?? 0.10;
  const floorMargin  = Math.max(currentMargin, 0); // start from 0 if deeply negative

  // Year-5 projected values
  const projectedRevenue = latest.revenue * Math.pow(1 + cagr, 5);
  const year5Margin      = floorMargin + (targetMargin - floorMargin); // full 5-yr expansion
  const projectedNI      = projectedRevenue * Math.max(year5Margin, 0.01);

  // FCF = projected NI × sector-specific conversion ratio
  const fcfConversion = matchSector(sector, SECTOR_FCF_CONVERSION) ?? 0.85;
  return projectedNI * fcfConversion;
}

// Derive the best available FCF and recommended DCF defaults for a ticker.
// Resolution order:
//   1. Reported freeCashFlow from cash-flow statement
//   2. Computed: operatingCashFlow - |capex|
//   3. Sector proxy: revenue × sector FCF margin
// Returns { freeCashFlow, netDebt, sharesOutstanding, dcfDefaults, projectionMethod }
// projectionMethod is null for reported data, otherwise a human-readable label
// shown in the UI to indicate the FCF is estimated.
function deriveDCFInputs(financials, company) {
  const latestCF = financials?.cashflow?.[0] || {};
  const latestBS = financials?.balance?.[0]  || {};
  const latestIS = financials?.income?.[0]   || {};

  let freeCashFlow     = null;
  let projectionMethod = null;

  // 1. Directly reported FCF
  if (latestCF.freeCashFlow > 0) {
    freeCashFlow = latestCF.freeCashFlow;
  }

  // 2. Computed FCF = operating CF − capex
  if (!freeCashFlow) {
    const opCF  = latestCF.operatingCashFlow ?? null;
    const capex = latestCF.capitalExpenditures ?? latestCF.capex ?? null;
    if (opCF != null && capex != null) {
      const computed = opCF - Math.abs(capex);
      if (computed > 0) {
        freeCashFlow     = computed;
        projectionMethod = 'Computed (OpCF − CapEx)';
      }
    }
  }

  // 3. Ascension Model — for negative/zero FCF companies (Uber, Palantir, etc.)
  //    Uses the actual 3-year revenue CAGR and projects linear margin expansion
  //    from the company's current operating margin toward the sector target.
  //    More accurate than a static sector-average proxy.
  if (!freeCashFlow && latestIS.revenue > 0) {
    freeCashFlow     = ascensionFCF(financials?.income, company?.sector);
    projectionMethod = 'Ascension Model (CAGR + margin expansion)';
  }

  const netDebt = latestBS.netDebt ??
    ((latestBS.totalDebt ?? 0) - (latestBS.cashAndEquivalents ?? 0));

  const sharesOutstanding = latestIS.sharesOutstanding ??
    company?.sharesOutstanding ?? 1;

  const dcfDefaults = getSectorProfile(company?.sector);

  return { freeCashFlow, netDebt, sharesOutstanding, dcfDefaults, projectionMethod };
}

module.exports = { fillCompanyMetrics, deriveDCFInputs, getSectorProfile };
