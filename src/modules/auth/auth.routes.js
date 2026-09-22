// src/modules/auth/auth.routes.js
// Définition des routes Express pour le module auth

const { Router } = require('express');
const authController = require('./auth.controller');
const { authenticate } = require('./auth.middleware');
const { authLimiter, verificationLimiter } = require('../../middlewares/rate-limit.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} = require('./auth.validation');

const router = Router();

// --- Routes publiques (pas besoin d'authentification) ---
// authLimiter (10 req/15min/IP) protège contre le brute-force et le
// credential stuffing sur ces 3 routes sensibles.

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
 *               referral_code:
 *                 type: string
 *                 description: "Code de parrainage ambassadeur (optionnel), ex: SHLM-AB123"
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Code de parrainage invalide ou inactif
 *       409:
 *         description: L'email est déjà utilisé
 */
router.post('/register', authLimiter, registerSchema, authController.register);

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
router.post('/login', authLimiter, loginSchema, authController.login);

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
router.post('/refresh', authLimiter, refreshSchema, authController.refresh);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Vérifier l'email avec le code reçu et finaliser l'inscription
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string }
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email vérifié, tokens émis
 *       400:
 *         description: Code invalide ou expiré
 */
router.post('/verify-email', verificationLimiter, verifyEmailSchema, authController.verifyEmail);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Renvoyer un nouveau code de vérification par email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Réponse générique (anti-énumération)
 */
router.post('/resend-verification', verificationLimiter, resendVerificationSchema, authController.resendVerification);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Déconnexion (révoque le refresh token, efface les cookies)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *       401:
 *         description: Non authentifié
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /api/v1/auth/password:
 *   patch:
 *     summary: Changer le mot de passe du compte connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mot de passe modifié avec succès
 *       401:
 *         description: Mot de passe actuel incorrect
 */
router.patch('/password', authenticate, changePasswordSchema, authController.changePassword);

module.exports = router;
