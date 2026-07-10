// src/modules/comments/comments.validator.js
// Validation des entrées pour les commentaires

const { body, param } = require('express-validator');

const addCommentSchema = [
  param('postId')
    .isUUID()
    .withMessage('L\'ID du post doit être un UUID valide'),

  body('content')
    .trim()
    .notEmpty()
    .withMessage('Le contenu du commentaire est requis')
    .isLength({ max: 2000 })
    .withMessage('Le commentaire ne peut pas dépasser 2000 caractères'),

  body('parent_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('L\'ID parent doit être un UUID valide'),
];

const postIdSchema = [
  param('postId')
    .isUUID()
    .withMessage('L\'ID du post doit être un UUID valide'),
];

const commentIdSchema = [
  param('id')
    .isUUID()
    .withMessage('L\'ID du commentaire doit être un UUID valide'),
];

module.exports = {
  addCommentSchema,
  postIdSchema,
  commentIdSchema,
};
