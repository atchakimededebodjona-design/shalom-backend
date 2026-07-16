// src/modules/posts/posts.validator.js
// Validation des entrées pour le module posts

const { body, param, query } = require('express-validator');

// Liste des types de posts valides d'après l'ENUM SQL
const VALID_POST_TYPES = ['texte', 'image', 'video', 'temoignage', 'priere', 'annonce'];

/**
 * Validation pour la création d'un post
 */
const createPostSchema = [
  body('type')
    .optional()
    .isIn(VALID_POST_TYPES)
    .withMessage(`Le type doit être l'un des suivants : ${VALID_POST_TYPES.join(', ')}`),

  body('content')
    .trim()
    .notEmpty()
    .withMessage('Le contenu du post est requis')
    .isLength({ max: 5000 })
    .withMessage('Le contenu ne peut pas dépasser 5000 caractères'),

  body('media_url')
    .optional()
    .trim()
    .isURL({ require_tld: false }) // accepte aussi les URLs localhost (fichiers téléversés en dev)
    .withMessage('Le format de l\'URL du média est invalide'),

  body('group_id')
    .optional()
    .isUUID()
    .withMessage('L\'ID du groupe doit être un UUID valide'),
];

/**
 * Validation pour la modification d'un post
 */
const updatePostSchema = [
  param('id')
    .isUUID()
    .withMessage('L\'ID du post doit être un UUID valide'),

  body('content')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le contenu ne peut pas être vide')
    .isLength({ max: 5000 })
    .withMessage('Le contenu ne peut pas dépasser 5000 caractères'),

  body('media_url')
    .optional()
    .trim()
    .isURL({ require_tld: false }) // accepte aussi les URLs localhost (fichiers téléversés en dev)
    .withMessage('Le format de l\'URL du média est invalide'),
];

/**
 * Validation basique pour l'ID en paramètre (GET, DELETE)
 */
const postIdSchema = [
  param('id')
    .isUUID()
    .withMessage('L\'ID du post doit être un UUID valide'),
];

module.exports = {
  createPostSchema,
  updatePostSchema,
  postIdSchema,
};
