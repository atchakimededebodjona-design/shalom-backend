// src/modules/subscriptions/subscriptions.routes.js
const { Router } = require('express');
const controller = require('./subscriptions.controller');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { activateSubscriptionValidator, cancelSubscriptionValidator } = require('./subscriptions.validator');

const router = Router();

// Volontairement PAS derrière requireActiveSubscription (cf. commentaire
// subscription.middleware.js : "sauf auth/profiles/subscriptions/ambassador")
// — un utilisateur sans abonnement actif doit pouvoir consulter son statut
// et les plans disponibles.
router.use(authenticate);

/**
 * @swagger
 * /api/v1/subscriptions/status:
 *   get:
 *     summary: Statut d'abonnement de l'utilisateur connecté (actif, essai, ou aucun accès)
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Statut d'accès détaillé }
 */
router.get('/status', controller.getStatus);

/**
 * @swagger
 * /api/v1/subscriptions/plans:
 *   get:
 *     summary: "Plans d'abonnement définis (durée) — aucun tarif : non décidé côté produit à ce jour"
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste des plans (mensuel, trimestriel, semestriel, annuel) }
 */
router.get('/plans', controller.listPlans);

/**
 * @swagger
 * /api/v1/subscriptions/admin/activate:
 *   post:
 *     summary: "[Admin] Active/renouvelle l'abonnement d'un utilisateur après confirmation manuelle d'un paiement réel"
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, plan, amount, payment_reference]
 *             properties:
 *               user_id: { type: string, format: uuid }
 *               plan: { type: string, enum: [mensuel, trimestriel, semestriel, annuel] }
 *               amount: { type: integer, description: 'Montant réellement payé, FCFA' }
 *               payment_reference: { type: string, description: 'Référence du paiement réel (Mobile Money, virement...) — idempotent' }
 *     responses:
 *       201: { description: Abonnement activé }
 *       200: { description: Référence déjà traitée (idempotent) }
 *       403: { description: Accès réservé aux administrateurs }
 */
router.post('/admin/activate', requireAdmin, activateSubscriptionValidator, controller.activate);

/**
 * @swagger
 * /api/v1/subscriptions/admin/{userId}/cancel:
 *   patch:
 *     summary: "[Admin] Annule l'abonnement actif d'un utilisateur (effet immédiat)"
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Abonnement annulé }
 *       404: { description: Aucun abonnement actif à annuler }
 */
router.patch('/admin/:userId/cancel', requireAdmin, cancelSubscriptionValidator, controller.cancel);

module.exports = router;
