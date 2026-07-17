-- Migration: create_wallet_module
-- Description: Module Portefeuille (Shalom Tools).
--   Gère à la fois le suivi personnel (revenus/dépenses manuels, catégorisés) ET
--   les transactions réelles liées à la plateforme (paiements CinetPay/FedaPay,
--   abonnements CAMAJ+, achats de crédits, factures Reçu+, commissions Ambassadeur).
--
-- Principes :
--   - Devise par défaut : FCFA (XOF).
--   - Soft delete via deleted_at (jamais de suppression physique des mouvements).
--   - Solde protégé par verrou row-level (SELECT ... FOR UPDATE) côté service.
--   - Idempotence des webhooks garantie par UNIQUE (provider, provider_tx_id).

-- =========================================================================
-- 1. Portefeuilles — un portefeuille actif par utilisateur
-- =========================================================================
CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance    NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency   VARCHAR(3) NOT NULL DEFAULT 'XOF',
  status     VARCHAR(20) NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','frozen','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Un seul portefeuille non supprimé par utilisateur.
-- Cet index partiel sert aussi de cible à l'upsert `ON CONFLICT (user_id) WHERE deleted_at IS NULL`
-- utilisé pour créer le portefeuille à la volée lors du premier mouvement.
CREATE UNIQUE INDEX uniq_wallets_user_active ON wallets(user_id) WHERE deleted_at IS NULL;

-- =========================================================================
-- 2. Catégories — système (user_id NULL, is_system) + personnalisées
-- =========================================================================
CREATE TABLE wallet_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = catégorie système partagée
  name       VARCHAR(100) NOT NULL,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  icon       VARCHAR(50),
  color      VARCHAR(20),
  is_system  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_wallet_categories_user ON wallet_categories(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_categories_system ON wallet_categories(is_system) WHERE is_system = true AND deleted_at IS NULL;

-- =========================================================================
-- 3. Transactions du portefeuille — mouvements crédit/débit horodatés
-- =========================================================================
CREATE TABLE wallet_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id      UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type           VARCHAR(10) NOT NULL CHECK (type IN ('credit','debit')),
  source         VARCHAR(30) NOT NULL
                 CHECK (source IN ('manual','topup','withdrawal','subscription',
                                   'credit_purchase','invoice','commission',
                                   'refund','reversal','adjustment')),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_after  NUMERIC(14,2) NOT NULL, -- solde du portefeuille juste après ce mouvement
  category_id    UUID REFERENCES wallet_categories(id),
  reference_type VARCHAR(50),   -- ex: 'camaj_subscription', 'recu_invoice', 'ambassador_commission'
  reference_id   UUID,          -- id de l'entité métier liée (abonnement, facture, ...)
  provider       VARCHAR(30),   -- 'cinetpay' | 'fedapay' | NULL (mouvement interne)
  provider_tx_id VARCHAR(255),
  status         VARCHAR(20) NOT NULL DEFAULT 'completed'
                 CHECK (status IN ('pending','completed','failed','reversed','cancelled')),
  description    TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  -- Traçabilité des annulations : une transaction d'annulation pointe vers l'originale.
  -- L'originale passe alors en status='reversed' (jamais supprimée).
  reverses_transaction_id UUID REFERENCES wallet_transactions(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX idx_wallet_tx_wallet_date ON wallet_transactions(wallet_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_tx_category   ON wallet_transactions(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_tx_reference  ON wallet_transactions(reference_type, reference_id) WHERE deleted_at IS NULL;

-- Idempotence (défense en profondeur) : au plus une transaction par couple provider/id.
-- La garantie forte est portée par provider_transactions (cf. table 4), mais on
-- verrouille aussi ici pour empêcher tout double crédit accidentel.
CREATE UNIQUE INDEX uniq_wallet_tx_provider
  ON wallet_transactions(provider, provider_tx_id)
  WHERE provider IS NOT NULL AND provider_tx_id IS NOT NULL AND deleted_at IS NULL;

-- =========================================================================
-- 4. Journal brut des webhooks providers (log avant réconciliation)
-- =========================================================================
CREATE TABLE provider_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              VARCHAR(30) NOT NULL,
  provider_tx_id        VARCHAR(255) NOT NULL,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL, -- NULL tant que non réconcilié ; conservé si le mouvement est purgé
  user_id               UUID REFERENCES users(id) ON DELETE SET NULL, -- traçabilité + nettoyage; NULL si compte supprimé
  raw_payload           JSONB NOT NULL DEFAULT '{}',
  status                VARCHAR(20) NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received','processed','failed','ignored')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotence forte : un webhook (provider + id) n'est journalisé qu'une seule fois.
  UNIQUE (provider, provider_tx_id)
);

CREATE INDEX idx_provider_tx_status ON provider_transactions(status);

-- =========================================================================
-- 5. Trigger updated_at (réutilise update_updated_at_column() défini en 004)
-- =========================================================================
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 6. Catégories système par défaut (partagées, user_id NULL, is_system = true)
-- =========================================================================
INSERT INTO wallet_categories (user_id, name, type, icon, color, is_system) VALUES
  (NULL, 'Salaire',           'income',  '💼', '#16a34a', true),
  (NULL, 'Don reçu',          'income',  '🎁', '#22c55e', true),
  (NULL, 'Commission',        'income',  '🤝', '#10b981', true),
  (NULL, 'Rechargement',      'income',  '➕', '#0ea5e9', true),
  (NULL, 'Remboursement',     'income',  '↩️', '#14b8a6', true),
  (NULL, 'Abonnement CAMAJ+', 'expense', '⭐', '#f59e0b', true),
  (NULL, 'Achat de crédits',  'expense', '🪙', '#eab308', true),
  (NULL, 'Facture Reçu+',     'expense', '🧾', '#ef4444', true),
  (NULL, 'Offrande / Dîme',   'expense', '🕊️', '#8b5cf6', true),
  (NULL, 'Divers',            'expense', '📦', '#64748b', true);
