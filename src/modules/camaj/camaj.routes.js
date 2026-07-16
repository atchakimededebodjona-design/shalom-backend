// src/modules/camaj/camaj.routes.js
// Routes du module camaj — demandes issues des formulaires publics du CAMAJ.

const express = require('express');
const router = express.Router();

const { creerSubmission, listerSubmissions, changerStatut, statsSubmissions } = require('./camaj.controller');
const { createSubmissionValidator, updateStatusValidator } = require('./camaj.validator');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { camajLimiter } = require('../../middlewares/rate-limit.middleware');

/**
 * @swagger
 * /api/v1/camaj/submissions:
 *   post:
 *     summary: Soumettre une demande depuis un formulaire CAMAJ (public)
 *     tags: [Camaj]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, data]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [mentor, programme, mentorat, faj, don, relation_aide]
 *               data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Demande enregistrée
 *       400:
 *         description: Données invalides
 */
router.post('/submissions', camajLimiter, createSubmissionValidator, creerSubmission);

/**
 * @swagger
 * /api/v1/camaj/submissions:
 *   get:
 *     summary: Lister les demandes CAMAJ (Admin)
 *     tags: [Camaj]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des demandes
 *       403:
 *         description: Accès refusé
 */
router.get('/submissions', authenticate, requireAdmin, listerSubmissions);

/**
 * @swagger
 * /api/v1/camaj/submissions/stats:
 *   get:
 *     summary: Statistiques des demandes CAMAJ (Admin)
 *     tags: [Camaj]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compteurs par statut et par type
 */
router.get('/submissions/stats', authenticate, requireAdmin, statsSubmissions);

/**
 * @swagger
 * /api/v1/camaj/submissions/{id}:
 *   patch:
 *     summary: Changer le statut d'une demande CAMAJ (Admin)
 *     tags: [Camaj]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [nouveau, traite, archive]
 *     responses:
 *       200:
 *         description: Statut mis à jour
 *       404:
 *         description: Demande introuvable
 */
router.patch('/submissions/:id', authenticate, requireAdmin, updateStatusValidator, changerStatut);

module.exports = router;
