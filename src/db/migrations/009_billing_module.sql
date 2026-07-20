-- Migration: 009_billing_module
-- Description: Module Facturation « Reçu+ » intégré à SHALOM.
--   Factures, clients à facturer, lignes de facture et reçus (paiements).
--   Chaque paiement crédite en parallèle le portefeuille SHALOM du propriétaire
--   (wallet_transactions.source = 'invoice') — voir invoices.service.js.
--
-- Conventions SHALOM :
--   - tables préfixées par module (billing_*), FK vers users(id) ON DELETE CASCADE ;
--   - soft delete via deleted_at ;
--   - gen_random_uuid() (pgcrypto, migration 000) ;
--   - trigger updated_at réutilise update_updated_at_column() (défini en 004).

-- =========================================================================
-- 1. Clients à facturer
-- =========================================================================
CREATE TABLE billing_clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(255),
  phone      VARCHAR(40),
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_billing_clients_user ON billing_clients(user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_billing_clients_updated_at
  BEFORE UPDATE ON billing_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 2. Factures
-- =========================================================================
CREATE TABLE billing_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      UUID REFERENCES billing_clients(id),
  invoice_number VARCHAR(50) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','partially_paid','paid','overdue','cancelled')),
  currency       VARCHAR(3) NOT NULL DEFAULT 'XOF',
  issue_date     DATE NOT NULL DEFAULT current_date,
  due_date       DATE,
  notes          TEXT,
  tax_rate       NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  -- Un même numéro de facture est unique pour un émetteur donné.
  UNIQUE (user_id, invoice_number)
);

CREATE INDEX idx_billing_invoices_user_date ON billing_invoices(user_id, issue_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_billing_invoices_client    ON billing_invoices(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_billing_invoices_status    ON billing_invoices(user_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_billing_invoices_updated_at
  BEFORE UPDATE ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 3. Lignes de facture (supprimées en cascade avec la facture)
-- =========================================================================
CREATE TABLE billing_invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_invoice_items_invoice ON billing_invoice_items(invoice_id);

-- =========================================================================
-- 4. Paiements / reçus rattachés à une facture
-- =========================================================================
CREATE TABLE billing_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method        VARCHAR(20) NOT NULL DEFAULT 'cash'
                CHECK (method IN ('cash','mobile_money','bank_transfer','card','other')),
  paid_at       DATE NOT NULL DEFAULT current_date,
  reference     VARCHAR(100),
  note          TEXT,
  -- Mouvement de portefeuille créé en contrepartie (crédit du solde SHALOM).
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_payments_invoice ON billing_payments(invoice_id);
CREATE INDEX idx_billing_payments_user    ON billing_payments(user_id);
