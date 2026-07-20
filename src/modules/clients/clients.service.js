// src/modules/clients/clients.service.js
// Accès aux données des clients à facturer (module Reçu+). Cloisonné par user_id,
// soft delete via deleted_at.

const { query } = require('../../config/db');

const create = async (userId, { name, email, phone, address }) => {
  const result = await query(
    `INSERT INTO billing_clients (user_id, name, email, phone, address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, name, email || null, phone || null, address || null]
  );
  return result.rows[0];
};

const list = async (userId, { search, limit, offset }) => {
  const filters = [userId];
  let where = 'user_id = $1 AND deleted_at IS NULL';
  if (search) {
    filters.push(`%${search}%`);
    where += ` AND name ILIKE $${filters.length}`;
  }

  const countResult = await query(`SELECT count(*)::int AS total FROM billing_clients WHERE ${where}`, filters);
  const total = countResult.rows[0].total;

  const rowsResult = await query(
    `SELECT * FROM billing_clients WHERE ${where}
     ORDER BY name ASC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { clients: rowsResult.rows, total };
};

const getById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM billing_clients WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const update = async (id, userId, { name, email, phone, address }) => {
  const result = await query(
    `UPDATE billing_clients
     SET name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         address = COALESCE($4, address),
         updated_at = now()
     WHERE id = $5 AND user_id = $6 AND deleted_at IS NULL
     RETURNING *`,
    [name ?? null, email ?? null, phone ?? null, address ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDelete = async (id, userId) => {
  const result = await query(
    `UPDATE billing_clients SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

module.exports = { create, list, getById, update, softDelete };
