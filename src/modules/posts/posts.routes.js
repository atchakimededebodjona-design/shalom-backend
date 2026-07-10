// src/modules/posts/posts.routes.js
// Routes pour les publications (posts)

const { Router } = require('express');
const postsController = require('./posts.controller');
const { authenticate } = require('../auth/auth.middleware');
const { createPostSchema, updatePostSchema, postIdSchema } = require('./posts.validator');

const router = Router();

// Toutes les routes de posts nécessitent une authentification
router.use(authenticate);

/**
 * @swagger
 * /api/v1/posts:
 *   get:
 *     summary: Récupérer le fil d'actualité (feed)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Liste des publications
 *       401:
 *         description: Non authentifié
 */
router.get('/', postsController.getFeed);

/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Créer une nouvelle publication
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *               content:
 *                 type: string
 *               media_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Publication créée
 *       400:
 *         description: Erreur de validation
 */
router.post('/', createPostSchema, postsController.createPost);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   get:
 *     summary: Récupérer une publication par ID
 *     tags: [Posts]
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
 *         description: Détails de la publication
 *       404:
 *         description: Publication non trouvée
 */
router.get('/:id', postIdSchema, postsController.getPostById);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   patch:
 *     summary: Mettre à jour une publication
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               media_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Publication mise à jour
 *       403:
 *         description: Non autorisé à modifier cette publication
 *       404:
 *         description: Publication non trouvée
 */
router.patch('/:id', updatePostSchema, postsController.updatePost);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Supprimer une publication
 *     tags: [Posts]
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
 *         description: Publication supprimée avec succès
 *       403:
 *         description: Non autorisé à supprimer
 *       404:
 *         description: Publication non trouvée
 */
router.delete('/:id', postIdSchema, postsController.deletePost);

module.exports = router;
