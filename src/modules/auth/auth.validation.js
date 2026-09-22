// src/modules/auth/auth.validation.js
// Schémas de validation express-validator pour le module auth

const { body } = require('express-validator');

/**
 * Validation de l'inscription
 */
const registerSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Veuillez fournir une adresse email valide')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/[A-Z]/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule')
    .matches(/[0-9]/)
    .withMessage('Le mot de passe doit contenir au moins un chiffre'),

  body('display_name')
    .trim()
    .notEmpty()
    .withMessage('Le nom d\'affichage est requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom d\'affichage doit contenir entre 2 et 100 caractères'),

  // Optionnel : code de parrainage ambassadeur. Le format n'est pas imposé
  // ici (il évolue avec le programme Ambassadeur) — seule son existence
  // réelle est vérifiée côté service (findActiveAmbassadorByReferralCode),
  // source unique de vérité sur ce qui constitue un code valide.
  body('referral_code')
    .optional({ checkFalsy: true })
    .trim()
    .isString()
    .isLength({ max: 20 })
    .withMessage('Code de parrainage invalide'),
];

/**
 * Validation de la connexion
 */
const loginSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Veuillez fournir une adresse email valide')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),
];

/**
 * Validation du refresh token — optionnel dans le corps : peut aussi venir
 * du cookie httpOnly "refresh_token" (client web). Le contrôleur vérifie
 * qu'au moins l'un des deux est présent.
 */
const refreshSchema = [
  body('refresh_token')
    .optional()
    .isString()
    .withMessage('Le refresh token doit être une chaîne'),
];
/**
 * Validation du changement de mot de passe
 */
const changePasswordSchema = [
  body('current_password')
    .notEmpty()
    .withMessage('Le mot de passe actuel est requis'),

  body('new_password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le nouveau mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/[A-Z]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une majuscule')
    .matches(/[0-9]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins un chiffre'),
];

/**
 * Validation de la vérification d'email
 */
const verifyEmailSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Veuillez fournir une adresse email valide')
    .normalizeEmail(),
  body('code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Le code doit contenir 6 chiffres')
    .isNumeric()
    .withMessage('Le code doit contenir 6 chiffres'),
];

/**
 * Validation du renvoi de code de vérification
 */
const resendVerificationSchema = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Veuillez fournir une adresse email valide')
    .normalizeEmail(),
];

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
};
