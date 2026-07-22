const { body, query } = require('express-validator');

const createAdValidator = [
  body('title').notEmpty().withMessage('Le titre est requis').isString().trim(),
  body('link_url').optional({ checkFalsy: true }).isURL().withMessage('Lien invalide'),
  body('is_active').optional().isBoolean(),
  body('display_order').optional().isInt().withMessage("L'ordre d'affichage doit être un entier")
];

const updateAdValidator = [
  body('title').optional().isString().trim(),
  body('link_url').optional({ checkFalsy: true }).isURL().withMessage('Lien invalide'),
  body('is_active').optional().isBoolean(),
  body('display_order').optional().isInt().withMessage("L'ordre d'affichage doit être un entier")
];

const listAdsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const reportAdValidator = [
  body('reason').optional({ checkFalsy: true }).isString().isLength({ max: 300 }).withMessage('Motif trop long (300 caractères max)')
];

module.exports = {
  createAdValidator,
  updateAdValidator,
  listAdsValidator,
  reportAdValidator
};
