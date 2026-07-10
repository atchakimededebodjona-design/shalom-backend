// src/modules/profiles/profiles.service.js
// Service du module profiles — logique métier et requêtes SQL pour la table profiles

const { query } = require('../../config/db');

/**
 * Crée un profil utilisateur lié à un user
 * @param {string} userId - UUID de l'utilisateur
 * @param {string} displayName - Nom d'affichage
 * @returns {Promise<object>} Le profil créé
 */
const createProfile = async (userId, displayName) => {
  const result = await query(
    `INSERT INTO profiles (user_id, display_name)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, displayName]
  );
  return result.rows[0];
};

/**
 * Récupère le profil complet d'un utilisateur (user + profile joint)
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<object|null>}
 */
const findProfileByUserId = async (userId) => {
  const result = await query(
    `SELECT
       u.id,
       u.email,
       u.role,
       u.is_active,
       u.created_at AS user_created_at,
       p.display_name,
       p.avatar_url,
       p.cover_url,
       p.bio,
       p.country,
       p.city,
       p.church_name,
       p.denomination,
       p.website,
       p.plan,
       p.is_ambassador,
       p.credits_balance,
       p.is_verified,
       p.created_at AS profile_created_at,
       p.updated_at AS profile_updated_at
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Met à jour les champs autorisés du profil
 * @param {string} userId - UUID de l'utilisateur
 * @param {object} fields - Champs à mettre à jour
 * @returns {Promise<object>} Le profil mis à jour
 */
const updateProfile = async (userId, fields) => {
  // Champs autorisés pour la mise à jour
  const allowedFields = [
    'display_name',
    'avatar_url',
    'cover_url',
    'bio',
    'country',
    'city',
    'church_name',
    'denomination',
    'website',
  ];

  // Construire dynamiquement la requête SET
  const updates = [];
  const values = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(fields[field]);
      paramIndex++;
    }
  }

  // Si aucun champ à mettre à jour, retourner le profil existant
  if (updates.length === 0) {
    return findProfileByUserId(userId);
  }

  // Ajouter updated_at et le userId
  updates.push(`updated_at = now()`);
  values.push(userId);

  const result = await query(
    `UPDATE profiles
     SET ${updates.join(', ')}
     WHERE user_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
};

module.exports = {
  createProfile,
  findProfileByUserId,
  updateProfile,
};
