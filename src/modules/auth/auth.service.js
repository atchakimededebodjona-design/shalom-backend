// src/modules/auth/auth.service.js
// Service du module auth — logique métier et requêtes SQL pour la table users

const { query } = require('../../config/db');

// Verrouillage de compte (indépendant du rate limiting par IP) : au-delà de
// FAILED_ATTEMPTS_THRESHOLD échecs, le compte est bloqué LOCKOUT_DURATION_MINUTES.
const FAILED_ATTEMPTS_THRESHOLD = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Vérification d'email : durée de validité du code et nombre d'essais avant
// qu'un nouveau code (renvoyé par email) soit obligatoire — empêche un
// brute-force du code à 6 chiffres (1 million de combinaisons).
const VERIFICATION_CODE_TTL_MINUTES = 15;
const VERIFICATION_ATTEMPTS_THRESHOLD = 5;

/**
 * Crée un nouvel utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {string} passwordHash - Mot de passe hashé avec bcrypt
 * @returns {Promise<object>} L'utilisateur créé (sans password_hash)
 */
const createUser = async (email, passwordHash) => {
  const result = await query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, role, is_active, created_at`,
    [email, passwordHash]
  );
  return result.rows[0];
};

/**
 * Recherche un utilisateur par email (inclut le hash pour vérification)
 * @param {string} email
 * @returns {Promise<object|null>}
 */
const findUserByEmail = async (email) => {
  const result = await query(
    `SELECT id, email, password_hash, role, is_active, created_at,
            failed_login_attempts, locked_until,
            email_verified, email_verification_code_hash,
            email_verification_expires_at, email_verification_attempts
     FROM users
     WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );
  return result.rows[0] || null;
};

/**
 * Recherche un utilisateur par ID (sans le hash du mot de passe)
 * @param {string} id - UUID de l'utilisateur
 * @returns {Promise<object|null>}
 */
const findUserById = async (id) => {
  const result = await query(
    `SELECT id, email, role, is_active, created_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Recherche un utilisateur par ID en incluant le hash du mot de passe
 * (nécessaire pour vérifier le mot de passe actuel avant de le changer).
 * @param {string} id - UUID de l'utilisateur
 * @returns {Promise<object|null>}
 */
const findUserByIdWithPassword = async (id) => {
  const result = await query(
    `SELECT id, email, password_hash
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Met à jour le mot de passe hashé d'un utilisateur.
 * @param {string} userId
 * @param {string} passwordHash
 */
const updatePassword = async (userId, passwordHash) => {
  await query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [passwordHash, userId]
  );
};

/**
 * Met à jour le refresh token de l'utilisateur
 * @param {string} userId - UUID de l'utilisateur
 * @param {string|null} refreshToken - Refresh token hashé (null pour révoquer)
 */
const updateRefreshToken = async (userId, refreshToken) => {
  await query(
    `UPDATE users
     SET refresh_token = $1, updated_at = now()
     WHERE id = $2`,
    [refreshToken, userId]
  );
};

/**
 * Récupère le refresh token stocké d'un utilisateur
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<string|null>}
 */
const getRefreshToken = async (userId) => {
  const result = await query(
    `SELECT refresh_token FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return result.rows[0]?.refresh_token || null;
};

/**
 * Enregistre un échec de connexion. Verrouille le compte
 * FAILED_ATTEMPTS_THRESHOLD atteint (indépendamment de l'IP d'origine).
 * @param {string} userId
 */
const registerFailedLoginAttempt = async (userId) => {
  await query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= $2
             THEN now() + ($3 || ' minutes')::interval
           ELSE locked_until
         END
     WHERE id = $1`,
    [userId, FAILED_ATTEMPTS_THRESHOLD, LOCKOUT_DURATION_MINUTES]
  );
};

/**
 * Réinitialise le compteur d'échecs après une connexion réussie.
 * @param {string} userId
 */
const resetFailedLoginAttempts = async (userId) => {
  await query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [userId]
  );
};

/**
 * Enregistre le hash d'un nouveau code de vérification d'email (inscription
 * initiale ou renvoi) et réinitialise le compteur d'essais.
 * @param {string} userId
 * @param {string} codeHash
 */
const setEmailVerificationCode = async (userId, codeHash) => {
  await query(
    `UPDATE users
     SET email_verification_code_hash = $1,
         email_verification_expires_at = now() + ($2 || ' minutes')::interval,
         email_verification_attempts = 0
     WHERE id = $3`,
    [codeHash, VERIFICATION_CODE_TTL_MINUTES, userId]
  );
};

/**
 * Incrémente le compteur d'essais de vérification. Au-delà du seuil, invalide
 * le code en cours (un nouveau code — renvoyé par email — devient nécessaire).
 * @param {string} userId
 */
const registerFailedVerificationAttempt = async (userId) => {
  await query(
    `UPDATE users
     SET email_verification_attempts = email_verification_attempts + 1,
         email_verification_code_hash = CASE
           WHEN email_verification_attempts + 1 >= $2 THEN NULL
           ELSE email_verification_code_hash
         END,
         email_verification_expires_at = CASE
           WHEN email_verification_attempts + 1 >= $2 THEN NULL
           ELSE email_verification_expires_at
         END
     WHERE id = $1`,
    [userId, VERIFICATION_ATTEMPTS_THRESHOLD]
  );
};

/**
 * Marque l'email comme vérifié et efface le code.
 * @param {string} userId
 */
const markEmailVerified = async (userId) => {
  await query(
    `UPDATE users
     SET email_verified = true,
         email_verification_code_hash = NULL,
         email_verification_expires_at = NULL,
         email_verification_attempts = 0
     WHERE id = $1`,
    [userId]
  );
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByIdWithPassword,
  updatePassword,
  updateRefreshToken,
  getRefreshToken,
  registerFailedLoginAttempt,
  resetFailedLoginAttempts,
  setEmailVerificationCode,
  registerFailedVerificationAttempt,
  markEmailVerified,
};
