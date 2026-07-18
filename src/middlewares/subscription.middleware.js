// src/middlewares/subscription.middleware.js
// Bloque l'accès aux fonctionnalités payantes de SHALOM si l'utilisateur n'a
// ni essai gratuit en cours (7 jours depuis l'inscription) ni abonnement actif.
// À appliquer après `authenticate` sur tous les modules protégés, sauf
// auth/profiles/subscriptions/ambassador (voir app.js et chaque *.routes.js).

const { query } = require('../config/db');
const { AppError } = require('./error.middleware');

const TRIAL_DAYS = 7;

const requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const subRes = await query(
      `SELECT id FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND expires_at > now()
       LIMIT 1`,
      [userId]
    );
    if (subRes.rows.length > 0) return next();

    const userRes = await query('SELECT created_at FROM users WHERE id = $1', [userId]);
    const createdAt = userRes.rows[0]?.created_at;
    if (createdAt) {
      const trialEndsAt = new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      if (trialEndsAt > new Date()) return next();
    }

    throw new AppError(
      "Votre essai gratuit de 7 jours est terminé. Abonnez-vous pour continuer à utiliser SHALOM.",
      402,
      'SUBSCRIPTION_REQUIRED'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { requireActiveSubscription, TRIAL_DAYS };
