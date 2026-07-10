const { body, param, query } = require('express-validator');

const createReportValidator = [
  body('target_type')
    .isIn(['post', 'comment'])
    .withMessage('Le type de cible doit être post ou comment'),
  body('target_id')
    .isUUID()
    .withMessage('L\'ID de la cible doit être un UUID valide'),
  body('reason')
    .isIn(['spam', 'contenu_inapproprie', 'harcelement', 'faux_compte', 'autre'])
    .withMessage('La raison du signalement est invalide'),
  body('details')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Les détails ne doivent pas dépasser 500 caractères')
];

const listReportsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  query('status')
    .optional()
    .isIn(['en_attente', 'traite', 'rejete'])
    .withMessage('Le statut est invalide')
];

const updateReportValidator = [
  param('id')
    .isUUID()
    .withMessage('L\'ID du signalement doit être un UUID valide'),
  body('status')
    .isIn(['traite', 'rejete'])
    .withMessage('Le statut doit être traite ou rejete'),
  body('apply_action')
    .optional()
    .isBoolean()
    .withMessage('apply_action doit être un booléen')
];

module.exports = {
  createReportValidator,
  listReportsValidator,
  updateReportValidator
};
