// src/modules/tools/tools.routes.js
// Routes du module Outils pratiques du quotidien. Toutes protégées par JWT ;
// les données sont cloisonnées à l'utilisateur (le référentiel d'unités est commun).

const { Router } = require('express');
const controller = require('./tools.controller');
const { authenticate } = require('../auth/auth.middleware');
const {
  createTitheValidator,
  updateTitheValidator,
  listTitheValidator,
  createEventValidator,
  updateEventValidator,
  listEventsValidator,
  createListValidator,
  updateListValidator,
  reorderValidator,
  createTaskValidator,
  updateTaskValidator,
  listTasksValidator,
  convertValidator,
  idParamValidator,
} = require('./tools.validator');

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Tools
 *   description: Outils pratiques — dîme, événements, tâches, convertisseur
 */

// --- Dîme / offrandes ---
/**
 * @swagger
 * /api/v1/tools/tithe:
 *   get:
 *     summary: Historique de ses calculs de dîme (filtres ?is_paid= ?from= ?to=, paginé)
 *     tags: [Tools]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Historique paginé } }
 *   post:
 *     summary: Calculer et enregistrer une dîme (montant calculé côté serveur)
 *     tags: [Tools]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Calcul enregistré }, 400: { description: Validation } }
 */
router.get('/tithe', listTitheValidator, controller.listTithes);
router.post('/tithe', createTitheValidator, controller.createTithe);
router.get('/tithe/:id', idParamValidator, controller.getTithe);
router.patch('/tithe/:id', updateTitheValidator, controller.updateTithe);
router.delete('/tithe/:id', idParamValidator, controller.deleteTithe);

// --- Événements personnels ---
/**
 * @swagger
 * /api/v1/tools/personal-events:
 *   get:
 *     summary: Lister ses événements (filtres ?status= ?event_type= ?from= ?to=, paginé)
 *     tags: [Tools]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Planifier un événement (jeûne, retraite, prière, autre)
 *     tags: [Tools]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Événement planifié } }
 */
router.get('/personal-events', listEventsValidator, controller.listEvents);
router.post('/personal-events', createEventValidator, controller.createEvent);
router.get('/personal-events/:id', idParamValidator, controller.getEvent);
router.patch('/personal-events/:id', updateEventValidator, controller.updateEvent);
router.delete('/personal-events/:id', idParamValidator, controller.deleteEvent);

// --- Listes de tâches ---
/**
 * @swagger
 * /api/v1/tools/task-lists/{id}/reorder:
 *   patch:
 *     summary: Réordonner les tâches d'une liste (positions 1..n selon ordered_ids)
 *     tags: [Tools]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Tâches réordonnées }, 404: { description: Liste ou tâches invalides } }
 */
router.get('/task-lists', controller.listLists);
router.post('/task-lists', createListValidator, controller.createList);
router.get('/task-lists/:id', idParamValidator, controller.getList);
router.patch('/task-lists/:id', updateListValidator, controller.updateList);
router.delete('/task-lists/:id', idParamValidator, controller.deleteList);
router.patch('/task-lists/:id/reorder', reorderValidator, controller.reorderTasks);

// --- Tâches ---
router.get('/tasks', listTasksValidator, controller.listTasks);
router.post('/tasks', createTaskValidator, controller.createTask);
router.get('/tasks/:id', idParamValidator, controller.getTask);
router.patch('/tasks/:id', updateTaskValidator, controller.updateTask);
router.delete('/tasks/:id', idParamValidator, controller.deleteTask);

// --- Convertisseur (littérales avant tout paramètre) ---
/**
 * @swagger
 * /api/v1/tools/units/convert:
 *   post:
 *     summary: Convertir une valeur entre deux unités d'une même catégorie
 *     tags: [Tools]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Résultat }, 400: { description: Catégories différentes } }
 */
router.get('/units', controller.listUnits);
router.get('/units/history', controller.listConversionHistory);
router.post('/units/convert', convertValidator, controller.convert);

module.exports = router;
