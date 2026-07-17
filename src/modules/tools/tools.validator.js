// src/modules/tools/tools.validator.js
// Validation des entrées du module Outils pratiques du quotidien.

const { body, param, query } = require('express-validator');

const EVENT_TYPES = ['jeune', 'retraite', 'priere', 'autre'];
const EVENT_STATUSES = ['planned', 'completed', 'cancelled'];

// --- Dîme / offrandes ---
const createTitheValidator = [
  body('income_amount').isFloat({ gt: 0 }).withMessage('Le revenu doit être un nombre strictement positif'),
  body('tithe_percentage').optional().isFloat({ min: 0, max: 100 })
    .withMessage('Le pourcentage doit être compris entre 0 et 100'),
  body('offering_amount').optional().isFloat({ min: 0 })
    .withMessage("L'offrande ne peut pas être négative"),
  body('calculation_date').optional().isISO8601().withMessage('La date doit être au format YYYY-MM-DD'),
];

const updateTitheValidator = [
  param('id').isUUID().withMessage('Identifiant de calcul invalide'),
  body('is_paid').optional().isBoolean().withMessage('is_paid doit être un booléen'),
  body('offering_amount').optional().isFloat({ min: 0 })
    .withMessage("L'offrande ne peut pas être négative"),
];

const listTitheValidator = [
  query('is_paid').optional().isBoolean().withMessage('is_paid doit être un booléen'),
  query('from').optional().isISO8601().withMessage('La date "from" doit être au format YYYY-MM-DD'),
  query('to').optional().isISO8601().withMessage('La date "to" doit être au format YYYY-MM-DD'),
];

// --- Événements personnels ---
const createEventValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('event_type').optional({ nullable: true }).isIn(EVENT_TYPES)
    .withMessage(`Le type doit être : ${EVENT_TYPES.join(', ')}`),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('start_date').isISO8601().withMessage('La date de début est requise (format ISO)'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('La date de fin doit être au format ISO'),
  body('reminder_enabled').optional().isBoolean().withMessage('reminder_enabled doit être un booléen'),
  body('reminder_before_minutes').optional().isInt({ min: 0, max: 10080 })
    .withMessage('Le rappel doit être entre 0 et 10080 minutes (7 jours)'),
];

const updateEventValidator = [
  param('id').isUUID().withMessage("Identifiant d'événement invalide"),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 150 }),
  body('event_type').optional({ nullable: true }).isIn(EVENT_TYPES),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('start_date').optional().isISO8601(),
  body('end_date').optional({ nullable: true }).isISO8601(),
  body('reminder_enabled').optional().isBoolean(),
  body('reminder_before_minutes').optional().isInt({ min: 0, max: 10080 }),
  body('status').optional().isIn(EVENT_STATUSES).withMessage(`Le statut doit être : ${EVENT_STATUSES.join(', ')}`),
];

const listEventsValidator = [
  query('status').optional().isIn(EVENT_STATUSES).withMessage('Statut de filtre invalide'),
  query('event_type').optional().isIn(EVENT_TYPES).withMessage('Type de filtre invalide'),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];

// --- Listes de tâches ---
const createListValidator = [
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
];

const updateListValidator = [
  param('id').isUUID().withMessage('Identifiant de liste invalide'),
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 150 }),
];

const reorderValidator = [
  param('id').isUUID().withMessage('Identifiant de liste invalide'),
  body('ordered_ids').isArray({ min: 1 }).withMessage('ordered_ids doit être un tableau non vide'),
  body('ordered_ids.*').isUUID().withMessage('Chaque identifiant de tâche doit être un UUID'),
];

// --- Tâches ---
const createTaskValidator = [
  body('list_id').isUUID().withMessage('Identifiant de liste invalide'),
  body('content').trim().notEmpty().withMessage('Le contenu est requis').isLength({ max: 300 })
    .withMessage('Le contenu ne peut pas dépasser 300 caractères'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('La date doit être au format YYYY-MM-DD'),
  body('position').optional().isInt({ min: 0 }).withMessage('La position doit être un entier positif'),
];

const updateTaskValidator = [
  param('id').isUUID().withMessage('Identifiant de tâche invalide'),
  body('content').optional().trim().notEmpty().withMessage('Le contenu ne peut pas être vide').isLength({ max: 300 }),
  body('is_completed').optional().isBoolean().withMessage('is_completed doit être un booléen'),
  body('due_date').optional({ nullable: true }).isISO8601(),
  body('position').optional().isInt({ min: 0 }),
];

const listTasksValidator = [
  query('list_id').optional().isUUID().withMessage('Identifiant de liste invalide'),
  query('is_completed').optional().isBoolean().withMessage('is_completed doit être un booléen'),
  query('due_before').optional().isISO8601().withMessage('due_before doit être au format YYYY-MM-DD'),
];

// --- Convertisseur ---
const convertValidator = [
  body('from_unit_id').isUUID().withMessage("Identifiant d'unité source invalide"),
  body('to_unit_id').isUUID().withMessage("Identifiant d'unité cible invalide"),
  body('value').isFloat().withMessage('La valeur doit être un nombre'),
];

// --- Commun ---
const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

module.exports = {
  EVENT_TYPES,
  EVENT_STATUSES,
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
};
