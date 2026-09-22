-- Migration: 034_wallet_topup_requests
-- Description: État de paiement "pending" pour les recharges Wallet.
--
-- Contexte (Phase 4A) : initiateTopup() ne persistait jusqu'ici aucune trace
-- de la demande de recharge (commentaire explicite dans le code : "on ne crée
-- PAS de wallet_transaction 'pending' ici"). Rien ne permettait donc de
-- vérifier, à la réception d'un webhook, que le paiement avait réellement été
-- demandé, par qui, pour quel montant et quelle devise.
--
-- provider_transactions (migration 008) reste un journal TECHNIQUE du webhook
-- REÇU (rempli seulement à réception, clé sur provider+provider_tx_id — un
-- identifiant qu'on ne connaît pas forcément avant que le provider réponde).
-- Elle ne peut pas porter le rôle de "paiement attendu" sans mélanger deux
-- responsabilités distinctes (journal d'un événement reçu vs. attente d'un
-- événement futur) : cette table est donc volontairement séparée.
--
-- Créée à l'INITIATION, avant tout appel provider, elle porte la référence
-- interne SHALOM que le futur provider devra recevoir en donnée personnalisée
-- et renvoyer dans son webhook — seul moyen de relier un webhook à une
-- demande précise plutôt que de faire confiance aveuglément au payload.

CREATE TABLE wallet_topup_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Renseigné seulement à la réconciliation (on ne force pas la création du
  -- wallet pour une simple demande, éventuellement jamais payée).
  wallet_id             UUID REFERENCES wallets(id) ON DELETE SET NULL,
  reference             VARCHAR(64) NOT NULL,
  provider              VARCHAR(30) NOT NULL,
  -- Inconnu à la création ; renseigné dès que le provider le fournit.
  provider_tx_id        VARCHAR(255),
  amount                NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency              VARCHAR(3) NOT NULL DEFAULT 'XOF',
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','completed','failed','cancelled')),
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ancre stable dès l'initiation (contrairement à provider_tx_id, connu plus
-- tard) : c'est elle qui protège contre une référence détournée vers un autre
-- utilisateur/montant/devise.
CREATE UNIQUE INDEX idx_wallet_topup_requests_reference ON wallet_topup_requests(reference);

CREATE INDEX idx_wallet_topup_requests_user ON wallet_topup_requests(user_id, status);

-- Une fois connu, un provider_tx_id ne doit être rattaché qu'à une seule demande.
CREATE UNIQUE INDEX idx_wallet_topup_requests_provider_tx
  ON wallet_topup_requests(provider, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

CREATE TRIGGER trg_wallet_topup_requests_updated_at
  BEFORE UPDATE ON wallet_topup_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Traçabilité : quel journal de webhook a réconcilié quelle demande de recharge.
ALTER TABLE provider_transactions
  ADD COLUMN wallet_topup_request_id UUID REFERENCES wallet_topup_requests(id) ON DELETE SET NULL;
