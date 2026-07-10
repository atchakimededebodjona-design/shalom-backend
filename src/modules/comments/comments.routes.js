// src/modules/comments/comments.routes.js
// Routes pour le module comments

const { Router } = require('express');
const commentsController = require('./comments.controller');
const { authenticate } = require('../auth/auth.middleware');
const { addCommentSchema, postIdSchema, commentIdSchema } = require('./comments.validator');

const router = Router();

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

/**
 * @swagger
 * /api/v1/comments/post/{postId}:
 *   get:
 *     summary: Lister les commentaires d'une publication
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
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
 *         description: Liste des commentaires
 *       404:
 *         description: Publication non trouvée
 */
router.get('/post/:postId', postIdSchema, commentsController.getCommentsByPost);

/**
 * @swagger
 * /api/v1/comments/post/{postId}:
 *   post:
 *     summary: Ajouter un commentaire à une publication
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Commentaire ajouté
 *       404:
 *         description: Publication non trouvée
 */
router.post('/post/:postId', addCommentSchema, commentsController.addComment);

/**
 * @swagger
 * /api/v1/comments/{id}:
 *   delete:
 *     summary: Supprimer un commentaire
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Commentaire supprimé
 *       403:
 *         description: Non autorisé
 */
router.delete('/:id', commentIdSchema, commentsController.deleteComment);

module.exports = router;
