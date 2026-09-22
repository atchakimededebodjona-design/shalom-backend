-- Migration: 033_ambassador_commission_subscription_unique
-- Description: Idempotence des commissions sur abonnement.
--
-- Contexte : createCommissionForSubscription (ambassador.service.js) est
-- désormais réellement appelée par l'activation d'abonnement
-- (subscriptions.service.js). Cette activation est déjà idempotente sur
-- `payment_reference`, mais rien n'empêchait jusqu'ici qu'un même
-- `subscription_id` se voie associer deux commissions si la fonction était
-- appelée deux fois pour le même événement (retry, concurrence). Cet index
-- garantit qu'au plus UNE commission peut exister par abonnement — même
-- principe que l'unicité déjà posée sur subscriptions.payment_reference
-- (migration 032) et sur wallet.provider_transactions.
--
-- Exclut les commissions sans abonnement (bonus/pénalités manuels, où
-- subscription_id est NULL) : seules celles liées à un abonnement précis
-- doivent être uniques.
CREATE UNIQUE INDEX idx_ambassador_commissions_subscription_id
  ON ambassador_commissions(subscription_id)
  WHERE subscription_id IS NOT NULL;
