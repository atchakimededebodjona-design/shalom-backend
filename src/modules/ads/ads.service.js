// src/modules/ads/ads.service.js
// Accès aux données de l'espace publicitaire (table `ads`, déjà présente en base).
// Schéma : title, image_url (obligatoire), link_url, is_active, display_order,
// soft delete via deleted_at. Lecture des annonces actives ouverte aux utilisateurs
// connectés ; écriture réservée aux administrateurs (contrôlée au niveau des routes).

const { query } = require('../../config/db');

const COLUMNS =
  'id, title, image_url, link_url, is_active, display_order, created_at, updated_at';

/** Annonces actives, pour le bandeau du tableau de bord. */
const listActive = async () => {
  const res = await query(
    `SELECT ${COLUMNS} FROM ads
     WHERE is_active = true AND deleted_at IS NULL
     ORDER BY display_order ASC, created_at DESC`
  );
  return res.rows;
};

/** Toutes les annonces non supprimées (actives ou non) — vue d'administration. */
const listAll = async () => {
  const res = await query(
    `SELECT ${COLUMNS} FROM ads
     WHERE deleted_at IS NULL
     ORDER BY display_order ASC, created_at DESC`
  );
  return res.rows;
};

const getById = async (id) => {
  const res = await query(
    `SELECT ${COLUMNS} FROM ads WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return res.rows[0] || null;
};

const create = async (data) => {
  const { title, image_url, link_url, is_active, display_order } = data;
  const res = await query(
    `INSERT INTO ads (title, image_url, link_url, is_active, display_order)
     VALUES ($1, $2, $3, COALESCE($4, true), COALESCE($5, 0))
     RETURNING ${COLUMNS}`,
    [
      title,
      image_url,
      link_url || null,
      is_active === undefined ? null : is_active,
      display_order === undefined ? null : display_order,
    ]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const { title, image_url, link_url, is_active, display_order } = data;
  const res = await query(
    `UPDATE ads SET
       title         = COALESCE($1, title),
       image_url     = COALESCE($2, image_url),
       link_url      = COALESCE($3, link_url),
       is_active     = COALESCE($4, is_active),
       display_order = COALESCE($5, display_order),
       updated_at    = now()
     WHERE id = $6 AND deleted_at IS NULL
     RETURNING ${COLUMNS}`,
    [
      title ?? null,
      image_url ?? null,
      link_url ?? null,
      is_active ?? null,
      display_order ?? null,
      id,
    ]
  );
  return res.rows[0] || null;
};

/** Soft delete (cohérent avec deleted_at). */
const remove = async (id) => {
  const res = await query(
    `UPDATE ads SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id]
  );
  return res.rowCount > 0;
};

module.exports = { listActive, listAll, getById, create, update, remove };
