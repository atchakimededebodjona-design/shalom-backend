-- Migration: 031_ambassador_referrals
-- Description: Table `referrals` manquante depuis 012_ambassador_program.sql.
--
-- 012_ambassador_program.sql crée ambassador_profiles, ambassador_commission_rates,
-- ambassador_commissions et ambassador_withdrawals, mais omet la table `referrals`
-- que src/modules/ambassador/ambassador.service.js interroge pourtant depuis
-- l'origine (recordReferral, listReferrals, createCommissionForSubscription,
-- getDashboard). L'oubli n'avait jamais été détecté car un script one-shot
-- (scripts/migrate-test-ambassador.js, ajouté dans le même commit que 012) créait
-- déjà cette table à la main sur les bases de dev/test existantes. Schéma repris
-- à l'identique de ce script, seule source fiable de l'intention d'origine.
--
-- Dépend de :
--   - 000_users.sql               (table users)
--   - 012_ambassador_program.sql  (table ambassador_profiles)

-- =========================================================================
-- Parrainages
-- =========================================================================
CREATE TABLE IF NOT EXISTS referrals (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id    UUID         NOT NULL REFERENCES ambassador_profiles(id) ON DELETE CASCADE,
  referred_user_id UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source           VARCHAR(50),
  -- Origine du parrainage, ex: 'code' (lien/code de parrainage saisi à l'inscription)
  status           VARCHAR(20)  NOT NULL DEFAULT 'registered',
  -- Progression réelle stockée : 'registered' → 'subscribed' → 'qualified'.
  -- ('expired' est un filtre dérivé côté service — jamais une valeur stockée ici.)
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- Un seul parrainage par filleul (premier ambassadeur crédité, cf. recordReferral) :
  -- l'INSERT ... ON CONFLICT DO NOTHING du service dépend de cette contrainte.
  UNIQUE(referred_user_id),
  CONSTRAINT referrals_status_check CHECK (status IN ('registered', 'subscribed', 'qualified'))
);

CREATE INDEX idx_referrals_ambassador ON referrals(ambassador_id, status);
