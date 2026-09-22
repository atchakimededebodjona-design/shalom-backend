-- Migration: 032_subscriptions_payment_reference
-- Description: Colonne d'idempotence pour l'activation d'abonnement.
--
-- Contexte : 011_subscriptions_ambassador_module.sql documente déjà le modèle
-- prévu ("chaque (ré)abonnement insère une nouvelle ligne, jamais de mise à
-- jour destructive"), mais aucun code n'a jamais réellement inséré de ligne
-- pour un abonnement payant réel — seule la ligne 'legacy' de rétrocompatibilité
-- existe. Cette colonne permet d'activer un abonnement à partir d'une preuve
-- de paiement réelle (référence Mobile Money, référence provider, etc.) sans
-- jamais créer deux fois le même abonnement si la confirmation arrive deux
-- fois (même principe d'idempotence que provider_transactions pour le wallet).
ALTER TABLE subscriptions
  ADD COLUMN payment_reference VARCHAR(150);

-- NULL pour les lignes historiques ('legacy', rétrocompatibilité) : seules les
-- références non nulles doivent être uniques (deux lignes 'legacy' sans
-- référence ne doivent pas se bloquer mutuellement).
CREATE UNIQUE INDEX idx_subscriptions_payment_reference
  ON subscriptions(payment_reference)
  WHERE payment_reference IS NOT NULL;
