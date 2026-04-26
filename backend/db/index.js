const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000, // Kill queries that run longer than 10s
});

pool.on('error', (err) => {
  console.error(
    `[DB] Pool error — total:${pool.totalCount} idle:${pool.idleCount} waiting:${pool.waitingCount} — ${err.message}`
  );
});

// Call this wherever you suspect connection exhaustion.
// pg.Pool exposes these counts synchronously — zero cost to read.
pool.logStats = function (label = '') {
  console.log(
    `[DB] Pool${label ? ' ' + label : ''} — total:${pool.totalCount} idle:${pool.idleCount} waiting:${pool.waitingCount}`
  );
};

module.exports = pool;
