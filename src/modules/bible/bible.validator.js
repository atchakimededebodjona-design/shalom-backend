const { param, query } = require('express-validator');

const getChapterValidator = [
  param('bookId').isUUID().withMessage('Identifiant de livre invalide'),
  param('chapterNumber').isInt({ min: 1 }).withMessage('Numéro de chapitre invalide'),
];

const searchValidator = [
  query('q').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Recherche trop courte'),
];

module.exports = { getChapterValidator, searchValidator };
