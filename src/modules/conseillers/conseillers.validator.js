const { body, query } = require('express-validator');

const createConseillerValidator = [
  body('user_id').isUUID().withMessage('Veuillez sélectionner un membre'),
  body('telephone').optional({ checkFalsy: true }).isString().trim().isLength({ max: 30 }),
  body('specialite').optional({ checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('bio').optional({ checkFalsy: true }).isString().trim(),
  body('is_active').optional().isBoolean(),
];

const updateConseillerValidator = [
  body('telephone').optional({ checkFalsy: true }).isString().trim().isLength({ max: 30 }),
  body('specialite').optional({ checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('bio').optional({ checkFalsy: true }).isString().trim(),
  body('is_active').optional().isBoolean(),
];

const listConseillersValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  createConseillerValidator,
  updateConseillerValidator,
  listConseillersValidator,
};
