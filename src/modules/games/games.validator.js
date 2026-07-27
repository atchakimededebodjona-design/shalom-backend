// src/modules/games/games.validator.js
// Validation des entrées du module Jeux (express-validator).

const { body, param, query } = require('express-validator');

const MODES = ['solo', 'duel', 'tournament'];

// --- Démarrer une session ---
const startSessionValidator = [
  body('gameId').isUUID().withMessage('gameId doit être un UUID valide'),
  body('difficulty').optional().isInt({ min: 1, max: 3 })
    .withMessage('difficulty doit être un entier entre 1 et 3'),
  body('categoryId').optional({ nullable: true }).isUUID().withMessage('categoryId doit être un UUID valide'),
  body('questionCount').optional().isInt({ min: 1, max: 50 })
    .withMessage('questionCount doit être un entier entre 1 et 50'),
  body('mode').optional().isIn(MODES).withMessage(`mode doit être : ${MODES.join(', ')}`),
];

// --- Soumettre une réponse ---
const submitAnswerValidator = [
  param('sessionId').isUUID().withMessage('sessionId doit être un UUID valide'),
  body('questionId').isUUID().withMessage('questionId doit être un UUID valide'),
  body('choiceId').optional({ nullable: true }).isUUID().withMessage('choiceId doit être un UUID valide'),
  body('timeTakenMs').optional().isInt({ min: 0 }).withMessage('timeTakenMs doit être un entier positif'),
];

// --- Clôturer une session ---
const endSessionValidator = [
  param('sessionId').isUUID().withMessage('sessionId doit être un UUID valide'),
];

// --- Classement ---
const leaderboardValidator = [
  query('gameId').optional().isUUID().withMessage('gameId doit être un UUID valide'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit doit être un entier entre 1 et 100'),
];

// --- Duels ---
const createDuelValidator = [
  body('gameId').isUUID().withMessage('gameId doit être un UUID valide'),
  body('difficulty').optional().isInt({ min: 1, max: 3 })
    .withMessage('difficulty doit être un entier entre 1 et 3'),
  body('categoryId').optional({ nullable: true }).isUUID().withMessage('categoryId doit être un UUID valide'),
  body('questionCount').optional().isInt({ min: 2, max: 50 })
    .withMessage('questionCount doit être un entier entre 2 et 50'),
];

const duelIdParamValidator = [
  param('id').isUUID().withMessage('id doit être un UUID valide'),
];

const listDuelsValidator = [
  query('gameId').optional().isUUID().withMessage('gameId doit être un UUID valide'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit doit être un entier entre 1 et 100'),
];

module.exports = {
  MODES,
  startSessionValidator,
  submitAnswerValidator,
  endSessionValidator,
  leaderboardValidator,
  createDuelValidator,
  duelIdParamValidator,
  listDuelsValidator,
};
