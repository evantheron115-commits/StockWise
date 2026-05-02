const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // 10 connections per replica — at 5 Railway replicas this totals 50, well within
  // managed-PG limits. 20 per replica would exhaust a 100-connection plan at scale.
  max: parseInt(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  // Lets the process exit cleanly when Railway kills a replica (SIGTERM)
  allowExitOnIdle: true,
  // Visible in pg_stat_activity — makes it easy to identify ValuBull connections
  application_name: 'valubull-api',
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
