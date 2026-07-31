// src/middlewares/rate-limit.middleware.js
// Middleware de limitation de débit (rate limiting) pour les routes sensibles

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Le proxy Next.js fait passer toutes les requêtes de tous les clients
// (navigateur, mobile, scripts) par la même IP côté Express : hors production,
// un seul poste de dev épuise le quota de tout le monde en quelques allers-
// retours. On multiplie donc largement chaque limite en dev/test, tout en
// gardant les valeurs de production strictes.
const devFactor = env.NODE_ENV === 'production' ? 1 : 100;

/**
 * Rate limiter pour les routes d'authentification (login, register, refresh)
 * Limite : 10 requêtes par fenêtre de 15 minutes par IP en production.
 * Protège contre les attaques par force brute et le credential stuffing.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 * devFactor,
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
  max: 100 * devFactor,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes. Veuillez réessayer plus tard.',
    code: 'TOO_MANY_REQUESTS',
  },
});

/**
 * Rate limiter pour les soumissions de formulaires CAMAJ (endpoint public)
 * Limite : 20 requêtes par fenêtre de 15 minutes par IP
 * Freine le spam tout en laissant un visiteur remplir plusieurs formulaires.
 */
const camajLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20 * devFactor,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de demandes envoyées. Veuillez réessayer dans quelques minutes.',
    code: 'TOO_MANY_REQUESTS',
  },
});

/**
 * Rate limiter pour la vérification d'email et le renvoi de code.
 * Limite : 20 requêtes par fenêtre de 15 minutes par IP — plus généreuse que
 * authLimiter car ce flux implique légitimement plusieurs allers-retours
 * (faute de frappe sur le code, demande de renvoi) sans que ce soit un signal
 * de brute-force comme le serait une rafale de tentatives de connexion.
 */
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20 * devFactor,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.',
    code: 'TOO_MANY_REQUESTS',
  },
});

module.exports = { authLimiter, globalLimiter, camajLimiter, verificationLimiter };
