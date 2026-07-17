// src/modules/finance/finance.routes.js
// Routes du module Gestion Financière (Outils Shalom).
// Toutes protégées par JWT et cloisonnées à l'utilisateur connecté.

const { Router } = require('express');
const controller = require('./finance.controller');
const { authenticate } = require('../auth/auth.middleware');
const {
  createCategoryValidator,
  updateCategoryValidator,
  createTransactionValidator,
  updateTransactionValidator,
  listTransactionsValidator,
  createGoalValidator,
  updateGoalValidator,
  idParamValidator,
  summaryValidator,
} = require('./finance.validator');

const router = Router();

// Toutes les routes finance nécessitent une authentification.
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Finance
 *   description: Gestion Financière — catégories, transactions, objectifs, analyse
 */

// --- Analyse (avant les routes à paramètre pour rester lisible) ---
/**
 * @swagger
 * /api/v1/finance/overview:
 *   get:
 *     summary: Aperçu global (totaux, solde, objectifs actifs)
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Aperçu global }
 */
router.get('/overview', controller.getOverview);

/**
 * @swagger
 * /api/v1/finance/summary:
 *   get:
 *     summary: Résumé mensuel (revenus, dépenses, taux d'épargne, répartition)
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: year_month
 *         schema: { type: string, example: '2026-07' }
 *     responses:
 *       200: { description: Résumé du mois (mois courant par défaut) }
 */
router.get('/summary', summaryValidator, controller.getSummary);

// --- Catégories ---
/**
 * @swagger
 * /api/v1/finance/categories:
 *   get:
 *     summary: Lister ses catégories (filtre optionnel ?type=income|expense)
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste des catégories } }
 *   post:
 *     summary: Créer une catégorie
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Catégorie créée }, 400: { description: Validation } }
 */
router.get('/categories', controller.listCategories);
router.post('/categories', createCategoryValidator, controller.createCategory);
router.patch('/categories/:id', updateCategoryValidator, controller.updateCategory);
router.delete('/categories/:id', idParamValidator, controller.deleteCategory);

// --- Transactions ---
/**
 * @swagger
 * /api/v1/finance/transactions:
 *   get:
 *     summary: Lister ses transactions (filtres ?type= ?category_id= ?from= ?to=, paginé)
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste paginée } }
 *   post:
 *     summary: Enregistrer une transaction (revenu ou dépense)
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Transaction créée }, 400: { description: Validation } }
 */
router.get('/transactions', listTransactionsValidator, controller.listTransactions);
router.post('/transactions', createTransactionValidator, controller.createTransaction);
router.get('/transactions/:id', idParamValidator, controller.getTransaction);
router.patch('/transactions/:id', updateTransactionValidator, controller.updateTransaction);
router.delete('/transactions/:id', idParamValidator, controller.deleteTransaction);

// --- Objectifs d'épargne ---
/**
 * @swagger
 * /api/v1/finance/goals:
 *   get:
 *     summary: Lister ses objectifs (filtre optionnel ?status=)
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste des objectifs } }
 *   post:
 *     summary: Créer un objectif d'épargne
 *     tags: [Finance]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Objectif créé }, 400: { description: Validation } }
 */
router.get('/goals', controller.listGoals);
router.post('/goals', createGoalValidator, controller.createGoal);
router.get('/goals/:id', idParamValidator, controller.getGoal);
router.patch('/goals/:id', updateGoalValidator, controller.updateGoal);
router.delete('/goals/:id', idParamValidator, controller.deleteGoal);

module.exports = router;
