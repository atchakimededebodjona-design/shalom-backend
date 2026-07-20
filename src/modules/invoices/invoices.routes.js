// src/modules/invoices/invoices.routes.js
// Routes du module Facturation (Reçu+). Protégées par JWT, cloisonnées à l'utilisateur.
// Chaque paiement crédite le portefeuille SHALOM (source 'invoice').

const { Router } = require('express');
const controller = require('./invoices.controller');
const { authenticate } = require('../auth/auth.middleware');
const {
  createValidator,
  updateValidator,
  listValidator,
  paymentValidator,
  idParamValidator,
} = require('./invoices.validator');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Facturation (Reçu+)
 *   description: Factures, lignes, reçus (paiements) — crédite le portefeuille à chaque paiement
 */

/**
 * @swagger
 * /api/v1/invoices/overview:
 *   get:
 *     summary: Aperçu (compteurs par statut, montants facturés / encaissés / restant dû)
 *     tags: [Facturation (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Aperçu } }
 */
router.get('/overview', controller.overview);

/**
 * @swagger
 * /api/v1/invoices:
 *   get:
 *     summary: Lister ses factures (filtres ?status= ?client_id= ?from= ?to=, paginé)
 *     tags: [Facturation (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Créer une facture avec ses lignes (totaux calculés côté serveur)
 *     tags: [Facturation (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Facture créée }, 400: { description: Validation } }
 */
router.get('/', listValidator, controller.list);
router.post('/', createValidator, controller.create);

/**
 * @swagger
 * /api/v1/invoices/{id}:
 *   get:
 *     summary: Détail d'une facture (en-tête + lignes + paiements)
 *     tags: [Facturation (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Détail }, 404: { description: Introuvable } }
 */
router.get('/:id', idParamValidator, controller.getOne);
router.patch('/:id', updateValidator, controller.update);
router.delete('/:id', idParamValidator, controller.remove);

/**
 * @swagger
 * /api/v1/invoices/{id}/payments:
 *   get:
 *     summary: Lister les reçus/paiements d'une facture
 *     tags: [Facturation (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste des paiements } }
 *   post:
 *     summary: Enregistrer un paiement (met à jour le statut ET crédite le portefeuille)
 *     tags: [Facturation (Reçu+)]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Paiement enregistré }, 404: { description: Facture introuvable } }
 */
router.get('/:id/payments', idParamValidator, controller.listPayments);
router.post('/:id/payments', paymentValidator, controller.addPayment);

module.exports = router;
