// src/modules/groups/groups.validator.js
const { body, param, query } = require('express-validator');

const VALID_VISIBILITY = ['public', 'prive', 'sur_invitation'];
const VALID_ROLES = ['membre', 'moderateur', 'admin'];
const VALID_STATUS = ['actif', 'en_attente', 'refuse'];
// Catégories de l'annuaire (cf. contrainte CHECK sur groups.group_category)
const GROUP_CATEGORIES = ['cellule_priere', 'etude_biblique', 'jeunesse', 'autre'];

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
  body('visibility').optional().isIn(VALID_VISIBILITY),
  // Champs d'annuaire (ajoutés par 007_community_tools_module)
  body('group_category').optional({ nullable: true }).isIn(GROUP_CATEGORIES)
    .withMessage(`La catégorie doit être : ${GROUP_CATEGORIES.join(', ')}`),
  body('meeting_schedule').optional({ nullable: true }).trim().isLength({ max: 200 })
    .withMessage('Les horaires ne peuvent pas dépasser 200 caractères'),
  body('location_info').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('is_directory_visible').optional().isBoolean()
    .withMessage('is_directory_visible doit être un booléen')
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

const directorySchema = [
  query('category')
    .optional()
    .isIn(GROUP_CATEGORIES)
    .withMessage(`La catégorie doit être : ${GROUP_CATEGORIES.join(', ')}`)
];

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  groupIdSchema,
  groupMemberIdSchema,
  updateRoleSchema,
  updateStatusSchema,
  directorySchema,
  GROUP_CATEGORIES
};
