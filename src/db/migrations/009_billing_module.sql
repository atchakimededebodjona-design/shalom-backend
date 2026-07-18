-- Migration: create_billing_module
-- Description: Module Facturation « Reçu+ » — un outil SaaS que tout membre
--   SHALOM peut activer pour ses propres activités : déclarer son entreprise,
--   gérer ses clients et émettre des factures.
--
-- Principes :
--   - Une entreprise par utilisateur (peut évoluer plus tard).
--   - Devise par défaut : FCFA (XOF). Montants en entiers (pas de décimales).
--   - Soft delete via deleted_at (jamais de suppression physique).
--   - Chaque paiement enregistré crédite automatiquement le portefeuille
--     SHALOM (wallet) du propriétaire de l'entreprise — voir
--     billing.service.js → walletService.creditWallet(..., { source: 'invoice' }).
--     payments.wallet_transaction_id trace ce crédit pour audit.

-- =========================================================================
-- 1. Entreprises — une par utilisateur
-- =========================================================================
CREATE TABLE businesses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  logo_url       TEXT,
  address        TEXT,
  phone          VARCHAR(50),
  tax_id         VARCHAR(100),
  currency       VARCHAR(3) NOT NULL DEFAULT 'XOF',
  invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'FAC',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

-- Une seule entreprise active par utilisateur.
CREATE UNIQUE INDEX uniq_businesses_user_active ON businesses(user_id) WHERE deleted_at IS NULL;

-- =========================================================================
-- 2. Clients — carnet de clients d'une entreprise (simples contacts, pas
--    forcément des comptes SHALOM)
-- =========================================================================
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(50),
  email       VARCHAR(255),
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_clients_business ON clients(business_id) WHERE deleted_at IS NULL;

-- =========================================================================
-- 3. Factures — montants en entiers (FCFA), jamais de décimales
-- =========================================================================
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(50) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','partial','paid','overdue')),
  issue_date     DATE NOT NULL,
  due_date       DATE,
  subtotal       INTEGER NOT NULL,
  tax_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount     INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  amount_paid    INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE(business_id, invoice_number)
);

CREATE INDEX idx_invoices_business_status ON invoices(business_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_client ON invoices(client_id) WHERE deleted_at IS NULL;

-- =========================================================================
-- 4. Lignes de facture
-- =========================================================================
CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  INTEGER NOT NULL,
  line_total  INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- =========================================================================
-- 5. Paiements — chaque paiement crédite le wallet du propriétaire
-- =========================================================================
CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id            UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount                INTEGER NOT NULL CHECK (amount > 0),
  payment_method        VARCHAR(50) NOT NULL DEFAULT 'cash',
  reference_id          VARCHAR(100),
  payment_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Trace le mouvement de portefeuille créé pour ce paiement (audit / affichage).
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_business ON payments(business_id) WHERE deleted_at IS NULL;

-- =========================================================================
-- 6. Trigger updated_at (réutilise update_updated_at_column() défini en 004)
-- =========================================================================
CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
