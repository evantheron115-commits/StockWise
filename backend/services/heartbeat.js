'use strict';

// Immortal Pulse — keeps Railway free-tier alive by self-pinging every 4 minutes
// and explicitly warming DB connections so the first user request is always fast.
//
// Uses Node's built-in http module (no extra dependency) and the pool already
// imported in db/index.js. Call start(port) once the Express server is listening.

const http = require('http');
const pool = require('../db/index');

const PULSE_MS = 4 * 60 * 1000; // 4 minutes — just under Railway's 5-min idle cutoff

let _port = 4000;

async function warmDB() {
  try {
    await pool.query('SELECT 1');
    // No log on success — would spam every 4 min in prod logs
  } catch (err) {
    pool.logStats('heartbeat-warm');
    console.warn('[Heartbeat] DB warm failed:', err.message);
  }
}

function selfPing() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port:     _port,
        path:     '/api/health',
        method:   'GET',
        timeout:  8000,
      },
      (res) => {
        res.resume(); // drain socket — required or it leaks
        if (res.statusCode !== 200) {
          console.warn(`[Heartbeat] Self-ping returned ${res.statusCode}`);
        }
        resolve(res.statusCode === 200);
      }
    );
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error',   () => resolve(false)); // server may not be up yet on first tick
    req.end();
  });
}

let started = false;

function start(port) {
  if (started) return;
  started = true;
  _port = port || parseInt(process.env.PORT) || 4000;

  // Warm DB immediately so the first user request hits a live connection
  warmDB();

  setInterval(async () => {
    await Promise.all([selfPing(), warmDB()]);
  }, PULSE_MS);

  console.log(`[Heartbeat] Immortal pulse started — interval ${PULSE_MS / 60000}min on port ${_port}`);
}

module.exports = { start };
