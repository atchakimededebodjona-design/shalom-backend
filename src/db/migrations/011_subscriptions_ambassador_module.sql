-- Migration: subscriptions_ambassador_module
-- Description: Abonnement SHALOM obligatoire (essai 7 jours puis paiement)
--   et programme d'ambassadeur (parrainage + commissions).
--
-- Principes :
--   - Essai gratuit de 7 jours calculé depuis users.created_at (pas de colonne
--     dédiée, dérivé à la volée par le middleware/service).
--   - Chaque (ré)abonnement insère une nouvelle ligne dans `subscriptions`
--     (journal, jamais de mise à jour destructive) — sert à la fois de
--     preuve d'abonnement ET d'événement déclencheur de commission.
--   - Les comptes déjà existants au moment de cette migration sont
--     rétroactivement considérés comme abonnés (plan 'legacy', expiration
--     lointaine) pour ne pas les couper.
--   - Le parrainage est ouvert à tous (referred_by tracé dès l'inscription) ;
--     seul le TAUX de commission diffère selon que le parrain est certifié
--     (profiles.is_ambassador) ou non — voir ambassador.service.js.

-- =========================================================================
-- 1. Abonnements
-- =========================================================================
CREATE TYPE subscription_plan AS ENUM ('mensuel', 'trimestriel', 'semestriel', 'annuel', 'legacy');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');

CREATE TABLE subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        subscription_plan NOT NULL,
  amount      INTEGER NOT NULL DEFAULT 0, -- FCFA, entier — 0 pour 'legacy'
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  status      subscription_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, expires_at DESC);

-- =========================================================================
-- 2. Parrainage — qui a invité qui
-- =========================================================================
ALTER TABLE profiles
  ADD COLUMN referred_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_referred_by ON profiles(referred_by) WHERE referred_by IS NOT NULL;

-- =========================================================================
-- 3. Rétrocompatibilité — comptes existants considérés déjà abonnés
-- =========================================================================
INSERT INTO subscriptions (user_id, plan, amount, started_at, expires_at, status)
SELECT id, 'legacy', 0, now(), '2099-12-31T00:00:00Z', 'active'
FROM users;
