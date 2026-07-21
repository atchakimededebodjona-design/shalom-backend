// src/modules/ads/ads.routes.js
// Routes de l'espace publicitaire. Lecture des annonces actives ouverte à tout
// utilisateur connecté ; création / modification / suppression RÉSERVÉES aux
// administrateurs (requireAdmin).

const { Router } = require('express');
const controller = require('./ads.controller');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { createValidator, updateValidator, idParamValidator } = require('./ads.validator');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Publicités
 *   description: Espace publicitaire du tableau de bord (contenu géré par les admins)
 */

/**
 * @swagger
 * /api/v1/ads:
 *   get:
 *     summary: Lister les annonces actives (bandeau du dashboard)
 *     tags: [Publicités]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Annonces actives } }
 *   post:
 *     summary: Créer une annonce (admin uniquement)
 *     tags: [Publicités]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Créée }, 403: { description: Réservé aux admins } }
 */
router.get('/', controller.listActive);
router.post('/', requireAdmin, createValidator, controller.create);

/**
 * @swagger
 * /api/v1/ads/manage:
 *   get:
 *     summary: Lister TOUTES les annonces, actives ou non (admin uniquement)
 *     tags: [Publicités]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Toutes les annonces }, 403: { description: Réservé aux admins } }
 */
router.get('/manage', requireAdmin, controller.listAll);

/**
 * @swagger
 * /api/v1/ads/{id}:
 *   patch:
 *     summary: Modifier une annonce (admin uniquement)
 *     tags: [Publicités]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Mise à jour }, 404: { description: Introuvable } }
 *   delete:
 *     summary: Supprimer une annonce (admin uniquement)
 *     tags: [Publicités]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Supprimée }, 404: { description: Introuvable } }
 */
router.patch('/:id', requireAdmin, updateValidator, controller.update);
router.delete('/:id', requireAdmin, idParamValidator, controller.remove);

module.exports = router;
