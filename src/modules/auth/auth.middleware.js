// src/modules/auth/auth.middleware.js
// Middleware de vérification du JWT pour les routes protégées

const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * Middleware d'authentification JWT
 * Vérifie le token dans le header Authorization: Bearer <token>
 * Attache req.user avec { id, email, role } si valide
 */
const authenticate = (req, _res, next) => {
  try {
    // Extraire le header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Token d\'authentification manquant',
        401,
        'MISSING_TOKEN'
      );
    }

    // Extraire le token après "Bearer "
    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError(
        'Token d\'authentification invalide',
        401,
        'INVALID_TOKEN'
      );
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Attacher les informations de l'utilisateur à la requête
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // Erreur spécifique JWT — token expiré
    if (error.name === 'TokenExpiredError') {
      return next(
        new AppError('Le token a expiré', 401, 'TOKEN_EXPIRED')
      );
    }

    // Erreur spécifique JWT — token malformé
    if (error.name === 'JsonWebTokenError') {
      return next(
        new AppError('Token invalide', 401, 'INVALID_TOKEN')
      );
    }

    // Propager les AppError telles quelles
    if (error.isOperational) {
      return next(error);
    }

    // Erreur inattendue
    return next(
      new AppError('Erreur d\'authentification', 401, 'AUTH_ERROR')
    );
  }
};

module.exports = { authenticate };
