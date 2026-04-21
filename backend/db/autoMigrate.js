const fs   = require('fs');
const path = require('path');
const pool = require('./index');

// Runs schema.sql on startup — all statements use CREATE TABLE IF NOT EXISTS
// so this is fully idempotent and safe to run every time the server boots.
async function autoMigrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('[DB] Schema migration applied.');
  } catch (err) {
    console.error('[DB] Migration error:', err.message);
  }
}

module.exports = autoMigrate;
