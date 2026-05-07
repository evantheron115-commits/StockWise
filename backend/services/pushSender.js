'use strict';
// FCM v1 HTTP API via firebase-admin SDK.
// Lazy-initialises on first use; boot succeeds even when the env var is absent.

const admin = require('firebase-admin');
const log   = require('../utils/logger');

let _ready           = false;
let _projectId       = null;
let _initAttempted   = false;
let _lastSendOutcome = null;
let _lastSendErrorCode = null;
let _lastSendAt      = null;

function _init() {
  if (_initAttempted) return;
  _initAttempted = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    log.warn('[FCM v1] FIREBASE_SERVICE_ACCOUNT_JSON not set — push disabled');
    return;
  }
  try {
    const sa = JSON.parse(raw);
    if (!sa.project_id || !sa.private_key || !sa.client_email) {
      throw new Error('service account JSON missing required fields');
    }
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    _projectId = sa.project_id;
    _ready = true;
    log.info(`[FCM v1] initialized for projectId=${_projectId}`);
  } catch (e) {
    log.error(`[FCM v1] init failed: ${e.message} — push disabled`);
  }
}

// Tokens must be 100–300 non-whitespace characters.
const VALID_TOKEN_RE = /^[^\s]{100,300}$/;

const DELETE_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

function _shouldDelete(code) {
  return DELETE_CODES.has(code);
}

function _buildMessage(token, { title, body, data = {} }) {
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );
  return {
    token,
    notification: { title, body },
    data: stringData,
    apns: {
      payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
      headers: { 'apns-priority': '10' },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'price-alerts' },
    },
  };
}

function _logError(code, detail) {
  if (code === 'messaging/mismatched-credential') {
    log.error(`[FCM v1] MISMATCHED CREDENTIAL — projectId=${_projectId} does not match the token's project. Verify FIREBASE_SERVICE_ACCOUNT_JSON.`);
  } else if (code === 'messaging/invalid-argument') {
    log.error(`[FCM v1] invalid-argument (payload bug): ${detail}`);
  } else {
    log.warn(`[FCM v1] ${code}: ${detail}`);
  }
}

async function send(deviceToken, { title, body, data = {}, dryRun = false }) {
  _init();

  if (!VALID_TOKEN_RE.test(deviceToken)) {
    log.warn(`[FCM v1] malformed token rejected (len=${deviceToken?.length ?? 0})`);
    return { ok: false, errorCode: 'invalid-token-format', shouldDeleteToken: true };
  }
  if (!_ready) {
    return { ok: false, errorCode: 'not-initialized', shouldDeleteToken: false };
  }

  try {
    const messageId = await admin.messaging().send(
      _buildMessage(deviceToken, { title, body, data }),
      dryRun
    );
    _lastSendOutcome   = 'success';
    _lastSendErrorCode = null;
    _lastSendAt        = new Date().toISOString();
    return { ok: true, messageId, shouldDeleteToken: false };
  } catch (err) {
    const code = err.code || 'unknown';
    _lastSendOutcome   = 'error';
    _lastSendErrorCode = code;
    _lastSendAt        = new Date().toISOString();
    _logError(code, err.message);
    return { ok: false, errorCode: code, shouldDeleteToken: _shouldDelete(code) };
  }
}

const BATCH_SIZE = 500;

async function sendMulti(tokens, payload) {
  _init();

  const results = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const valid  = [];

    for (const token of batch) {
      if (!VALID_TOKEN_RE.test(token)) {
        log.warn(`[FCM v1] malformed token in batch rejected (len=${token?.length ?? 0})`);
        results.push({ token, ok: false, errorCode: 'invalid-token-format', shouldDeleteToken: true });
      } else {
        valid.push(token);
      }
    }

    if (!valid.length) continue;

    if (!_ready) {
      for (const token of valid) {
        results.push({ token, ok: false, errorCode: 'not-initialized', shouldDeleteToken: false });
      }
      continue;
    }

    const stringData = Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
    );
    const multicastMsg = {
      tokens: valid,
      notification: { title: payload.title, body: payload.body },
      data: stringData,
      apns: {
        payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
        headers: { 'apns-priority': '10' },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'price-alerts' },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(multicastMsg);
      _lastSendAt = new Date().toISOString();

      response.responses.forEach((r, idx) => {
        const token = valid[idx];
        if (r.success) {
          _lastSendOutcome   = 'success';
          _lastSendErrorCode = null;
          results.push({ token, ok: true, messageId: r.messageId, shouldDeleteToken: false });
        } else {
          const code = r.error?.code || 'unknown';
          _lastSendOutcome   = 'error';
          _lastSendErrorCode = code;
          _logError(code, r.error?.message || '');
          results.push({ token, ok: false, errorCode: code, shouldDeleteToken: _shouldDelete(code) });
        }
      });
    } catch (err) {
      const code = err.code || 'unknown';
      _lastSendOutcome   = 'error';
      _lastSendErrorCode = code;
      _lastSendAt        = new Date().toISOString();
      log.error(`[FCM v1] sendEachForMulticast threw: ${err.message}`);
      for (const token of valid) {
        results.push({ token, ok: false, errorCode: code, shouldDeleteToken: false });
      }
    }
  }

  return results;
}

function getDiagnostics() {
  _init();
  return {
    ready:              _ready,
    projectId:          _projectId,
    lastSendOutcome:    _lastSendOutcome,
    lastSendErrorCode:  _lastSendErrorCode,
    lastSendAt:         _lastSendAt,
  };
}

module.exports = { send, sendMulti, getDiagnostics };
