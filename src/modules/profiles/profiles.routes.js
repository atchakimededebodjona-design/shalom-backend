// src/modules/profiles/profiles.routes.js
// Définition des routes Express pour le module profiles

const { Router } = require('express');
const profilesController = require('./profiles.controller');
const { authenticate } = require('../auth/auth.middleware');
const { updateProfileSchema, userIdParamSchema } = require('./profiles.validation');

const router = Router();

// --- Toutes les routes sont protégées (JWT requis) ---

/**
 * @swagger
 * /api/v1/profiles/me:
 *   get:
 *     summary: Récupérer le profil de l'utilisateur connecté
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil récupéré avec succès
 *       401:
 *         description: Non authentifié
 */
router.get('/me', authenticate, profilesController.getMe);

/**
 * @swagger
 * /api/v1/profiles/me:
 *   patch:
 *     summary: Mettre à jour le profil de l'utilisateur connecté
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *               bio:
 *                 type: string
 *               avatar_url:
 *                 type: string
 *               website:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil mis à jour
 *       401:
 *         description: Non authentifié
 */
router.patch('/me', authenticate, updateProfileSchema, profilesController.updateMe);

/**
 * @swagger
 * /api/v1/profiles/search:
 *   get:
 *     summary: Rechercher des utilisateurs par nom d'affichage
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
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
 *         description: Liste des profils correspondants
 */
// NB : déclarée AVANT /:userId pour que le segment littéral /search ait la priorité
router.get('/search', authenticate, profilesController.search);

/**
 * @swagger
 * /api/v1/profiles/{userId}:
 *   get:
 *     summary: Récupérer le profil public d'un autre utilisateur
 *     tags: [Profiles]
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
 *         description: Profil public récupéré avec succès
 *       404:
 *         description: Profil introuvable
 *       401:
 *         description: Non authentifié
 */
// NB : déclarée APRÈS /me pour que la route littérale /me ait la priorité
router.get('/:userId', authenticate, userIdParamSchema, profilesController.getById);

module.exports = router;
