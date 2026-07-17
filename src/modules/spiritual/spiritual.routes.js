// src/modules/spiritual/spiritual.routes.js
// Routes du module Outils Spirituels. Toutes protégées par JWT ; les données
// utilisateur (prières, journal, progression, playlists) sont cloisonnées.

const { Router } = require('express');
const controller = require('./spiritual.controller');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const {
  createPlanValidator,
  addPlanDayValidator,
  completeDayValidator,
  updateProgressValidator,
  createPrayerValidator,
  updatePrayerValidator,
  listPrayersValidator,
  createVerseValidator,
  favoriteVerseValidator,
  createEntryValidator,
  updateEntryValidator,
  listEntriesValidator,
  createSongValidator,
  createPlaylistValidator,
  updatePlaylistValidator,
  addPlaylistSongValidator,
  playlistSongParamValidator,
  idParamValidator,
} = require('./spiritual.validator');

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Spiritual
 *   description: Outils Spirituels — lecture biblique, prière, versets, journal, louange
 */

// --- Plans de lecture biblique ---
/**
 * @swagger
 * /api/v1/spiritual/plans:
 *   get:
 *     summary: Catalogue des plans (publics + les siens), avec sa progression
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste des plans } }
 *   post:
 *     summary: Créer un plan de lecture
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Plan créé }, 400: { description: Validation } }
 */
router.get('/plans', controller.listPlans);
router.post('/plans', createPlanValidator, controller.createPlan);
router.get('/progress', controller.listProgress);
router.get('/plans/:id', idParamValidator, controller.getPlan);
router.post('/plans/:id/days', addPlanDayValidator, controller.addPlanDay);
router.post('/plans/:id/start', idParamValidator, controller.startPlan);

/**
 * @swagger
 * /api/v1/spiritual/plans/{id}/complete-day:
 *   post:
 *     summary: Valider un jour de lecture (met à jour progression et streak)
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Jour validé }, 404: { description: Plan non démarré } }
 */
router.post('/plans/:id/complete-day', completeDayValidator, controller.completeDay);
router.get('/plans/:id/logs', idParamValidator, controller.listLogs);
router.patch('/plans/:id/progress', updateProgressValidator, controller.updateProgress);

// --- Carnet de prière ---
/**
 * @swagger
 * /api/v1/spiritual/prayers:
 *   get:
 *     summary: Lister ses sujets de prière (filtres ?status= ?category=, paginé)
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Ajouter un sujet de prière
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Sujet ajouté } }
 */
router.get('/prayers', listPrayersValidator, controller.listPrayers);
router.post('/prayers', createPrayerValidator, controller.createPrayer);
router.get('/prayers/:id', idParamValidator, controller.getPrayer);
router.patch('/prayers/:id', updatePrayerValidator, controller.updatePrayer);
router.delete('/prayers/:id', idParamValidator, controller.deletePrayer);

// --- Versets / citations (routes littérales avant les paramétrées) ---
/**
 * @swagger
 * /api/v1/spiritual/verses/today:
 *   get:
 *     summary: Verset du jour (date dédiée, sinon rotation) — enregistre la consultation
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Verset du jour }, 404: { description: Aucun verset } }
 */
router.get('/verses/today', controller.getVerseOfTheDay);
router.get('/verses/favorites', controller.listFavoriteVerses);
router.post('/verses', requireAdmin, createVerseValidator, controller.createVerse);
router.patch('/verses/:id/favorite', favoriteVerseValidator, controller.setVerseFavorite);

// --- Journal spirituel ---
/**
 * @swagger
 * /api/v1/spiritual/journal:
 *   get:
 *     summary: Lister ses entrées de journal (filtres ?entry_type= ?from= ?to=, paginé)
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Ajouter une entrée (note ou gratitude)
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Entrée ajoutée } }
 */
router.get('/journal', listEntriesValidator, controller.listEntries);
router.post('/journal', createEntryValidator, controller.createEntry);
router.get('/journal/:id', idParamValidator, controller.getEntry);
router.patch('/journal/:id', updateEntryValidator, controller.updateEntry);
router.delete('/journal/:id', idParamValidator, controller.deleteEntry);

// --- Louange : chants ---
router.get('/songs', controller.listSongs);
router.post('/songs', createSongValidator, controller.createSong);
router.get('/songs/:id', idParamValidator, controller.getSong);

// --- Louange : playlists ---
/**
 * @swagger
 * /api/v1/spiritual/playlists/{id}/songs:
 *   post:
 *     summary: Ajouter un chant à une playlist (position auto si non fournie)
 *     tags: [Spiritual]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Chant ajouté } }
 */
router.get('/playlists', controller.listPlaylists);
router.post('/playlists', createPlaylistValidator, controller.createPlaylist);
router.get('/playlists/:id', idParamValidator, controller.getPlaylist);
router.patch('/playlists/:id', updatePlaylistValidator, controller.updatePlaylist);
router.delete('/playlists/:id', idParamValidator, controller.deletePlaylist);
router.post('/playlists/:id/songs', addPlaylistSongValidator, controller.addSongToPlaylist);
router.delete('/playlists/:id/songs/:songId', playlistSongParamValidator, controller.removeSongFromPlaylist);

module.exports = router;
