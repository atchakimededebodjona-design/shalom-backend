// src/modules/profiles/profiles.validation.js
// Schémas de validation express-validator pour le module profiles

const { body, param } = require('express-validator');

/**
 * Validation du paramètre userId (consultation d'un profil public)
 */
const userIdParamSchema = [
  param('userId')
    .isUUID()
    .withMessage("L'identifiant utilisateur doit être un UUID valide"),
];

/**
 * Validation de la mise à jour du profil
 * Tous les champs sont optionnels
 */
const updateProfileSchema = [
  body('display_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom d\'affichage doit contenir entre 2 et 100 caractères'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La biographie ne peut pas dépasser 500 caractères'),

  body('avatar_url')
    .optional()
    .trim()
    .isURL({ require_tld: false }) // accepte aussi les URLs localhost (fichiers téléversés en dev)
    .withMessage('L\'URL de l\'avatar doit être une URL valide'),

  body('cover_url')
    .optional()
    .trim()
    .isURL({ require_tld: false }) // accepte aussi les URLs localhost (fichiers téléversés en dev)
    .withMessage('L\'URL de couverture doit être une URL valide'),

  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Le pays ne peut pas dépasser 100 caractères'),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La ville ne peut pas dépasser 100 caractères'),

  body('church_name')
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Le nom de l\'église ne peut pas dépasser 150 caractères'),

  body('denomination')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La dénomination ne peut pas dépasser 100 caractères'),

  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('L\'URL du site web doit être valide'),
];

module.exports = {
  updateProfileSchema,
  userIdParamSchema,
};
