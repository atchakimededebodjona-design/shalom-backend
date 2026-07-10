// src/middlewares/rate-limit.middleware.js
// Middleware de limitation de débit (rate limiting) pour les routes sensibles

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter pour les routes d'authentification (login, register, refresh)
 * Limite : 10 requêtes par fenêtre de 15 minutes par IP
 * Protège contre les attaques par force brute et le credential stuffing
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true, // Renvoie les headers RateLimit-* (standard IETF)
  legacyHeaders: false, // Désactive les headers X-RateLimit-*
  message: {
    success: false,
    error: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.',
    code: 'TOO_MANY_REQUESTS',
  },
});

/**
 * Rate limiter global pour l'API
 * Limite : 100 requêtes par fenêtre de 15 minutes par IP
 * Protège contre les abus généraux
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes. Veuillez réessayer plus tard.',
    code: 'TOO_MANY_REQUESTS',
  },
});

module.exports = { authLimiter, globalLimiter };
