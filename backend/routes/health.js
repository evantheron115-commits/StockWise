const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getCacheStatus } = require('../utils/cache');

router.get('/', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
  } catch {
    dbStatus = 'error';
  }

  const cache  = getCacheStatus();
  const status = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(dbStatus === 'ok' ? 200 : 503).json({
    status,
    service:   'ValuBull API',
    version:   '1.0.0',
    db:        dbStatus,
    cache,
    timestamp: new Date().toISOString(),
  });
});

// Explicit keep-alive endpoint — warms DB + cache connections on demand.
// Called by heartbeat.js self-ping and the GitHub Actions external sentinel.
router.get('/keep-alive', async (req, res) => {
  const t0 = Date.now();
  let dbOk = false;
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    dbOk = true;
  } catch { /* non-fatal — just report */ }

  const cache = getCacheStatus();
  res.json({
    ok:      true,
    db:      dbOk ? 'warm' : 'cold',
    cache:   cache.type,
    latency: Date.now() - t0,
    pool: {
      total:   pool.totalCount,
      idle:    pool.idleCount,
      waiting: pool.waitingCount,
    },
  });
});

module.exports = router;
