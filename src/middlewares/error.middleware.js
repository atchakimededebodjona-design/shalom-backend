// src/middlewares/error.middleware.js
// Middleware centralisé de gestion d'erreurs Express

/**
 * Classe d'erreur personnalisée pour l'API
 * Permet de spécifier un code HTTP et un code d'erreur interne
 */
class AppError extends Error {
  /**
   * @param {string} message - Message d'erreur (en français)
   * @param {number} statusCode - Code HTTP (400, 401, 403, 404, 409, 500...)
   * @param {string} code - Code d'erreur interne (ex: 'EMAIL_ALREADY_EXISTS')
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

/**
 * Middleware de gestion des erreurs 404 (route non trouvée)
 */
const notFoundHandler = (req, res, _next) => {
  return res.status(404).json({
    success: false,
    error: `La route ${req.method} ${req.originalUrl} n'existe pas`,
    code: 'ROUTE_NOT_FOUND',
  });
};

/**
 * Middleware centralisé de gestion des erreurs
 * Capture toutes les erreurs lancées dans les contrôleurs et middlewares
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Log de l'erreur en développement
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Erreur :', err);
  }

  // Erreur opérationnelle (AppError) — réponse contrôlée
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Erreur de validation express-validator
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Le corps de la requête est invalide (JSON mal formé)',
      code: 'INVALID_JSON',
    });
  }

  // Erreur PostgreSQL — contrainte unique violée
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Cette ressource existe déjà',
      code: 'DUPLICATE_ENTRY',
    });
  }

  // Erreur PostgreSQL — clé étrangère invalide
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Référence invalide vers une ressource inexistante',
      code: 'FOREIGN_KEY_VIOLATION',
    });
  }

  // Erreur inattendue — ne pas exposer les détails en production
  return res.status(500).json({
    success: false,
    error: 'Une erreur interne est survenue',
    code: 'INTERNAL_ERROR',
  });
};

module.exports = { AppError, notFoundHandler, errorHandler };
