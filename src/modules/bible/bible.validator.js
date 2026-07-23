const { param, query } = require('express-validator');

const versionQueryValidator = query('version')
  .optional()
  .trim()
  .isLength({ min: 2, max: 10 })
  .withMessage('Code de version invalide');

const getChapterValidator = [
  param('bookId').isUUID().withMessage('Identifiant de livre invalide'),
  param('chapterNumber').isInt({ min: 1 }).withMessage('Numéro de chapitre invalide'),
  versionQueryValidator,
];

const searchValidator = [
  query('q').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Recherche trop courte'),
  versionQueryValidator,
];

module.exports = { getChapterValidator, searchValidator };
