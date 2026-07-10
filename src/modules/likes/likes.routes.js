// src/modules/likes/likes.routes.js
// Routes pour le module likes

const { Router } = require('express');
const likesController = require('./likes.controller');
const { authenticate } = require('../auth/auth.middleware');
const { likeSchema } = require('./likes.validator');

const router = Router();

// L'authentification est requise pour toutes les actions de like
router.use(authenticate);

/**
 * @swagger
 * /api/v1/likes:
 *   post:
 *     summary: Ajouter un like à un contenu
 *     tags: [Likes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [likeable_type, likeable_id]
 *             properties:
 *               likeable_type:
 *                 type: string
 *                 enum: [post, comment]
 *               likeable_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Like ajouté
 *       409:
 *         description: Déjà liké
 */
router.post('/', likeSchema, likesController.addLike);

/**
 * @swagger
 * /api/v1/likes:
 *   delete:
 *     summary: Retirer un like
 *     tags: [Likes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [likeable_type, likeable_id]
 *             properties:
 *               likeable_type:
 *                 type: string
 *                 enum: [post, comment]
 *               likeable_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Like retiré
 *       404:
 *         description: Like non trouvé
 */
router.delete('/', likeSchema, likesController.removeLike);

module.exports = router;
