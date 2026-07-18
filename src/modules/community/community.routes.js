// src/modules/community/community.routes.js
// Routes du module Outils communautaires. Toutes protégées par JWT.
// L'annuaire des groupes vit dans le module groups (GET /api/v1/groups/directory)
// pour ne pas dupliquer sa logique.

const { Router } = require('express');
const controller = require('./community.controller');
const { authenticate } = require('../auth/auth.middleware');
const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');
const {
  createEventValidator,
  updateEventValidator,
  listEventsValidator,
  createPrayerValidator,
  updatePrayerValidator,
  listPrayersValidator,
  createAnnouncementValidator,
  updateAnnouncementValidator,
  listAnnouncementsValidator,
  idParamValidator,
} = require('./community.validator');

const router = Router();

router.use(authenticate);
router.use(requireActiveSubscription);

/**
 * @swagger
 * tags:
 *   name: Community
 *   description: Outils communautaires — événements, prières partagées, annonces
 */

// --- Événements ---
/**
 * @swagger
 * /api/v1/community/events:
 *   get:
 *     summary: Événements visibles (globaux + ceux de ses groupes), paginé
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Créer un événement (global ou de groupe — notifie alors les membres)
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Événement créé }, 403: { description: Non membre du groupe } }
 */
router.get('/events', listEventsValidator, controller.listEvents);
router.post('/events', createEventValidator, controller.createEvent);
router.get('/events/:id', idParamValidator, controller.getEvent);
router.patch('/events/:id', updateEventValidator, controller.updateEvent);
router.delete('/events/:id', idParamValidator, controller.deleteEvent);

/**
 * @swagger
 * /api/v1/community/events/{id}/register:
 *   post:
 *     summary: S'inscrire à un événement (refus si complet)
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Inscription enregistrée }
 *       409: { description: Événement complet ou annulé }
 */
router.post('/events/:id/register', idParamValidator, controller.register);
router.delete('/events/:id/register', idParamValidator, controller.unregister);
router.get('/events/:id/registrations', idParamValidator, controller.listRegistrations);

// --- Demandes de prière partagées ---
/**
 * @swagger
 * /api/v1/community/prayers:
 *   get:
 *     summary: Demandes visibles (publiques + celles de ses groupes)
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Partager une demande de prière (publique ou de groupe, anonyme possible)
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Demande partagée } }
 */
router.get('/prayers', listPrayersValidator, controller.listPrayers);
router.post('/prayers', createPrayerValidator, controller.createPrayer);
router.get('/prayers/:id', idParamValidator, controller.getPrayer);
router.patch('/prayers/:id', updatePrayerValidator, controller.updatePrayer);
router.delete('/prayers/:id', idParamValidator, controller.deletePrayer);

/**
 * @swagger
 * /api/v1/community/prayers/{id}/support:
 *   post:
 *     summary: « Je prie pour toi » (idempotent, notifie l'auteur)
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Soutien enregistré } }
 */
router.post('/prayers/:id/support', idParamValidator, controller.support);
router.delete('/prayers/:id/support', idParamValidator, controller.unsupport);

// --- Annonces ---
/**
 * @swagger
 * /api/v1/community/announcements:
 *   get:
 *     summary: Annonces visibles, épinglées d'abord puis par priorité décroissante
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Publier une annonce (globale = admin ; de groupe = admin/modérateur du groupe)
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Annonce publiée }, 403: { description: Droits insuffisants } }
 */
router.get('/announcements', listAnnouncementsValidator, controller.listAnnouncements);
router.post('/announcements', createAnnouncementValidator, controller.createAnnouncement);
router.patch('/announcements/:id', updateAnnouncementValidator, controller.updateAnnouncement);
router.delete('/announcements/:id', idParamValidator, controller.deleteAnnouncement);

module.exports = router;
