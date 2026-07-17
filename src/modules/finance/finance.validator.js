// src/modules/finance/finance.validator.js
// Validation des entrées pour le module Gestion Financière.

const { body, param, query } = require('express-validator');

const TX_TYPES = ['income', 'expense'];
const RECURRENCES = ['daily', 'weekly', 'monthly', 'yearly'];
const GOAL_STATUSES = ['active', 'achieved', 'abandoned'];

// --- Catégories ---
const createCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Le nom est requis').isLength({ max: 100 })
    .withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('type').isIn(TX_TYPES).withMessage("Le type doit être 'income' ou 'expense'"),
  body('icon').optional().trim().isLength({ max: 50 }).withMessage("L'icône ne peut pas dépasser 50 caractères"),
];

const updateCategoryValidator = [
  param('id').isUUID().withMessage('Identifiant de catégorie invalide'),
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide').isLength({ max: 100 })
    .withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('icon').optional().trim().isLength({ max: 50 }).withMessage("L'icône ne peut pas dépasser 50 caractères"),
];

// --- Transactions ---
const createTransactionValidator = [
  body('type').isIn(TX_TYPES).withMessage("Le type doit être 'income' ou 'expense'"),
  body('amount').isFloat({ gt: 0 }).withMessage('Le montant doit être un nombre strictement positif'),
  body('transaction_date').isISO8601().withMessage('La date doit être au format YYYY-MM-DD'),
  body('category_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de catégorie invalide'),
  body('note').optional({ nullable: true }).trim().isLength({ max: 1000 }).withMessage('La note ne peut pas dépasser 1000 caractères'),
  body('is_recurring').optional().isBoolean().withMessage('is_recurring doit être un booléen'),
  body('recurrence_frequency').optional({ nullable: true }).isIn(RECURRENCES)
    .withMessage(`La fréquence doit être : ${RECURRENCES.join(', ')}`),
];

const updateTransactionValidator = [
  param('id').isUUID().withMessage('Identifiant de transaction invalide'),
  body('type').optional().isIn(TX_TYPES).withMessage("Le type doit être 'income' ou 'expense'"),
  body('amount').optional().isFloat({ gt: 0 }).withMessage('Le montant doit être un nombre strictement positif'),
  body('transaction_date').optional().isISO8601().withMessage('La date doit être au format YYYY-MM-DD'),
  body('category_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de catégorie invalide'),
  body('note').optional({ nullable: true }).trim().isLength({ max: 1000 }).withMessage('La note ne peut pas dépasser 1000 caractères'),
  body('is_recurring').optional().isBoolean().withMessage('is_recurring doit être un booléen'),
  body('recurrence_frequency').optional({ nullable: true }).isIn(RECURRENCES)
    .withMessage(`La fréquence doit être : ${RECURRENCES.join(', ')}`),
];

const listTransactionsValidator = [
  query('type').optional().isIn(TX_TYPES).withMessage("Le type doit être 'income' ou 'expense'"),
  query('category_id').optional().isUUID().withMessage('Identifiant de catégorie invalide'),
  query('from').optional().isISO8601().withMessage('La date "from" doit être au format YYYY-MM-DD'),
  query('to').optional().isISO8601().withMessage('La date "to" doit être au format YYYY-MM-DD'),
];

// --- Objectifs ---
const createGoalValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('target_amount').isFloat({ gt: 0 }).withMessage('Le montant cible doit être strictement positif'),
  body('current_amount').optional().isFloat({ min: 0 }).withMessage('Le montant actuel ne peut pas être négatif'),
  body('target_date').optional({ nullable: true }).isISO8601().withMessage('La date cible doit être au format YYYY-MM-DD'),
];

const updateGoalValidator = [
  param('id').isUUID().withMessage("Identifiant d'objectif invalide"),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('target_amount').optional().isFloat({ gt: 0 }).withMessage('Le montant cible doit être strictement positif'),
  body('current_amount').optional().isFloat({ min: 0 }).withMessage('Le montant actuel ne peut pas être négatif'),
  body('target_date').optional({ nullable: true }).isISO8601().withMessage('La date cible doit être au format YYYY-MM-DD'),
  body('status').optional().isIn(GOAL_STATUSES).withMessage(`Le statut doit être : ${GOAL_STATUSES.join(', ')}`),
];

// --- Commun ---
const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

const summaryValidator = [
  query('year_month').optional().matches(/^\d{4}-\d{2}$/).withMessage('year_month doit être au format YYYY-MM'),
];

module.exports = {
  TX_TYPES,
  RECURRENCES,
  GOAL_STATUSES,
  createCategoryValidator,
  updateCategoryValidator,
  createTransactionValidator,
  updateTransactionValidator,
  listTransactionsValidator,
  createGoalValidator,
  updateGoalValidator,
  idParamValidator,
  summaryValidator,
};
