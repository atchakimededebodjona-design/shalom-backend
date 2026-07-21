-- Migration: 010_billing_businesses
-- Description: Profil « entreprise émettrice » du module Facturation « Reçu+ ».
--   Chaque membre déclare UNE entreprise (nom, coordonnées, devise, préfixe de
--   facture, logo) avant d'émettre des factures. Les clients/factures (009)
--   restent cloisonnés par user_id ; l'entreprise fournit l'en-tête émetteur
--   (nom + logo + adresse + NIF) et le préfixe de numérotation.
--
-- Conventions SHALOM :
--   - table préfixée par module (billing_*), FK vers users(id) ON DELETE CASCADE ;
--   - soft delete via deleted_at ;
--   - gen_random_uuid() (pgcrypto, migration 000) ;
--   - trigger updated_at réutilise update_updated_at_column() (défini en 004).

CREATE TABLE billing_businesses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           VARCHAR(150) NOT NULL,
  address        TEXT,
  phone          VARCHAR(40),
  tax_id         VARCHAR(100),
  currency       VARCHAR(3)  NOT NULL DEFAULT 'XOF',
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'FAC',
  logo_url       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

-- Un membre = une seule entreprise active (le front appelle GET /businesses/me).
CREATE UNIQUE INDEX idx_billing_businesses_user_unique
  ON billing_businesses(user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_billing_businesses_updated_at
  BEFORE UPDATE ON billing_businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
