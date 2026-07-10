// src/modules/profiles/profiles.routes.js
// Définition des routes Express pour le module profiles

const { Router } = require('express');
const profilesController = require('./profiles.controller');
const { authenticate } = require('../auth/auth.middleware');
const { updateProfileSchema } = require('./profiles.validation');

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

module.exports = router;
