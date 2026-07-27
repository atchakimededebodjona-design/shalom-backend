// src/modules/games/games.routes.js
// Routes du module Jeux (quiz bibliques, classements, XP).

'use strict';

const express = require('express');
const router = express.Router();

const gamesController = require('./games.controller');
const { authenticate } = require('../auth/auth.middleware');
const {
  startSessionValidator,
  submitAnswerValidator,
  endSessionValidator,
  leaderboardValidator,
  createDuelValidator,
  duelIdParamValidator,
  listDuelsValidator,
} = require('./games.validator');

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Games
 *   description: Jeux bibliques — catalogue, sessions de quiz, classements, XP
 */

/**
 * @swagger
 * /api/v1/games:
 *   get:
 *     summary: Lister le catalogue des jeux actifs
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste des jeux actifs }
 *       401: { description: Non authentifié }
 */
router.get('/', gamesController.listGames);

/**
 * @swagger
 * /api/v1/games/sessions:
 *   post:
 *     summary: Démarrer une session de jeu (sélectionne un lot de questions)
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gameId]
 *             properties:
 *               gameId: { type: string, format: uuid }
 *               difficulty: { type: integer, minimum: 1, maximum: 3, default: 1 }
 *               categoryId: { type: string, format: uuid }
 *               questionCount: { type: integer, default: 10 }
 *               mode: { type: string, enum: [solo, duel, tournament], default: solo }
 *     responses:
 *       201: { description: Session créée (questions sans les bonnes réponses) }
 *       400: { description: Validation }
 *       404: { description: Jeu introuvable ou inactif }
 *       422: { description: Aucune question disponible pour ces critères }
 */
router.post('/sessions', startSessionValidator, gamesController.startSession);

/**
 * @swagger
 * /api/v1/games/sessions/{sessionId}/answers:
 *   post:
 *     summary: Soumettre une réponse à une question de la session
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionId]
 *             properties:
 *               questionId: { type: string, format: uuid }
 *               choiceId: { type: string, format: uuid }
 *               timeTakenMs: { type: integer, example: 3200 }
 *     responses:
 *       200: { description: Résultat de la réponse (isCorrect, pointsEarned) }
 *       400: { description: Validation }
 *       404: { description: Session ou question introuvable }
 *       409: { description: Session déjà terminée }
 */
router.post('/sessions/:sessionId/answers', submitAnswerValidator, gamesController.submitAnswer);

/**
 * @swagger
 * /api/v1/games/sessions/{sessionId}/end:
 *   post:
 *     summary: Clôturer une session (fige le score, crédite l'XP, met à jour les stats)
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Session clôturée (score, xpGained, totalXp, level) }
 *       404: { description: Session introuvable }
 */
router.post('/sessions/:sessionId/end', endSessionValidator, gamesController.endSession);

/**
 * @swagger
 * /api/v1/games/leaderboard:
 *   get:
 *     summary: Classement (par jeu si ?gameId= fourni, sinon global)
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: gameId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: Classement paginé }
 */
router.get('/leaderboard', leaderboardValidator, gamesController.getLeaderboard);

/**
 * @swagger
 * /api/v1/games/duels:
 *   post:
 *     summary: Créer un duel ("Bataille Biblique") — démarre aussitôt la session du créateur
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gameId]
 *             properties:
 *               gameId: { type: string, format: uuid }
 *               difficulty: { type: integer, minimum: 1, maximum: 3, default: 1 }
 *               categoryId: { type: string, format: uuid }
 *               questionCount: { type: integer, default: 10 }
 *     responses:
 *       201: { description: Duel créé, en attente d'un adversaire (duelId, status, session) }
 *       404: { description: Jeu introuvable ou inactif }
 *       422: { description: Aucune question disponible pour ces critères }
 *   get:
 *     summary: Lister mes duels, ou les duels ouverts avec ?open=true
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: open
 *         schema: { type: boolean }
 *         description: true = duels en attente d'un adversaire (hors les miens) ; sinon mes duels
 *       - in: query
 *         name: gameId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Liste de duels }
 */
router.post('/duels', createDuelValidator, gamesController.createDuel);
router.get('/duels', listDuelsValidator, gamesController.listDuels);

/**
 * @swagger
 * /api/v1/games/duels/{id}:
 *   get:
 *     summary: Détail d'un duel (réservé aux deux joueurs) — finalise le vainqueur si les 2 sessions sont terminées
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Détail du duel }
 *       403: { description: Accès refusé (vous n'êtes pas l'un des deux joueurs) }
 *       404: { description: Duel introuvable }
 */
router.get('/duels/:id', duelIdParamValidator, gamesController.getDuel);

/**
 * @swagger
 * /api/v1/games/duels/{id}/join:
 *   post:
 *     summary: Rejoindre un duel en attente — démarre la session de l'adversaire avec les mêmes questions
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Duel rejoint (status=active, session) }
 *       404: { description: Duel introuvable }
 *       409: { description: Duel déjà complet, déjà démarré, ou c'est votre propre duel }
 */
router.post('/duels/:id/join', duelIdParamValidator, gamesController.joinDuel);

/**
 * @swagger
 * /api/v1/games/daily:
 *   get:
 *     summary: Défi du jour (généré à la demande) et ma progression
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Défi du jour (challengeId, jeu, rewardXp, completed) }
 */
router.get('/daily', gamesController.getDailyChallenge);

/**
 * @swagger
 * /api/v1/games/daily/start:
 *   post:
 *     summary: Démarrer la session du défi du jour
 *     tags: [Games]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Session créée pour le défi du jour }
 *       404: { description: Le défi du jour n'a pas encore été généré (appeler GET /games/daily d'abord) }
 *       409: { description: Défi du jour déjà complété }
 */
router.post('/daily/start', gamesController.startDailyChallenge);

module.exports = router;
