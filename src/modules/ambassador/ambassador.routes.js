// src/modules/ambassador/ambassador.routes.js
// Routes du module Ambassadeur SHALOM.
//
// Toutes les routes nécessitent un JWT valide (authenticate).
// Les routes /admin/* nécessitent en plus que l'email soit dans ADMIN_EMAILS
// (vérifié dans le contrôleur via isAdminEmail).

'use strict';

const { Router } = require('express');
const controller = require('./ambassador.controller');
const { authenticate } = require('../auth/auth.middleware');
const v = require('./ambassador.validator');

const router = Router();

// =========================================================================
// Toutes les routes nécessitent une authentification JWT
// =========================================================================
router.use(authenticate);

// =========================================================================
// Routes Ambassadeur (utilisateur)
// =========================================================================

/**
 * @swagger
 * tags:
 *   name: Ambassador
 *   description: Programme Ambassadeur SHALOM — parrainage, commissions, retraits Mobile Money
 */

/**
 * @swagger
 * /api/v1/ambassador/dashboard:
 *   get:
 *     summary: Tableau de bord ambassadeur (stats, solde, niveau)
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard complet }
 *       404: { description: Pas encore ambassadeur }
 */
router.get('/dashboard', controller.getDashboard);

/**
 * @swagger
 * /api/v1/ambassador/join:
 *   post:
 *     summary: Rejoindre le programme ambassadeur
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio: { type: string, example: 'Passionné de formation chrétienne...' }
 *     responses:
 *       201: { description: Profil ambassadeur créé (avec code de parrainage unique) }
 *       409: { description: Déjà ambassadeur }
 */
router.post('/join', v.joinProgramValidator, controller.join);

/**
 * @swagger
 * /api/v1/ambassador/profile:
 *   get:
 *     summary: Mon profil ambassadeur
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profil ambassadeur }
 *       404: { description: Pas encore ambassadeur }
 *   patch:
 *     summary: Modifier mon profil ambassadeur (bio)
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio: { type: string }
 *     responses:
 *       200: { description: Profil mis à jour }
 */
router.get('/profile', controller.getProfile);
router.patch('/profile', v.updateProfileValidator, controller.updateProfile);

/**
 * @swagger
 * /api/v1/ambassador/referral-link:
 *   get:
 *     summary: Mon lien de parrainage + lien WhatsApp
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lien de parrainage et lien WhatsApp prêts à partager }
 */
router.get('/referral-link', controller.getReferralLink);

/**
 * @swagger
 * /api/v1/ambassador/referrals:
 *   get:
 *     summary: Mes parrainages (paginé, filtre ?status=registered|subscribed|qualified)
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste paginée des parrainages }
 */
router.get('/referrals', v.listReferralsValidator, controller.listReferrals);

/**
 * @swagger
 * /api/v1/ambassador/commissions/summary:
 *   get:
 *     summary: Résumé de mes commissions par statut (totaux)
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Totaux par statut + solde disponible }
 */
router.get('/commissions/summary', controller.getCommissionSummary);

/**
 * @swagger
 * /api/v1/ambassador/commissions:
 *   get:
 *     summary: Mes commissions (paginé, filtres ?status= ?month=YYYY-MM)
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste paginée des commissions }
 */
router.get('/commissions', v.listCommissionsValidator, controller.listCommissions);

/**
 * @swagger
 * /api/v1/ambassador/withdrawals:
 *   get:
 *     summary: Historique de mes retraits Mobile Money
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste paginée des retraits }
 *   post:
 *     summary: Demander un retrait Mobile Money
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, phone_number, operator]
 *             properties:
 *               amount: { type: integer, example: 25000, description: 'FCFA — min 5 000' }
 *               phone_number: { type: string, example: '+22997123456' }
 *               operator: { type: string, enum: [mtn, moov, wave, orange, other] }
 *     responses:
 *       201: { description: Demande enregistrée (traitement sous 24-48h) }
 *       400: { description: Solde insuffisant ou plafond UEMOA atteint }
 */
router.get('/withdrawals', controller.listWithdrawals);
router.post('/withdrawals', v.requestWithdrawalValidator, controller.requestWithdrawal);

// =========================================================================
// Routes Admin — réservées aux emails dans ADMIN_EMAILS
// (vérification dans le contrôleur via isAdminEmail)
// =========================================================================

/**
 * @swagger
 * /api/v1/ambassador/admin/list:
 *   get:
 *     summary: "[Admin] Lister tous les ambassadeurs (filtres ?level= ?status=)"
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste paginée des ambassadeurs }
 *       403: { description: Accès réservé aux admins }
 */
router.get('/admin/list', v.adminListAmbassadorsValidator, controller.adminListAmbassadors);

/**
 * @swagger
 * /api/v1/ambassador/admin/{id}/level:
 *   patch:
 *     summary: "[Admin] Changer le niveau d'un ambassadeur (standard/certified)"
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [level]
 *             properties:
 *               level: { type: string, enum: [standard, certified] }
 *     responses:
 *       200: { description: Niveau mis à jour }
 */
router.patch('/admin/:id/level', v.adminSetLevelValidator, controller.adminSetLevel);

/**
 * @swagger
 * /api/v1/ambassador/admin/{id}/status:
 *   patch:
 *     summary: "[Admin] Changer le statut d'un ambassadeur"
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, suspended, pending_review] }
 *     responses:
 *       200: { description: Statut mis à jour }
 */
router.patch('/admin/:id/status', v.adminSetStatusValidator, controller.adminSetStatus);

/**
 * @swagger
 * /api/v1/ambassador/admin/commissions:
 *   get:
 *     summary: "[Admin] Lister toutes les commissions (filtres ?status= ?month= ?ambassador_id=)"
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste paginée des commissions }
 */
router.get('/admin/commissions', v.adminListCommissionsValidator, controller.adminListCommissions);

/**
 * @swagger
 * /api/v1/ambassador/admin/commissions/{id}:
 *   patch:
 *     summary: "[Admin] Approuver une commission (crédite le solde de l'ambassadeur)"
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Commission approuvée et solde crédité }
 *       404: { description: Commission introuvable }
 *       409: { description: Commission déjà traitée }
 */
router.patch('/admin/commissions/:id', v.adminApproveCommissionValidator, controller.adminApproveCommission);

/**
 * @swagger
 * /api/v1/ambassador/admin/withdrawals/{id}:
 *   patch:
 *     summary: "[Admin] Traiter un retrait (processing/completed/failed/cancelled)"
 *     tags: [Ambassador]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [processing, completed, failed, cancelled] }
 *               reference: { type: string, description: 'Référence Mobile Money' }
 *               admin_notes: { type: string }
 *     responses:
 *       200: { description: Retrait mis à jour (remboursement automatique si failed/cancelled) }
 */
router.patch('/admin/withdrawals/:id', v.adminProcessWithdrawalValidator, controller.adminProcessWithdrawal);

module.exports = router;
