const { body, query } = require('express-validator');

const createContentValidator = [
  body('title').notEmpty().withMessage('Le titre est requis').isString().trim(),
  body('type').isIn(['video', 'audio', 'text', 'photo']).withMessage('Type invalide (video, audio, text, photo)'),
  body('target_audience').isIn(['adult', 'child', 'all']).withMessage('Audience cible invalide (adult, child, all)'),
  body('is_published').optional().isBoolean(),
  body('duration_seconds').optional().isInt({ min: 0 }).withMessage('La durée doit être un entier positif')
];

const updateContentValidator = [
  body('title').optional().isString().trim(),
  body('type').optional().isIn(['video', 'audio', 'text', 'photo']),
  body('target_audience').optional().isIn(['adult', 'child', 'all']),
  body('is_published').optional().isBoolean(),
  body('duration_seconds').optional().isInt({ min: 0 })
];

const listContentsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('target_audience').optional().isIn(['adult', 'child', 'all']),
  query('type').optional().isIn(['video', 'audio', 'text', 'photo']),
  query('is_published').optional().isBoolean()
];

module.exports = {
  createContentValidator,
  updateContentValidator,
  listContentsValidator
};
