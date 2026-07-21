// src/modules/businesses/businesses.service.js
// Accès aux données du profil « entreprise émettrice » (module Reçu+).
// Une entreprise par membre (unicité par user_id, soft delete via deleted_at).

const { query } = require('../../config/db');

const getByUser = async (userId) => {
  const result = await query(
    `SELECT * FROM billing_businesses WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return result.rows[0] || null;
};

const create = async (userId, { name, address, phone, tax_id, currency, invoice_prefix, logo_url }) => {
  const result = await query(
    `INSERT INTO billing_businesses
       (user_id, name, address, phone, tax_id, currency, invoice_prefix, logo_url)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'XOF'), COALESCE($7, 'FAC'), $8)
     RETURNING *`,
    [
      userId,
      name,
      address || null,
      phone || null,
      tax_id || null,
      currency || null,
      invoice_prefix || null,
      logo_url || null,
    ]
  );
  return result.rows[0];
};

// Mise à jour partielle : un champ non fourni (null/undefined) reste inchangé.
const updateByUser = async (userId, { name, address, phone, tax_id, currency, invoice_prefix, logo_url }) => {
  const result = await query(
    `UPDATE billing_businesses
     SET name           = COALESCE($1, name),
         address        = COALESCE($2, address),
         phone          = COALESCE($3, phone),
         tax_id         = COALESCE($4, tax_id),
         currency       = COALESCE($5, currency),
         invoice_prefix = COALESCE($6, invoice_prefix),
         logo_url       = COALESCE($7, logo_url),
         updated_at     = now()
     WHERE user_id = $8 AND deleted_at IS NULL
     RETURNING *`,
    [
      name ?? null,
      address ?? null,
      phone ?? null,
      tax_id ?? null,
      currency ?? null,
      invoice_prefix ?? null,
      logo_url ?? null,
      userId,
    ]
  );
  return result.rows[0] || null;
};

module.exports = { getByUser, create, updateByUser };
