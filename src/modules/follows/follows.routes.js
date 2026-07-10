// src/modules/follows/follows.routes.js
const { Router } = require('express');
const followsController = require('./follows.controller');
const { authenticate } = require('../auth/auth.middleware');
const { 
  followSchema, 
  unfollowSchema, 
  userIdParamsSchema 
} = require('./follows.validator');

const router = Router();
router.use(authenticate);

// Action pour l'utilisateur connecté
/**
 * @swagger
 * /api/v1/follows:
 *   post:
 *     summary: Suivre un utilisateur
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [followed_id]
 *             properties:
 *               followed_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Abonnement réussi
 *       400:
 *         description: Impossible de se suivre soi-même
 *       409:
 *         description: Déjà abonné
 */
router.post('/', followSchema, followsController.followUser);

/**
 * @swagger
 * /api/v1/follows/{followedId}:
 *   delete:
 *     summary: Se désabonner d'un utilisateur
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: followedId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Désabonnement réussi
 *       404:
 *         description: Abonnement inexistant
 */
router.delete('/:followedId', unfollowSchema, followsController.unfollowUser);

// Consultations (pour un utilisateur donné)
// Ces routes seront montées sur /api/v1/user dans app.js ou bien encapsulées ici.
// Selon le prompt : /api/v1/user/:userId/followers
/**
 * @swagger
 * /api/v1/follows/user/{userId}/followers:
 *   get:
 *     summary: Lister les abonnés d'un utilisateur
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des abonnés
 */
router.get('/user/:userId/followers', userIdParamsSchema, followsController.getFollowers);

/**
 * @swagger
 * /api/v1/follows/user/{userId}/following:
 *   get:
 *     summary: Lister les abonnements d'un utilisateur
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des abonnements
 */
router.get('/user/:userId/following', userIdParamsSchema, followsController.getFollowing);

/**
 * @swagger
 * /api/v1/follows/user/{userId}/follow-status:
 *   get:
 *     summary: Vérifier le statut d'abonnement
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut d'abonnement retourné
 */
router.get('/user/:userId/follow-status', userIdParamsSchema, followsController.checkFollowStatus);

module.exports = router;
