'use strict';
const log = require('../utils/logger');
const db  = require('../db/queries');

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

module.exports = { registerDevice, unregisterDevice };
