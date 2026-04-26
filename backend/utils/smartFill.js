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

  // EPS
  if (company.eps == null) {
    const v = income.epsDiluted ?? income.eps ?? null;
    if (v != null) company.eps = v;
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

  // 3. Sector proxy: revenue × typical FCF margin for the sector
  if (!freeCashFlow && latestIS.revenue > 0) {
    const margin     = matchSector(company?.sector, SECTOR_FCF_MARGINS) ?? 0.10;
    freeCashFlow     = latestIS.revenue * margin;
    projectionMethod = `Projected (${company?.sector || 'Market'} avg FCF margin)`;
  }

  const netDebt = latestBS.netDebt ??
    ((latestBS.totalDebt ?? 0) - (latestBS.cashAndEquivalents ?? 0));

  const sharesOutstanding = latestIS.sharesOutstanding ??
    company?.sharesOutstanding ?? 1;

  const dcfDefaults = getSectorProfile(company?.sector);

  return { freeCashFlow, netDebt, sharesOutstanding, dcfDefaults, projectionMethod };
}

module.exports = { fillCompanyMetrics, deriveDCFInputs, getSectorProfile };
