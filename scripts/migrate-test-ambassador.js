// Script one-shot : crée les tables ambassador sur la DB de test
// Usage : node scripts/migrate-test-ambassador.js
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  // Tables
  `CREATE TABLE IF NOT EXISTS ambassador_profiles (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level            ambassador_level   NOT NULL DEFAULT 'standard',
    status           ambassador_status  NOT NULL DEFAULT 'active',
    referral_code    VARCHAR(20)  UNIQUE NOT NULL,
    bio              TEXT,
    total_referrals  INT          NOT NULL DEFAULT 0,
    total_earnings   BIGINT       NOT NULL DEFAULT 0,
    available_balance BIGINT      NOT NULL DEFAULT 0,
    joined_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    certified_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    UNIQUE(user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ambassador_commission_rates (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    level        ambassador_level NOT NULL,
    event_type   commission_type  NOT NULL,
    plan         subscription_plan,
    rate         NUMERIC(5,2)     NOT NULL,
    min_amount   BIGINT           NOT NULL DEFAULT 0,
    is_active    BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS referrals (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ambassador_id    UUID         NOT NULL REFERENCES ambassador_profiles(id) ON DELETE CASCADE,
    referred_user_id UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source           VARCHAR(50),
    status           VARCHAR(20)  NOT NULL DEFAULT 'registered',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE(referred_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ambassador_commissions (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    ambassador_id   UUID              NOT NULL REFERENCES ambassador_profiles(id) ON DELETE CASCADE,
    referred_user_id UUID             REFERENCES users(id) ON DELETE SET NULL,
    subscription_id UUID              REFERENCES subscriptions(id) ON DELETE SET NULL,
    type            commission_type   NOT NULL,
    amount          BIGINT            NOT NULL,
    rate_applied    NUMERIC(5,2)      NOT NULL DEFAULT 0,
    status          commission_status NOT NULL DEFAULT 'pending',
    description     TEXT,
    period_month    VARCHAR(7),
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS ambassador_withdrawals (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    ambassador_id   UUID              NOT NULL REFERENCES ambassador_profiles(id) ON DELETE CASCADE,
    amount          BIGINT            NOT NULL,
    method          withdrawal_method NOT NULL DEFAULT 'mobile_money',
    phone_number    VARCHAR(25),
    operator        mobile_operator,
    status          withdrawal_status NOT NULL DEFAULT 'pending',
    reference       VARCHAR(150),
    requested_at    TIMESTAMPTZ       NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    admin_notes     TEXT,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
  )`,
  // Barème initial (idempotent)
  `INSERT INTO ambassador_commission_rates (level, event_type, plan, rate)
   SELECT v.level::ambassador_level, v.event_type::commission_type, NULL::subscription_plan, v.rate::NUMERIC
   FROM (VALUES
    ('standard',  'subscription', 10.00),
    ('standard',  'renewal',       5.00),
    ('certified', 'subscription', 15.00),
    ('certified', 'renewal',      10.00)
   ) AS v(level, event_type, rate)
   WHERE NOT EXISTS (SELECT 1 FROM ambassador_commission_rates LIMIT 1)`,
];

async function run() {
  for (const [i, sql] of statements.entries()) {
    try {
      await pool.query(sql);
      console.log(`✅ Statement ${i + 1} OK`);
    } catch (e) {
      console.error(`❌ Statement ${i + 1}:`, e.message.split('\n')[0]);
    }
  }
  await pool.end();
  console.log('Terminé.');
}

run();
