'use strict';

// Structured logger — levels INFO / WARN / ERROR.
// Set LOG_LEVEL=WARN in env to suppress INFO output in production.
// All output goes to stdout/stderr so Railway captures it correctly.

const LEVELS = { INFO: 0, WARN: 1, ERROR: 2 };
const MIN    = LEVELS[(process.env.LOG_LEVEL || 'INFO').toUpperCase()] ?? LEVELS.INFO;

function format(level, msg, meta) {
  const ts   = new Date().toISOString();
  const base = `${ts} [${level}] ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

function info(msg, meta)  { if (LEVELS.INFO  >= MIN) console.log(format('INFO',  msg, meta)); }
function warn(msg, meta)  { if (LEVELS.WARN  >= MIN) console.warn(format('WARN',  msg, meta)); }
function error(msg, meta) { if (LEVELS.ERROR >= MIN) console.error(format('ERROR', msg, meta)); }

module.exports = { info, warn, error };
