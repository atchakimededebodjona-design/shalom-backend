const express = require('express');
const router = express.Router();

const { createReport, getReports, updateReport } = require('./reports.controller');
const { createReportValidator, listReportsValidator, updateReportValidator } = require('./reports.validator');

const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');

// Routes protégées par authentification de base
/**
 * @swagger
 * /api/v1/reports:
 *   post:
 *     summary: Créer un signalement
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [target_type, target_id, reason]
 *             properties:
 *               target_type:
 *                 type: string
 *                 enum: [post, comment]
 *               target_id:
 *                 type: string
 *               reason:
 *                 type: string
 *               details:
 *                 type: string
 *     responses:
 *       201:
 *         description: Signalement créé
 *       409:
 *         description: Doublon
 */
router.post('/', authenticate, createReportValidator, createReport);

// Routes protégées par authentification ET droits admin
/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     summary: Lister les signalements (Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des signalements
 *       403:
 *         description: Accès refusé
 */
router.get('/', authenticate, requireAdmin, listReportsValidator, getReports);

/**
 * @swagger
 * /api/v1/reports/{id}:
 *   patch:
 *     summary: Traiter un signalement (Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *                 enum: [traite, rejete]
 *               apply_action:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Signalement mis à jour
 *       403:
 *         description: Accès refusé
 */
router.patch('/:id', authenticate, requireAdmin, updateReportValidator, updateReport);

module.exports = router;
