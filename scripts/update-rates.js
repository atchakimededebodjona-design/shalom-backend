// script pour mettre à jour les taux existants
'use strict';
const path = require('path');
const { Pool } = require('pg');

async function updateRates(envFile) {
  require('dotenv').config({ path: path.resolve(__dirname, envFile), override: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`UPDATE ambassador_commission_rates SET rate = 10.00 WHERE level = 'standard' AND event_type = 'subscription'`);
    await pool.query(`UPDATE ambassador_commission_rates SET rate = 8.00 WHERE level = 'standard' AND event_type = 'renewal'`);
    await pool.query(`UPDATE ambassador_commission_rates SET rate = 20.00 WHERE level = 'certified' AND event_type = 'subscription'`);
    await pool.query(`UPDATE ambassador_commission_rates SET rate = 15.00 WHERE level = 'certified' AND event_type = 'renewal'`);
    console.log(`✅ Taux mis à jour pour ${envFile}`);
  } catch (e) {
    console.error(`❌ Erreur ${envFile}:`, e.message);
  } finally {
    await pool.end();
  }
}

async function run() {
  await updateRates('../.env');
  await updateRates('../.env.test');
}
run();
