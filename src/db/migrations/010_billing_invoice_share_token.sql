-- Migration: billing_invoice_share_token
-- Description: Ajoute un jeton de partage public par facture, pour permettre
--   au client (qui n'a pas forcément de compte SHALOM) de consulter/imprimer
--   sa facture via un lien public, notamment envoyé par WhatsApp.
--   L'UUID aléatoire sert de secret non devinable (pas d'auth requise sur la
--   route publique correspondante).

ALTER TABLE invoices
  ADD COLUMN share_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX idx_invoices_share_token ON invoices(share_token);
