// src/middlewares/subscription.middleware.js
// Bloque l'accès aux fonctionnalités payantes de SHALOM si l'utilisateur n'a
// ni essai gratuit en cours (7 jours depuis l'inscription) ni abonnement actif.
// À appliquer après `authenticate` sur tous les modules protégés, sauf
// auth/profiles/subscriptions/ambassador (voir app.js et chaque *.routes.js).

const { AppError } = require('./error.middleware');
// Source de vérité unique pour le calcul d'accès (abonnement actif ou essai)
// — réutilisée telle quelle par GET /api/v1/subscriptions/status, pour que
// le statut affiché au frontend et la décision réelle du gate ne divergent
// jamais.
const { getSubscriptionStatus, TRIAL_DAYS } = require('../modules/subscriptions/subscriptions.service');

const requireActiveSubscription = async (req, res, next) => {
  try {
    const { access } = await getSubscriptionStatus(req.user.id);
    if (access) return next();

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
