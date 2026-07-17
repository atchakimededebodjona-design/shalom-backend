// src/modules/community/community.validator.js
// Validation des entrées du module Outils communautaires.

const { body, param, query } = require('express-validator');

const EVENT_TYPES = ['retraite', 'formation', 'conference', 'autre'];
const EVENT_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];
const PRAYER_VISIBILITIES = ['public', 'group'];
const PRAYER_STATUSES = ['active', 'answered', 'closed'];

// --- Événements ---
const createEventValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 200 })
    .withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('event_type').optional({ nullable: true }).isIn(EVENT_TYPES)
    .withMessage(`Le type doit être : ${EVENT_TYPES.join(', ')}`),
  body('start_date').isISO8601().withMessage('La date de début est requise (format ISO)'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('La date de fin doit être au format ISO'),
  body('location_info').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('cover_image_url').optional({ nullable: true }).trim().isURL({ require_tld: false })
    .withMessage("L'URL de l'image est invalide"),
  body('group_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de groupe invalide'),
  body('max_participants').optional({ nullable: true }).isInt({ min: 1 })
    .withMessage('La capacité doit être un entier positif'),
  body('registration_required').optional().isBoolean().withMessage('registration_required doit être un booléen'),
];

const updateEventValidator = [
  param('id').isUUID().withMessage("Identifiant d'événement invalide"),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 200 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('event_type').optional({ nullable: true }).isIn(EVENT_TYPES),
  body('start_date').optional().isISO8601(),
  body('end_date').optional({ nullable: true }).isISO8601(),
  body('location_info').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('cover_image_url').optional({ nullable: true }).trim().isURL({ require_tld: false }),
  body('max_participants').optional({ nullable: true }).isInt({ min: 1 }),
  body('registration_required').optional().isBoolean(),
  body('status').optional().isIn(EVENT_STATUSES).withMessage(`Le statut doit être : ${EVENT_STATUSES.join(', ')}`),
];

const listEventsValidator = [
  query('event_type').optional().isIn(EVENT_TYPES).withMessage('Type de filtre invalide'),
  query('status').optional().isIn(EVENT_STATUSES).withMessage('Statut de filtre invalide'),
  query('group_id').optional().isUUID().withMessage('Identifiant de groupe invalide'),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];

// --- Demandes de prière partagées ---
const createPrayerValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 150 })
    .withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('visibility').optional().isIn(PRAYER_VISIBILITIES)
    .withMessage(`La visibilité doit être : ${PRAYER_VISIBILITIES.join(', ')}`),
  body('group_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de groupe invalide'),
  body('is_anonymous').optional().isBoolean().withMessage('is_anonymous doit être un booléen'),
];

const updatePrayerValidator = [
  param('id').isUUID().withMessage('Identifiant de demande invalide'),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 150 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('status').optional().isIn(PRAYER_STATUSES).withMessage(`Le statut doit être : ${PRAYER_STATUSES.join(', ')}`),
  body('answered_note').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('is_anonymous').optional().isBoolean(),
];

const listPrayersValidator = [
  query('visibility').optional().isIn(PRAYER_VISIBILITIES).withMessage('Visibilité de filtre invalide'),
  query('status').optional().isIn(PRAYER_STATUSES).withMessage('Statut de filtre invalide'),
  query('group_id').optional().isUUID().withMessage('Identifiant de groupe invalide'),
];

// --- Annonces ---
const createAnnouncementValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 200 })
    .withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('content').trim().notEmpty().withMessage('Le contenu est requis').isLength({ max: 10000 }),
  body('group_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de groupe invalide'),
  body('is_pinned').optional().isBoolean().withMessage('is_pinned doit être un booléen'),
  body('priority').optional().isInt({ min: 0, max: 100 }).withMessage('La priorité doit être entre 0 et 100'),
  body('expires_at').optional({ nullable: true }).isISO8601().withMessage("La date d'expiration doit être au format ISO"),
];

const updateAnnouncementValidator = [
  param('id').isUUID().withMessage("Identifiant d'annonce invalide"),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 200 }),
  body('content').optional().trim().notEmpty().withMessage('Le contenu ne peut pas être vide').isLength({ max: 10000 }),
  body('is_pinned').optional().isBoolean(),
  body('priority').optional().isInt({ min: 0, max: 100 }),
  body('expires_at').optional({ nullable: true }).isISO8601(),
];

const listAnnouncementsValidator = [
  query('group_id').optional().isUUID().withMessage('Identifiant de groupe invalide'),
];

// --- Commun ---
const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

module.exports = {
  EVENT_TYPES,
  EVENT_STATUSES,
  PRAYER_VISIBILITIES,
  PRAYER_STATUSES,
  createEventValidator,
  updateEventValidator,
  listEventsValidator,
  createPrayerValidator,
  updatePrayerValidator,
  listPrayersValidator,
  createAnnouncementValidator,
  updateAnnouncementValidator,
  listAnnouncementsValidator,
  idParamValidator,
};
