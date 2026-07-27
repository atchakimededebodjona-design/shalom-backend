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
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
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
module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
