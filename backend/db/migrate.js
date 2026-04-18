require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./index');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[migrate] Connecting to:', process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@'));
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('[migrate] Schema applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err.message);
  process.exit(1);
});
