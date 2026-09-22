const subscriptionsService = require('./subscriptions.service');
const { hasValidationErrors } = require('../../utils/validate');

/**
 * GET /api/v1/subscriptions/status
 * Statut d'accès de l'utilisateur connecté (abonnement actif, essai en
 * cours, ou aucun accès). Toujours disponible, y compris sans abonnement
 * actif (cette route n'est pas derrière requireActiveSubscription).
 */
const getStatus = async (req, res, next) => {
  try {
    const status = await subscriptionsService.getSubscriptionStatus(req.user.id);
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/subscriptions/plans
 * Liste des plans réellement définis (durée uniquement). Aucun tarif n'est
 * renvoyé ici : aucun prix n'est décidé nulle part dans le projet à ce jour
 * (cf. rapport). Le champ `amount` est fourni par l'admin lors de
 * l'activation, à partir du paiement réel constaté.
 */
const listPlans = async (_req, res, next) => {
  try {
    const plans = subscriptionsService.PAID_PLANS.map((plan) => ({
      plan,
      duration_days: subscriptionsService.PLAN_DURATION_DAYS[plan],
    }));
    return res.status(200).json({ success: true, data: { plans } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/subscriptions/admin/activate
 * Active/renouvelle l'abonnement d'un utilisateur suite à la confirmation
 * MANUELLE d'un paiement réel par un administrateur (Admin only).
 */
const activate = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { user_id, plan, amount, payment_reference } = req.body;

    const { subscription, idempotent } = await subscriptionsService.activateSubscription({
      userId: user_id,
      plan,
      amount,
      paymentReference: payment_reference,
    });

    return res.status(idempotent ? 200 : 201).json({
      success: true,
      message: idempotent
        ? 'Cette référence de paiement a déjà été traitée : abonnement déjà actif.'
        : 'Abonnement activé avec succès',
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/subscriptions/admin/:userId/cancel
 * Annule l'abonnement actif d'un utilisateur (Admin only).
 */
const cancel = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const subscription = await subscriptionsService.cancelSubscription(req.params.userId);
    return res.status(200).json({
      success: true,
      message: 'Abonnement annulé',
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStatus,
  listPlans,
  activate,
  cancel,
};
