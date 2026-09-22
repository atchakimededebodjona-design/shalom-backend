const { body, param } = require('express-validator');
const { PAID_PLANS } = require('./subscriptions.service');

const activateSubscriptionValidator = [
  body('user_id').isUUID().withMessage("L'ID utilisateur doit être un UUID valide"),
  body('plan').isIn(PAID_PLANS).withMessage(`Le plan doit être : ${PAID_PLANS.join(', ')}`),
  body('amount').isInt({ min: 1 }).withMessage('Le montant doit être un entier positif (FCFA)'),
  body('payment_reference')
    .trim()
    .notEmpty()
    .withMessage('La référence de paiement est requise')
    .isLength({ max: 150 })
    .withMessage('La référence de paiement ne peut pas dépasser 150 caractères'),
];

const cancelSubscriptionValidator = [
  param('userId').isUUID().withMessage("L'ID utilisateur doit être un UUID valide"),
];

module.exports = {
  activateSubscriptionValidator,
  cancelSubscriptionValidator,
};
