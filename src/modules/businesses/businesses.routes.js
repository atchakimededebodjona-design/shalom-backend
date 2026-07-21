// src/modules/businesses/businesses.routes.js
// Routes du profil entreprise (module Reçu+). Protégées par JWT, une entreprise
// par membre. Montées sous /api/v1/billing/businesses.

const { Router } = require('express');
const controller = require('./businesses.controller');
const { authenticate } = require('../auth/auth.middleware');
const { createValidator, updateValidator } = require('./businesses.validator');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Entreprise (Reçu+)
 *   description: Profil de l'entreprise émettrice (en-tête + logo des factures)
 */

/**
 * @swagger
 * /api/v1/billing/businesses/me:
 *   get:
 *     summary: Récupérer l'entreprise du membre connecté
 *     tags: [Entreprise (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Entreprise du membre }
 *       404: { description: Aucune entreprise (code BUSINESS_NOT_FOUND) }
 *   patch:
 *     summary: Mettre à jour l'entreprise du membre connecté
 *     tags: [Entreprise (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Entreprise mise à jour }
 *       404: { description: Aucune entreprise (code BUSINESS_NOT_FOUND) }
 */
router.get('/me', controller.getMine);
router.patch('/me', updateValidator, controller.updateMine);

/**
 * @swagger
 * /api/v1/billing/businesses:
 *   post:
 *     summary: Déclarer son entreprise (une seule par membre)
 *     tags: [Entreprise (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Entreprise créée }
 *       400: { description: Validation }
 *       409: { description: Une entreprise existe déjà (code BUSINESS_EXISTS) }
 */
router.post('/', createValidator, controller.create);

module.exports = router;
