// src/modules/spiritual/spiritual.validator.js
// Validation des entrées du module Outils Spirituels.

const { body, param, query } = require('express-validator');

const DURATION_TYPES = ['daily', 'annual', 'custom'];
const PROGRESS_STATUSES = ['active', 'completed', 'abandoned'];
const PRAYER_STATUSES = ['pending', 'answered', 'ongoing'];
const REMINDERS = ['daily', 'weekly', 'none'];
const VERSE_TYPES = ['verse', 'quote'];
const ENTRY_TYPES = ['note', 'gratitude'];

// --- Plans de lecture ---
const createPlanValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 })
    .withMessage('La description ne peut pas dépasser 2000 caractères'),
  body('duration_type').optional().isIn(DURATION_TYPES).withMessage(`La durée doit être : ${DURATION_TYPES.join(', ')}`),
  body('total_days').isInt({ min: 1, max: 1000 }).withMessage('Le nombre de jours doit être entre 1 et 1000'),
  body('is_public').optional().isBoolean().withMessage('is_public doit être un booléen'),
];

const addPlanDayValidator = [
  param('id').isUUID().withMessage('Identifiant de plan invalide'),
  body('day_number').isInt({ min: 1 }).withMessage('Le numéro de jour doit être un entier positif'),
  body('passages').trim().notEmpty().withMessage('Les passages sont requis').isLength({ max: 500 })
    .withMessage('Les passages ne peuvent pas dépasser 500 caractères'),
];

const completeDayValidator = [
  param('id').isUUID().withMessage('Identifiant de plan invalide'),
  body('day_number').isInt({ min: 1 }).withMessage('Le numéro de jour doit être un entier positif'),
];

const updateProgressValidator = [
  param('id').isUUID().withMessage('Identifiant de plan invalide'),
  body('status').isIn(PROGRESS_STATUSES).withMessage(`Le statut doit être : ${PROGRESS_STATUSES.join(', ')}`),
];

// --- Carnet de prière ---
const createPrayerValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 })
    .withMessage('La description ne peut pas dépasser 2000 caractères'),
  body('category').optional({ nullable: true }).trim().isLength({ max: 50 })
    .withMessage('La catégorie ne peut pas dépasser 50 caractères'),
  body('reminder_frequency').optional({ nullable: true }).isIn(REMINDERS)
    .withMessage(`Le rappel doit être : ${REMINDERS.join(', ')}`),
];

const updatePrayerValidator = [
  param('id').isUUID().withMessage('Identifiant de prière invalide'),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 150 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('category').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('status').optional().isIn(PRAYER_STATUSES).withMessage(`Le statut doit être : ${PRAYER_STATUSES.join(', ')}`),
  body('answered_note').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('reminder_frequency').optional({ nullable: true }).isIn(REMINDERS),
];

const listPrayersValidator = [
  query('status').optional().isIn(PRAYER_STATUSES).withMessage('Statut de filtre invalide'),
];

// --- Versets ---
const createVerseValidator = [
  body('content').trim().notEmpty().withMessage('Le contenu est requis').isLength({ max: 2000 })
    .withMessage('Le contenu ne peut pas dépasser 2000 caractères'),
  body('reference').optional({ nullable: true }).trim().isLength({ max: 100 })
    .withMessage('La référence ne peut pas dépasser 100 caractères'),
  body('type').optional().isIn(VERSE_TYPES).withMessage(`Le type doit être : ${VERSE_TYPES.join(', ')}`),
  body('display_date').optional({ nullable: true }).isISO8601().withMessage('La date doit être au format YYYY-MM-DD'),
];

const favoriteVerseValidator = [
  param('id').isUUID().withMessage('Identifiant de verset invalide'),
  body('is_favorite').isBoolean().withMessage('is_favorite doit être un booléen'),
];

// --- Journal spirituel ---
const createEntryValidator = [
  body('content').trim().notEmpty().withMessage('Le contenu est requis').isLength({ max: 5000 })
    .withMessage('Le contenu ne peut pas dépasser 5000 caractères'),
  body('entry_type').optional().isIn(ENTRY_TYPES).withMessage(`Le type doit être : ${ENTRY_TYPES.join(', ')}`),
  body('mood').optional({ nullable: true }).trim().isLength({ max: 30 })
    .withMessage("L'humeur ne peut pas dépasser 30 caractères"),
  body('entry_date').optional().isISO8601().withMessage('La date doit être au format YYYY-MM-DD'),
];

const updateEntryValidator = [
  param('id').isUUID().withMessage("Identifiant d'entrée invalide"),
  body('content').optional().trim().notEmpty().withMessage('Le contenu ne peut pas être vide').isLength({ max: 5000 }),
  body('entry_type').optional().isIn(ENTRY_TYPES),
  body('mood').optional({ nullable: true }).trim().isLength({ max: 30 }),
  body('entry_date').optional().isISO8601(),
];

const listEntriesValidator = [
  query('entry_type').optional().isIn(ENTRY_TYPES).withMessage('Type de filtre invalide'),
  query('from').optional().isISO8601().withMessage('La date "from" doit être au format YYYY-MM-DD'),
  query('to').optional().isISO8601().withMessage('La date "to" doit être au format YYYY-MM-DD'),
];

// --- Louange ---
const createSongValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 200 })
    .withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('artist_or_author').optional({ nullable: true }).trim().isLength({ max: 150 }),
  body('lyrics').optional({ nullable: true }).trim().isLength({ max: 20000 })
    .withMessage('Les paroles ne peuvent pas dépasser 20000 caractères'),
  body('language').optional({ nullable: true }).trim().isLength({ max: 10 }),
  body('category').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('is_public').optional().isBoolean(),
];

const createPlaylistValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('is_public').optional().isBoolean(),
];

const updatePlaylistValidator = [
  param('id').isUUID().withMessage('Identifiant de playlist invalide'),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 150 }),
  body('is_public').optional().isBoolean(),
];

const addPlaylistSongValidator = [
  param('id').isUUID().withMessage('Identifiant de playlist invalide'),
  body('song_id').isUUID().withMessage('Identifiant de chant invalide'),
  body('position').optional().isInt({ min: 1 }).withMessage('La position doit être un entier positif'),
];

const playlistSongParamValidator = [
  param('id').isUUID().withMessage('Identifiant de playlist invalide'),
  param('songId').isUUID().withMessage('Identifiant de chant invalide'),
];

// --- Commun ---
const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

module.exports = {
  DURATION_TYPES,
  PROGRESS_STATUSES,
  PRAYER_STATUSES,
  REMINDERS,
  VERSE_TYPES,
  ENTRY_TYPES,
  createPlanValidator,
  addPlanDayValidator,
  completeDayValidator,
  updateProgressValidator,
  createPrayerValidator,
  updatePrayerValidator,
  listPrayersValidator,
  createVerseValidator,
  favoriteVerseValidator,
  createEntryValidator,
  updateEntryValidator,
  listEntriesValidator,
  createSongValidator,
  createPlaylistValidator,
  updatePlaylistValidator,
  addPlaylistSongValidator,
  playlistSongParamValidator,
  idParamValidator,
};
