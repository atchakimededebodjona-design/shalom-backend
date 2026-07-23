// src/modules/auth/auth.routes.js
// Définition des routes Express pour le module auth

const { Router } = require('express');
const authController = require('./auth.controller');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('./auth.validation');

const router = Router();

// --- Routes publiques (pas besoin d'authentification) ---
// Rate limiter désactivé temporairement à la demande de l'utilisateur (dev) —
// à réactiver avant la mise en production.

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Inscription d'un utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, display_name]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               display_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       409:
 *         description: L'email est déjà utilisé
 */
router.post('/register', registerSchema, authController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie, retourne tokens
 *       401:
 *         description: Identifiants invalides
 */
router.post('/login', loginSchema, authController.login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Rafraîchir le token d'accès
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nouveau token d'accès généré
 *       401:
 *         description: Refresh token invalide ou expiré
 */
router.post('/refresh', refreshSchema, authController.refresh);

module.exports = router;
