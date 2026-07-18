-- Migration: 012_ambassador_program
-- Description: Programme d'ambassadeur SHALOM
--   Deux niveaux : Standard et Certifié.
--   Calcul automatique des commissions sur les abonnements parrainés.
--   Retrait via Mobile Money (conformité UEMOA).
--
-- Dépend de :
--   - 000_users.sql         (table users)
--   - 001_shalom_social_schema.sql (table profiles + is_ambassador)
--   - 011_subscriptions_ambassador_module.sql (referred_by + subscriptions)

-- =========================================================================
-- 1. Types ENUM
-- =========================================================================
CREATE TYPE ambassador_level  AS ENUM ('standard', 'certified');
CREATE TYPE ambassador_status AS ENUM ('active', 'suspended', 'pending_review');
CREATE TYPE commission_type   AS ENUM ('subscription', 'renewal', 'bonus', 'penalty');
CREATE TYPE commission_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE withdrawal_method AS ENUM ('mobile_money', 'bank_transfer');
CREATE TYPE mobile_operator   AS ENUM ('mtn', 'moov', 'wave', 'orange', 'other');

-- =========================================================================
-- 2. Profils ambassadeurs
-- =========================================================================
CREATE TABLE IF NOT EXISTS ambassador_profiles (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level            ambassador_level   NOT NULL DEFAULT 'standard',
  status           ambassador_status  NOT NULL DEFAULT 'active',
  referral_code    VARCHAR(20)  UNIQUE NOT NULL,
  -- Code unique généré automatiquement ex: SHLM-AB123
  bio              TEXT,
  total_referrals  INT          NOT NULL DEFAULT 0,
  -- Nombre de parrainages qualifiés (abonnés payants)
  total_earnings   BIGINT       NOT NULL DEFAULT 0,
  -- Total des commissions perçues (FCFA, entier)
  available_balance BIGINT      NOT NULL DEFAULT 0,
  -- Solde disponible pour retrait (FCFA, entier)
  joined_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  certified_at     TIMESTAMPTZ,
  -- Date de passage au niveau certifié
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE INDEX idx_ambassador_profiles_user   ON ambassador_profiles(user_id)         WHERE deleted_at IS NULL;
CREATE INDEX idx_ambassador_profiles_code   ON ambassador_profiles(referral_code)    WHERE deleted_at IS NULL;
CREATE INDEX idx_ambassador_profiles_level  ON ambassador_profiles(level, status)    WHERE deleted_at IS NULL;

-- =========================================================================
-- 3. Barème des commissions
-- =========================================================================
CREATE TABLE IF NOT EXISTS ambassador_commission_rates (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  level        ambassador_level NOT NULL,
  event_type   commission_type  NOT NULL,
  -- 'subscription' = premier abonnement | 'renewal' = renouvellement
  plan         subscription_plan,
  -- NULL = s'applique à tous les plans
  rate         NUMERIC(5,2)     NOT NULL,
  -- Pourcentage ex: 10.00 (= 10%)
  min_amount   BIGINT           NOT NULL DEFAULT 0,
  -- Montant minimum de l'abonnement pour déclencher la commission (FCFA)
  is_active    BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- Barème initial
INSERT INTO ambassador_commission_rates (level, event_type, plan, rate) VALUES
  ('standard',  'subscription', NULL, 10.00),
  ('standard',  'renewal',      NULL,  8.00),
  ('certified', 'subscription', NULL, 20.00),
  ('certified', 'renewal',      NULL, 15.00);

-- =========================================================================
-- 4. Commissions
-- =========================================================================
CREATE TABLE IF NOT EXISTS ambassador_commissions (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id   UUID              NOT NULL REFERENCES ambassador_profiles(id) ON DELETE CASCADE,
  referred_user_id UUID             REFERENCES users(id) ON DELETE SET NULL,
  -- L'utilisateur dont l'abonnement a généré la commission
  subscription_id UUID              REFERENCES subscriptions(id) ON DELETE SET NULL,
  -- L'abonnement déclencheur (NULL pour bonus manuels)
  type            commission_type   NOT NULL,
  amount          BIGINT            NOT NULL,
  -- FCFA — entier, jamais de décimales
  rate_applied    NUMERIC(5,2)      NOT NULL DEFAULT 0,
  -- % effectivement appliqué
  status          commission_status NOT NULL DEFAULT 'pending',
  description     TEXT,
  period_month    VARCHAR(7),
  -- 'YYYY-MM' pour les commissions mensuelles
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_commissions_ambassador ON ambassador_commissions(ambassador_id, status)    WHERE deleted_at IS NULL;
CREATE INDEX idx_commissions_period     ON ambassador_commissions(period_month)              WHERE deleted_at IS NULL;
CREATE INDEX idx_commissions_sub        ON ambassador_commissions(subscription_id)           WHERE subscription_id IS NOT NULL;

-- =========================================================================
-- 5. Demandes de retrait (Mobile Money)
-- =========================================================================
CREATE TABLE IF NOT EXISTS ambassador_withdrawals (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id   UUID              NOT NULL REFERENCES ambassador_profiles(id) ON DELETE CASCADE,
  amount          BIGINT            NOT NULL,
  -- FCFA — entier
  method          withdrawal_method NOT NULL DEFAULT 'mobile_money',
  phone_number    VARCHAR(25),
  -- Numéro Mobile Money avec indicatif ex: +22997123456
  operator        mobile_operator,
  -- 'mtn' | 'moov' | 'wave' | 'orange' | 'other'
  status          withdrawal_status NOT NULL DEFAULT 'pending',
  reference       VARCHAR(150),
  -- Référence de la transaction Mobile Money (fournie par le provider)
  requested_at    TIMESTAMPTZ       NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  -- Date de traitement (succès ou échec)
  admin_notes     TEXT,
  -- Notes internes pour l'équipe SHALOM
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_withdrawals_ambassador ON ambassador_withdrawals(ambassador_id, status)  WHERE deleted_at IS NULL;
CREATE INDEX idx_withdrawals_status     ON ambassador_withdrawals(status)                  WHERE deleted_at IS NULL;

-- =========================================================================
-- 6. Contrainte : seuil de retrait minimum (trigger optionnel)
-- =========================================================================
-- Seuil minimum : 5 000 FCFA (vérifié côté service)
-- Seuil maximum mensuel : 500 000 FCFA (conformité UEMOA — vérifié côté service)
-- Ces règles sont commentées ici pour mémoire, appliquées dans ambassador.service.js
