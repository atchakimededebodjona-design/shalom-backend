-- Migration: billing_invoice_discount
-- Description: Ajoute une remise (montant fixe, en devise, appliquée après
--   TVA) sur les factures Reçu+. Le "net à payer" affiché aux utilisateurs
--   devient total - discount_amount - amount_paid (au lieu de total -
--   amount_paid). Un acompte versé à la création de facture (down_payment)
--   n'est pas stocké séparément : il crée un paiement normal dans `payments`
--   juste après la création de la facture (voir billing.service.js →
--   createInvoice), donc pas de colonne dédiée nécessaire pour lui.

ALTER TABLE invoices
  ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
