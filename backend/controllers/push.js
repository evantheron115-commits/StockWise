'use strict';
const log        = require('../utils/logger');
const db         = require('../db/queries');
const pushSender = require('../services/pushSender');

// POST /api/push/register
// Body: { deviceToken: string, platform?: 'ios' | 'android' }
// Auth: verifyAuth — req.userId guaranteed set
async function registerDevice(req, res) {
  const { deviceToken, platform = 'ios' } = req.body || {};

  if (!deviceToken || typeof deviceToken !== 'string' || deviceToken.length < 8) {
    return res.status(400).json({ error: 'Invalid device token.' });
  }
  if (!['ios', 'android'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be ios or android.' });
  }

  try {
    await db.upsertPushDevice(req.userId, deviceToken, platform);
    log.info(`[Push] Device registered — userId=${req.userId} platform=${platform}`);
    return res.json({ registered: true });
  } catch (err) {
    log.error('[Push] registerDevice failed', { err: err.message });
    return res.status(500).json({ error: 'Failed to register device.' });
  }
}

// DELETE /api/push/unregister
// Body: { deviceToken: string }
async function unregisterDevice(req, res) {
  const { deviceToken } = req.body || {};
  if (!deviceToken) return res.status(400).json({ error: 'deviceToken required.' });

  try {
    await db.removePushDevice(req.userId, deviceToken);
    return res.json({ unregistered: true });
  } catch (err) {
    log.error('[Push] unregisterDevice failed', { err: err.message });
    return res.status(500).json({ error: 'Failed to unregister device.' });
  }
}

// Middleware: require X-Admin-Token header matching ADMIN_DIAGNOSTIC_TOKEN env var.
function adminGate(req, res, next) {
  const expected = process.env.ADMIN_DIAGNOSTIC_TOKEN;
  if (!expected || req.headers['x-admin-token'] !== expected) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

// GET /api/push/diagnose
async function diagnose(req, res) {
  try {
    const diag  = pushSender.getDiagnostics();
    const count = await db.countPushDevices();
    return res.json({ ...diag, deviceTokenCount: count });
  } catch (err) {
    log.error('[Push] diagnose failed', { err: err.message });
    return res.status(500).json({ error: 'Diagnose query failed.' });
  }
}

// POST /api/push/test
// Body: { deviceToken: string, title?: string, body?: string }
async function testPush(req, res) {
  const { deviceToken, title = 'Test', body = 'Phase 0 works' } = req.body || {};
  if (!deviceToken || typeof deviceToken !== 'string') {
    return res.status(400).json({ error: 'deviceToken required.' });
  }
  try {
    const result = await pushSender.send(deviceToken, {
      title,
      body,
      data: { type: 'test' },
    });
    return res.json(result);
  } catch (err) {
    log.error('[Push] testPush failed', { err: err.message });
    return res.status(500).json({ error: 'Test push failed.' });
  }
}

module.exports = { registerDevice, unregisterDevice, adminGate, diagnose, testPush };
