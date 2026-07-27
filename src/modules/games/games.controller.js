'use strict';

const gamesService = require('./games.service');
const { hasValidationErrors } = require('../../utils/validate');

const listGames = async (req, res, next) => {
  try {
    const games = await gamesService.listGames();
    return res.status(200).json({ success: true, data: { games } });
  } catch (error) {
    next(error);
  }
};

const startSession = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { gameId, difficulty, categoryId, questionCount, mode } = req.body;

    const result = await gamesService.startSession({
      userId: req.user.id,
      gameId,
      difficulty,
      categoryId,
      questionCount,
      mode,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const submitAnswer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { sessionId } = req.params;
    const { questionId, choiceId, timeTakenMs } = req.body;

    const result = await gamesService.submitAnswer({
      userId: req.user.id,
      sessionId,
      questionId,
      choiceId,
      timeTakenMs,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const endSession = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { sessionId } = req.params;
    const result = await gamesService.endSession({ userId: req.user.id, sessionId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { gameId } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const result = await gamesService.getLeaderboard({ gameId: gameId || null, limit });
    return res.status(200).json({ success: true, data: { leaderboard: result } });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Duels 1v1 ("Bataille Biblique")
// ============================================================================

const createDuel = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { gameId, difficulty, categoryId, questionCount } = req.body;
    const result = await gamesService.createDuel({
      userId: req.user.id, gameId, difficulty, categoryId, questionCount,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const joinDuel = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await gamesService.joinDuel({ userId: req.user.id, duelId: req.params.id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getDuel = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await gamesService.getDuel({ userId: req.user.id, duelId: req.params.id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const listDuels = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { gameId } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const result = req.query.open === 'true'
      ? await gamesService.listOpenDuels({ userId: req.user.id, gameId: gameId || null, limit })
      : await gamesService.listMyDuels({ userId: req.user.id, limit });
    return res.status(200).json({ success: true, data: { duels: result } });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Défi quotidien
// ============================================================================

const getDailyChallenge = async (req, res, next) => {
  try {
    const result = await gamesService.getOrCreateTodayChallenge(req.user.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const startDailyChallenge = async (req, res, next) => {
  try {
    const result = await gamesService.startTodayChallenge(req.user.id);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listGames,
  startSession,
  submitAnswer,
  endSession,
  getLeaderboard,
  createDuel,
  joinDuel,
  getDuel,
  listDuels,
  getDailyChallenge,
  startDailyChallenge,
};
