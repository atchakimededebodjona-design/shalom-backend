// src/utils/admin.js
// Source unique de vérité pour savoir si un email est administrateur.
// La liste des administrateurs est définie via la variable d'environnement
// ADMIN_EMAILS (emails séparés par des virgules).

/**
 * Renvoie la liste normalisée (minuscules, sans espaces) des emails admin.
 * @returns {string[]}
 */
const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * Indique si un email appartient à un administrateur.
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
const isAdminEmail = (email) => {
  if (!email) return false;
  return getAdminEmails().includes(String(email).trim().toLowerCase());
};

module.exports = { getAdminEmails, isAdminEmail };
