const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const sql = fs.readFileSync(path.resolve(__dirname, 'migrations/002_add_website_to_profiles.sql'), 'utf8');
    await pool.query(sql);
    console.log('Migration OK');
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    await pool.end();
  }
}

run();
