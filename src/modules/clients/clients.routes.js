// src/modules/clients/clients.routes.js
// Routes des clients à facturer (module Reçu+). Protégées par JWT, cloisonnées.

const { Router } = require('express');
const controller = require('./clients.controller');
const { authenticate } = require('../auth/auth.middleware');
const {
  createValidator,
  updateValidator,
  listValidator,
  idParamValidator,
} = require('./clients.validator');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Clients (Reçu+)
 *   description: Répertoire des clients à facturer
 */

/**
 * @swagger
 * /api/v1/clients:
 *   get:
 *     summary: Lister ses clients (recherche ?search=, paginé)
 *     tags: [Clients (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Créer un client
 *     tags: [Clients (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Client créé }, 400: { description: Validation } }
 */
router.get('/', listValidator, controller.list);
router.post('/', createValidator, controller.create);
router.get('/:id', idParamValidator, controller.getOne);
router.patch('/:id', updateValidator, controller.update);
router.delete('/:id', idParamValidator, controller.remove);

module.exports = router;
