const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getCacheStatus } = require('../utils/cache');

router.get('/', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    dbStatus = 'error';
  }

  const cache  = getCacheStatus();
  const status = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(dbStatus === 'ok' ? 200 : 503).json({
    status,
    service:   'Stoxora API',
    version:   '1.0.0',
    db:        dbStatus,
    cache,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
