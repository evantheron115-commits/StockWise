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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
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
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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

// ── Users ─────────────────────────────────────────────────────────────────────

async function createUser({ email, name, password, provider = 'email', avatar = null }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password, provider, avatar)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, provider, avatar, created_at`,
    [email.toLowerCase(), name || null, password || null, provider, avatar]
  );
  return rows[0];
}

async function getUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

async function upsertOAuthUser({ email, name, avatar, provider }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, avatar, provider)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, users.name),
       avatar = COALESCE(EXCLUDED.avatar, users.avatar),
       updated_at = NOW()
     RETURNING id, email, name, provider, avatar`,
    [email.toLowerCase(), name || null, avatar || null, provider]
  );
  return rows[0];
}

// ── Posts ─────────────────────────────────────────────────────────────────────

async function createPost({ ticker, userId, userName, content }) {
  const { rows } = await pool.query(
    `INSERT INTO posts (ticker, user_id, user_name, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, ticker, user_name, content, created_at`,
    [ticker.toUpperCase(), userId || null, userName || 'Anonymous', content]
  );
  return rows[0];
}

async function getPostsByTicker(ticker, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, user_name, content, created_at
     FROM posts
     WHERE ticker = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [ticker.toUpperCase(), limit]
  );
  return rows;
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

async function getWatchlist(userId) {
  const { rows } = await pool.query(
    `SELECT w.ticker, w.added_at, c.name
     FROM watchlist w
     LEFT JOIN companies c ON c.ticker = w.ticker
     WHERE w.user_id = $1
     ORDER BY w.added_at DESC`,
    [userId]
  );
  return rows;
}

async function addToWatchlist(userId, ticker) {
  const { rows } = await pool.query(
    `INSERT INTO watchlist (user_id, ticker)
     VALUES ($1, $2)
     ON CONFLICT (user_id, ticker) DO NOTHING
     RETURNING id, ticker, added_at`,
    [userId, ticker.toUpperCase()]
  );
  return rows[0] || null;
}

async function removeFromWatchlist(userId, ticker) {
  const { rowCount } = await pool.query(
    'DELETE FROM watchlist WHERE user_id = $1 AND ticker = $2',
    [userId, ticker.toUpperCase()]
  );
  return rowCount > 0;
}

async function isInWatchlist(userId, ticker) {
  const { rows } = await pool.query(
    'SELECT 1 FROM watchlist WHERE user_id = $1 AND ticker = $2',
    [userId, ticker.toUpperCase()]
  );
  return rows.length > 0;
}

// ── Account management ────────────────────────────────────────────────────────

async function getUserById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM users WHERE id = $1', [id]
  );
  return rows[0] || null;
}

async function deleteUserAccount(userId) {
  // watchlist and push_devices auto-delete via CASCADE FK
  // post user_ids are SET NULL via FK (anonymises posts, does not delete them)
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

// ── Push devices ──────────────────────────────────────────────────────────────

async function upsertPushDevice(userId, deviceToken, platform = 'ios') {
  await pool.query(
    `INSERT INTO push_devices (user_id, device_token, platform, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, device_token) DO UPDATE SET
       platform   = EXCLUDED.platform,
       updated_at = NOW()`,
    [userId, deviceToken, platform]
  );
}

async function getPushDevicesByUser(userId) {
  const { rows } = await pool.query(
    'SELECT device_token, platform FROM push_devices WHERE user_id = $1',
    [userId]
  );
  return rows;
}

async function removePushDevice(userId, deviceToken) {
  await pool.query(
    'DELETE FROM push_devices WHERE user_id = $1 AND device_token = $2',
    [userId, deviceToken]
  );
}

module.exports = {
  upsertCompany, getCompanyFromDB,
  upsertFinancials, getFinancialsFromDB,
  upsertPrices, getPricesFromDB,
  createUser, getUserByEmail, getUserById, upsertOAuthUser,
  createPost, getPostsByTicker,
  getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist,
  deleteUserAccount,
  upsertPushDevice, getPushDevicesByUser, removePushDevice,
};
