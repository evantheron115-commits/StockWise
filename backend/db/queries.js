const pool = require('./index');

// ── Companies ─────────────────────────────────────────────────────────────────

async function upsertCompany(c) {
  await pool.query(
    `INSERT INTO companies
       (ticker, name, exchange, sector, industry, description, currency, country, website, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (ticker) DO UPDATE SET
       name=$2, exchange=$3, sector=$4, industry=$5, description=$6,
       currency=$7, country=$8, website=$9, updated_at=NOW()`,
    [c.ticker, c.name, c.exchange, c.sector, c.industry, c.description,
     c.currency, c.country, c.website]
  );
}

async function getCompanyFromDB(ticker) {
  const { rows } = await pool.query(
    'SELECT * FROM companies WHERE ticker=$1', [ticker]
  );
  return rows[0] || null;
}

// ── Financials ────────────────────────────────────────────────────────────────

async function upsertFinancials(ticker, rows) {
  for (const r of rows) {
    await pool.query(
      `INSERT INTO financials
         (ticker, period, fiscal_year, date,
          revenue, gross_profit, operating_income, net_income, ebitda, eps,
          total_assets, total_liabilities, total_debt, net_debt, shareholders_equity, cash,
          operating_cf, free_cash_flow, capex,
          gross_margin, operating_margin, net_margin, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
       ON CONFLICT (ticker, period, fiscal_year) DO UPDATE SET
         date=$4, revenue=$5, gross_profit=$6, operating_income=$7, net_income=$8,
         ebitda=$9, eps=$10, total_assets=$11, total_liabilities=$12, total_debt=$13,
         net_debt=$14, shareholders_equity=$15, cash=$16, operating_cf=$17,
         free_cash_flow=$18, capex=$19, gross_margin=$20, operating_margin=$21,
         net_margin=$22, updated_at=NOW()`,
      [
        ticker,
        r.period || 'FY',
        r.fiscalYear || r.fiscal_year || (r.date ? parseInt(r.date.slice(0, 4)) : null),
        r.date || null,
        r.revenue || null,
        r.grossProfit || null,
        r.operatingIncome || null,
        r.netIncome || null,
        r.ebitda || null,
        r.eps || null,
        r.totalAssets || null,
        r.totalLiabilities || null,
        r.totalDebt || null,
        r.netDebt || null,
        r.shareholdersEquity || null,
        r.cash || null,
        r.operatingCF || null,
        r.freeCashFlow || null,
        r.capex || null,
        r.grossMargin || null,
        r.operatingMargin || null,
        r.netMargin || null,
      ]
    );
  }
}

async function getFinancialsFromDB(ticker) {
  const { rows } = await pool.query(
    'SELECT * FROM financials WHERE ticker=$1 ORDER BY fiscal_year DESC', [ticker]
  );
  return rows;
}

// ── Stock prices ──────────────────────────────────────────────────────────────

async function upsertPrices(ticker, prices) {
  for (const p of prices) {
    await pool.query(
      `INSERT INTO stock_prices (ticker, date, open, high, low, close, volume)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (ticker, date) DO NOTHING`,
      [ticker, p.date, p.open, p.high, p.low, p.close, p.volume]
    );
  }
}

async function getPricesFromDB(ticker, years = 5) {
  const from = new Date();
  from.setFullYear(from.getFullYear() - years);
  const { rows } = await pool.query(
    `SELECT * FROM stock_prices
     WHERE ticker=$1 AND date >= $2
     ORDER BY date ASC`,
    [ticker, from.toISOString().slice(0, 10)]
  );
  return rows;
}

module.exports = {
  upsertCompany, getCompanyFromDB,
  upsertFinancials, getFinancialsFromDB,
  upsertPrices, getPricesFromDB,
};
