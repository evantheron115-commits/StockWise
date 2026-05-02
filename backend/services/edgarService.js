'use strict';

const axios = require('axios');
const log   = require('../utils/logger');

// SEC requires a descriptive User-Agent with contact info
const SEC_UA = `ValuBull/1.0 (${process.env.SEC_CONTACT_EMAIL || 'support@valubull.app'})`;

// ── Ticker → CIK mapping ──────────────────────────────────────────────────────
// Loaded once from SEC, refreshed every 24 h, held in memory (~1 MB)

let _cikMap      = null;
let _cikLoadedAt = 0;
const CIK_TTL_MS = 24 * 60 * 60 * 1000;

async function _loadCIKMap() {
  const now = Date.now();
  if (_cikMap && now - _cikLoadedAt < CIK_TTL_MS) return _cikMap;

  log.info('[EDGAR] Loading ticker→CIK map from SEC');
  const { data } = await axios.get('https://www.sec.gov/files/company_tickers.json', {
    timeout: 20000,
    headers: { 'User-Agent': SEC_UA },
  });

  const map = {};
  for (const entry of Object.values(data)) {
    // CIK must be zero-padded to 10 digits for EDGAR API calls
    map[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, '0');
  }
  _cikMap      = map;
  _cikLoadedAt = now;
  log.info(`[EDGAR] CIK map loaded — ${Object.keys(map).length} tickers`);
  return map;
}

async function lookupCIK(ticker) {
  const map = await _loadCIKMap();
  return map[ticker.toUpperCase()] ?? null;
}

// ── XBRL fact extraction ───────────────────────────────────────────────────────

// Annual filings only
function _isAnnual(u) {
  return ['10-K', '20-F'].includes(u.form);
}

// Period concept (income/CF): additionally require ~12-month duration
function _isAnnualPeriod(u) {
  if (!_isAnnual(u)) return false;
  if (u.start && u.end) {
    const days = (new Date(u.end) - new Date(u.start)) / 86400000;
    if (days < 330 || days > 400) return false;
  }
  return true;
}

// Determine the 5 most recent fiscal year end dates using a reliable concept
function _annualDates(usgaap) {
  const anchors = [
    'NetIncomeLoss', 'ProfitLoss',
    'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet', 'NetCashProvidedByUsedInOperatingActivities',
    'Assets',
  ];

  for (const tag of anchors) {
    const units = usgaap?.[tag]?.units?.USD;
    if (!units?.length) continue;

    const annual = units.filter(_isAnnualPeriod);
    if (!annual.length) continue;

    // Deduplicate by end date — keep the most recently filed revision
    const byDate = {};
    for (const u of annual) {
      if (!byDate[u.end] || u.filed > byDate[u.end].filed) byDate[u.end] = u;
    }

    const dates = Object.keys(byDate).sort().reverse().slice(0, 5);
    if (dates.length) return dates;
  }
  return [];
}

// Period concept value (income statement / cash flow items)
function _period(usgaap, endDate, ...tags) {
  for (const tag of tags) {
    const units = usgaap?.[tag]?.units?.USD;
    if (!units) continue;
    const match = units
      .filter(u => u.end === endDate && _isAnnualPeriod(u))
      .sort((a, b) => b.filed.localeCompare(a.filed))[0];
    if (match !== undefined) return match.val ?? null;
  }
  return null;
}

// Instant concept value (balance sheet items, point-in-time at fiscal year end)
function _instant(usgaap, endDate, ...tags) {
  for (const tag of tags) {
    const units = usgaap?.[tag]?.units?.USD;
    if (!units) continue;
    const match = units
      .filter(u => u.end === endDate && _isAnnual(u))
      .sort((a, b) => b.filed.localeCompare(a.filed))[0];
    if (match !== undefined) return match.val ?? null;
  }
  return null;
}

// USD/shares concept value (EPS)
function _perShare(usgaap, endDate, ...tags) {
  for (const tag of tags) {
    const units = usgaap?.[tag]?.units?.['USD/shares'];
    if (!units) continue;
    const match = units
      .filter(u => u.end === endDate && _isAnnualPeriod(u))
      .sort((a, b) => b.filed.localeCompare(a.filed))[0];
    if (match !== undefined) return match.val ?? null;
  }
  return null;
}

// Share count concept (for EPS derivation when USD/shares tags are absent)
function _sharesCount(usgaap, endDate, ...tags) {
  for (const tag of tags) {
    // Shares can appear in either 'shares' or 'USD/shares' units
    for (const unitType of ['shares', 'USD/shares']) {
      const units = usgaap?.[tag]?.units?.[unitType];
      if (!units) continue;
      // For instant counts (balance-sheet style), match by end date only
      // For period counts (weighted average), also require annual period
      const matches = units
        .filter(u => u.end === endDate && _isAnnual(u))
        .sort((a, b) => b.filed.localeCompare(a.filed));
      if (matches.length) return matches[0].val ?? null;
    }
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

async function fetchFinancials(ticker) {
  const cik = await lookupCIK(ticker);
  if (!cik) {
    log.warn(`[EDGAR] No CIK for ${ticker}`);
    return null;
  }

  log.info(`[EDGAR] Fetching XBRL facts for ${ticker} (CIK ${cik})`);

  const { data: body } = await axios.get(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    {
      timeout: 30000,
      maxContentLength: 60 * 1024 * 1024, // 60 MB ceiling for large companies
      decompress: true,
      headers: { 'User-Agent': SEC_UA },
    }
  );

  const usgaap = body?.facts?.['us-gaap'];
  if (!usgaap) {
    log.warn(`[EDGAR] No us-gaap facts for ${ticker}`);
    return null;
  }

  const dates = _annualDates(usgaap);
  if (!dates.length) {
    log.warn(`[EDGAR] No annual dates found for ${ticker}`);
    return null;
  }
  log.info(`[EDGAR] ${ticker} annual dates: ${dates.join(', ')}`);

  // ── Income Statement ───────────────────────────────────────────────────────

  const income = dates.map(date => {
    const revenue = _period(usgaap, date,
      'Revenues',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'RevenueFromContractWithCustomerIncludingAssessedTax',
      'SalesRevenueNet',
      'SalesRevenueGoodsNet',
    );
    const costOfRevenue = _period(usgaap, date,
      'CostOfRevenue',
      'CostOfGoodsAndServicesSold',
      'CostOfGoodsSold',
    );
    const grossProfit = _period(usgaap, date, 'GrossProfit')
      ?? (revenue != null && costOfRevenue != null ? revenue - costOfRevenue : null);
    const operatingIncome = _period(usgaap, date,
      'OperatingIncomeLoss',
    );
    const netIncome = _period(usgaap, date,
      'NetIncomeLoss',
      'ProfitLoss',
      'NetIncomeLossAvailableToCommonStockholdersBasic',
    );
    const da = _period(usgaap, date,
      'DepreciationAndAmortization',
      'DepreciationDepletionAndAmortization',
      'Depreciation',
    );
    const ebitda = (operatingIncome != null && da != null)
      ? operatingIncome + da
      : null;
    const operatingExpenses = _period(usgaap, date, 'OperatingExpenses');
    const epsDiluted = _perShare(usgaap, date, 'EarningsPerShareDiluted');
    const epsBasic   = _perShare(usgaap, date, 'EarningsPerShareBasic');

    // Shares outstanding — enables EPS derivation in smartFill when USD/shares
    // tags are absent (common for smaller or older EDGAR filers)
    const sharesOutstanding = _sharesCount(usgaap, date,
      'CommonStockSharesOutstanding',
      'WeightedAverageNumberOfDilutedSharesOutstanding',
      'WeightedAverageNumberOfSharesOutstandingBasic',
      'CommonStockSharesIssued',
    );

    // Derive EPS from net income if the USD/shares tags came back empty
    const computedEps = (!epsBasic && !epsDiluted && netIncome != null && sharesOutstanding > 0)
      ? netIncome / sharesOutstanding
      : null;

    const ratio = (n) => (revenue && n != null) ? +(n / revenue).toFixed(4) : null;

    return {
      date,
      period:            'FY',
      revenue,
      costOfRevenue,
      grossProfit,
      grossMargin:       ratio(grossProfit),
      operatingExpenses,
      operatingIncome,
      operatingMargin:   ratio(operatingIncome),
      ebitda,
      netIncome,
      netMargin:         ratio(netIncome),
      eps:               epsBasic   ?? computedEps,
      epsDiluted:        epsDiluted ?? computedEps,
      sharesOutstanding,
      _source:           'edgar',
    };
  }).filter(r => r.revenue != null || r.netIncome != null);

  // ── Balance Sheet ──────────────────────────────────────────────────────────

  const balance = dates.map(date => {
    const totalAssets      = _instant(usgaap, date, 'Assets');
    const totalLiabilities = _instant(usgaap, date, 'Liabilities');
    const cash             = _instant(usgaap, date,
      'CashAndCashEquivalentsAtCarryingValue',
      'Cash',
      'CashCashEquivalentsAndShortTermInvestments',
    );
    const equity           = _instant(usgaap, date,
      'StockholdersEquity',
      'StockholdersEquityAttributableToParent',
    );
    const longTermDebt     = _instant(usgaap, date,
      'LongTermDebt',
      'LongTermDebtNoncurrent',
      'LongTermDebtAndCapitalLeaseObligations',
    );
    const currentAssets    = _instant(usgaap, date, 'AssetsCurrent');
    const currentLiab      = _instant(usgaap, date, 'LiabilitiesCurrent');
    const retained         = _instant(usgaap, date, 'RetainedEarningsAccumulatedDeficit');
    const shortTermInv     = _instant(usgaap, date,
      'ShortTermInvestments',
      'MarketableSecuritiesCurrent',
    );
    const currentDebt      = _instant(usgaap, date,
      'LongTermDebtCurrent',
      'ShortTermBorrowings',
      'NotesPayableCurrent',
    );
    const totalDebt        = (longTermDebt != null || currentDebt != null)
      ? (longTermDebt ?? 0) + (currentDebt ?? 0)
      : null;
    const netDebt          = (totalDebt != null && cash != null) ? totalDebt - cash : null;

    return {
      date,
      period:                  'FY',
      cashAndEquivalents:      cash,
      shortTermInvestments:    shortTermInv,
      totalCurrentAssets:      currentAssets,
      totalAssets,
      totalCurrentLiabilities: currentLiab,
      totalLiabilities,
      longTermDebt,
      totalDebt,
      shareholdersEquity:      equity,
      retainedEarnings:        retained,
      netDebt,
      _source:                 'edgar',
    };
  }).filter(r => r.totalAssets != null || r.shareholdersEquity != null);

  // ── Cash Flow Statement ────────────────────────────────────────────────────

  const cashflow = dates.map(date => {
    const operatingCF = _period(usgaap, date,
      'NetCashProvidedByUsedInOperatingActivities',
      'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
    );
    // CapEx is a cash outflow — store as negative to match FMP convention
    const capexRaw    = _period(usgaap, date,
      'PaymentsToAcquirePropertyPlantAndEquipment',
      'PaymentsForCapitalImprovements',
    );
    const capex       = capexRaw != null ? -Math.abs(capexRaw) : null;
    const investingCF = _period(usgaap, date,
      'NetCashProvidedByUsedInInvestingActivities',
      'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations',
    );
    const financingCF = _period(usgaap, date,
      'NetCashProvidedByUsedInFinancingActivities',
      'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations',
    );
    const netChangeCash = _period(usgaap, date,
      'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect',
      'IncreaseDecreaseInCashAndCashEquivalents',
    );
    const freeCF      = (operatingCF != null && capex != null) ? operatingCF + capex : null;
    const dividends   = _period(usgaap, date,
      'PaymentsOfDividends',
      'PaymentsOfDividendsCommonStock',
    );
    const repurchase  = _period(usgaap, date,
      'PaymentsForRepurchaseOfCommonStock',
      'PaymentsForRepurchaseOfEquity',
    );

    return {
      date,
      period:            'FY',
      operatingCashFlow:  operatingCF,
      capitalExpenditure: capex,
      freeCashFlow:       freeCF,
      investingCashFlow:  investingCF,
      financingCashFlow:  financingCF,
      netChangeInCash:    netChangeCash,
      // Outflows stored as negative
      stockRepurchase:    repurchase != null ? -Math.abs(repurchase) : null,
      dividendsPaid:      dividends  != null ? -Math.abs(dividends)  : null,
      _source:            'edgar',
    };
  }).filter(r => r.operatingCashFlow != null);

  if (!income.length && !balance.length && !cashflow.length) {
    log.warn(`[EDGAR] No usable data extracted for ${ticker}`);
    return null;
  }

  log.info(`[EDGAR] ${ticker}: ${income.length} income, ${balance.length} balance, ${cashflow.length} CF rows`);
  return { income, balance, cashflow };
}

module.exports = { fetchFinancials, lookupCIK };
