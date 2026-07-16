// src/modules/camaj/camaj.service.js
// Accès aux données pour la table camaj_submissions.

const { query } = require('../../config/db');

/**
 * Enregistre une demande CAMAJ.
 * @param {{ type: string, nom: string|null, email: string|null, whatsapp: string|null, payload: object }} data
 */
const creerSubmission = async ({ type, nom, email, whatsapp, payload }) => {
  const result = await query(
    `INSERT INTO camaj_submissions (type, nom, email, whatsapp, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, status, created_at`,
    [type, nom, email, whatsapp, JSON.stringify(payload ?? {})]
  );
  return result.rows[0];
};

/**
 * Liste paginée des demandes (usage admin), filtrable par type et statut.
 */
const listerSubmissions = async ({ type, status, page, limit }) => {
  const conditions = [];
  const filtres = [];
  if (type) { filtres.push(type); conditions.push(`type = $${filtres.length}`); }
  if (status) { filtres.push(status); conditions.push(`status = $${filtres.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const params = [...filtres, limit, (page - 1) * limit];
  const lignes = await query(
    `SELECT id, type, nom, email, whatsapp, payload, status, created_at
     FROM camaj_submissions
     ${where}
     ORDER BY created_at DESC
     LIMIT $${filtres.length + 1} OFFSET $${filtres.length + 2}`,
    params
  );

  const total = await query(
    `SELECT COUNT(*)::int AS total FROM camaj_submissions ${where}`,
    filtres
  );

  return {
    submissions: lignes.rows,
    total: total.rows[0].total,
    page,
    limit,
  };
};

/**
 * Change le statut d'une demande (nouveau | traite | archive).
 * @param {{ id: string, status: string }} data
 * @returns {Promise<object|null>} la ligne mise à jour, ou null si introuvable.
 */
const changerStatut = async ({ id, status }) => {
  const result = await query(
    `UPDATE camaj_submissions
     SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, type, nom, email, whatsapp, payload, status, created_at, updated_at`,
    [id, status]
  );
  return result.rows[0] || null;
};

/**
 * Compteurs pour le tableau de bord admin : totaux par statut et par type.
 * @returns {Promise<{ total:number, parStatut:object, parType:object }>}
 */
const statsSubmissions = async () => {
  const parStatut = await query(
    `SELECT status, COUNT(*)::int AS n FROM camaj_submissions GROUP BY status`
  );
  const parType = await query(
    `SELECT type, COUNT(*)::int AS n FROM camaj_submissions GROUP BY type`
  );

  const statut = {};
  let total = 0;
  parStatut.rows.forEach((r) => { statut[r.status] = r.n; total += r.n; });

  const type = {};
  parType.rows.forEach((r) => { type[r.type] = r.n; });

  return { total, parStatut: statut, parType: type };
};

module.exports = { creerSubmission, listerSubmissions, changerStatut, statsSubmissions };
