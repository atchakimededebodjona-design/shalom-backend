// src/utils/validate.js
// Utilitaire de validation — factorise la vérification des erreurs express-validator

const { validationResult } = require('express-validator');

/**
 * Vérifie les erreurs de validation express-validator.
 * Si des erreurs existent, envoie une réponse 400 et retourne true.
 * Sinon, retourne false (pas d'erreur).
 *
 * @param {import('express').Request} req - Requête Express
 * @param {import('express').Response} res - Réponse Express
 * @returns {boolean} true si des erreurs ont été trouvées (réponse envoyée), false sinon
 *
 * @example
 * const handleValidationErrors = async (req, res, next) => {
 *   if (hasValidationErrors(req, res)) return;
 *   // ... suite du traitement
 * };
 */
const hasValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors:', errors.array());
    res.status(400).json({
      success: false,
      error: 'Erreurs de validation',
      code: 'VALIDATION_ERROR',
      details: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
    return true;
  }
  return false;
};

module.exports = { hasValidationErrors };
