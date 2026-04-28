'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getCacheStatus } = require('../utils/cache');

function getHarvesterStats() {
  try { return require('../services/harvester').stats; }
  catch { return null; }
}

// ── GET /api/health ───────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  let dbStatus  = 'ok';
  let poolStats = null;
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    poolStats = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
  } catch {
    dbStatus  = 'error';
    poolStats = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
  }

  const cache     = getCacheStatus();
  const harvester = getHarvesterStats();
  const status    = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(dbStatus === 'ok' ? 200 : 503).json({
    status,
    service:   'ValuBull API',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    db:        { status: dbStatus, pool: poolStats },
    cache:     { redis: cache.redis, memEntries: cache.memEntries },
    harvester: harvester ? {
      tier1LastRun:   harvester.tier1LastRun,
      tier2LastRun:   harvester.tier2LastRun,
      tier3LastRun:   harvester.tier3LastRun,
      totalRefreshes: harvester.totalRefreshes,
    } : null,
  });
});

// ── GET /api/health/keep-alive ────────────────────────────────────────────────

router.get('/keep-alive', async (req, res) => {
  const t0 = Date.now();
  let dbOk = false;
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    dbOk = true;
  } catch { /* non-fatal */ }

  const cache     = getCacheStatus();
  const harvester = getHarvesterStats();

  res.json({
    ok:      true,
    db:      dbOk ? 'warm' : 'cold',
    cache:   cache.redis,
    latency: Date.now() - t0,
    pool: {
      total:   pool.totalCount,
      idle:    pool.idleCount,
      waiting: pool.waitingCount,
    },
    harvester: harvester ? {
      totalRefreshes: harvester.totalRefreshes,
      tier1LastRun:   harvester.tier1LastRun,
    } : null,
  });
});

module.exports = router;
