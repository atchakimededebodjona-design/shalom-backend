// src/modules/groups/groups.validator.js
const { body, param } = require('express-validator');

const VALID_VISIBILITY = ['public', 'prive', 'sur_invitation'];
const VALID_ROLES = ['membre', 'moderateur', 'admin'];
const VALID_STATUS = ['actif', 'en_attente', 'refuse'];

const createGroupSchema = [
  body('name').trim().notEmpty().withMessage('Le nom du groupe est requis').isLength({ max: 150 }),
  body('description').optional().trim(),
  body('cover_url').optional().trim().isURL().withMessage('URL invalide'),
  body('visibility').optional().isIn(VALID_VISIBILITY).withMessage('Visibilité invalide')
];

const updateGroupSchema = [
  param('id').isString().withMessage('ID invalide'),
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('description').optional().trim(),
  body('cover_url').optional().trim().isURL(),
  body('visibility').optional().isIn(VALID_VISIBILITY)
];

const groupIdSchema = [
  param('id').isString().withMessage('ID invalide')
];

const groupMemberIdSchema = [
  param('id').isString().withMessage('ID groupe invalide'),
  param('userId').isString().withMessage('ID utilisateur invalide')
];

const updateRoleSchema = [
  ...groupMemberIdSchema,
  body('role').isIn(VALID_ROLES).withMessage('Rôle invalide')
];

const updateStatusSchema = [
  ...groupMemberIdSchema,
  body('status').isIn(VALID_STATUS).withMessage('Statut invalide')
];

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  groupIdSchema,
  groupMemberIdSchema,
  updateRoleSchema,
  updateStatusSchema
};
