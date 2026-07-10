// src/modules/follows/follows.validator.js
const { body, param } = require('express-validator');

const followSchema = [
  body('followed_id').isUUID().withMessage('ID utilisateur suivi invalide')
];

const unfollowSchema = [
  param('followedId').isUUID().withMessage('ID utilisateur invalide')
];

const userIdParamsSchema = [
  param('userId').isUUID().withMessage('ID utilisateur invalide')
];

module.exports = {
  followSchema,
  unfollowSchema,
  userIdParamsSchema
};
