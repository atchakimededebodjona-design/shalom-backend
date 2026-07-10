// src/modules/likes/likes.validator.js
// Validation des entrées pour les likes

const { body } = require('express-validator');

// Les types autorisés par l'ENUM SQL
const VALID_LIKEABLE_TYPES = ['post', 'comment'];

/**
 * Schéma de validation pour ajouter ou retirer un like
 */
const likeSchema = [
  body('likeable_type')
    .notEmpty()
    .withMessage('Le type de ressource ciblée est requis')
    .isIn(VALID_LIKEABLE_TYPES)
    .withMessage(`Le type doit être l'un des suivants : ${VALID_LIKEABLE_TYPES.join(', ')}`),

  body('likeable_id')
    .notEmpty()
    .withMessage('L\'ID de la ressource ciblée est requis')
    .isUUID()
    .withMessage('L\'ID de la ressource doit être un UUID valide'),
];

module.exports = {
  likeSchema,
};
