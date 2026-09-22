// src/modules/wallet/wallet.validator.js
// Validation des entrées du module Portefeuille (express-validator).

const { body, param, query } = require('express-validator');

// Types de mouvement au niveau portefeuille (≠ income/expense du suivi finance).
const TX_TYPES = ['credit', 'debit'];
const CATEGORY_TYPES = ['income', 'expense'];
const SOURCES = [
  'manual', 'topup', 'withdrawal', 'subscription', 'credit_purchase',
  'invoice', 'commission', 'refund', 'reversal', 'adjustment',
];
const PROVIDERS = ['cinetpay', 'fedapay', 'paygate'];
// FLOOZ / TMONEY : codes réseau documentés par le guide d'intégration
// PayGate Global (voir wallet.service.js, section PayGate).
const PAYGATE_NETWORKS = ['FLOOZ', 'TMONEY'];

// --- Consultation ---
const listTransactionsValidator = [
  query('type').optional().isIn(TX_TYPES).withMessage("Le type doit être 'credit' ou 'debit'"),
  query('source').optional().isIn(SOURCES).withMessage(`La source doit être : ${SOURCES.join(', ')}`),
  query('category_id').optional().isUUID().withMessage('Identifiant de catégorie invalide'),
  query('from').optional().isISO8601().withMessage('La date "from" doit être au format ISO 8601'),
  query('to').optional().isISO8601().withMessage('La date "to" doit être au format ISO 8601'),
];

// --- Revenu / Dépense manuels ---
const incomeValidator = [
  body('amount').isFloat({ gt: 0 }).withMessage('Le montant doit être un nombre strictement positif'),
  body('category_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de catégorie invalide'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
  body('reference_type').optional({ nullable: true }).trim().isLength({ max: 50 })
    .withMessage('reference_type ne peut pas dépasser 50 caractères'),
  body('reference_id').optional({ nullable: true }).isUUID().withMessage('reference_id doit être un UUID'),
];

// Débit manuel : mêmes règles que le crédit manuel.
const expenseValidator = incomeValidator;

// --- Rechargement (topup) ---
// phone_number/network : requis uniquement pour provider='paygate' (push
// USSD vers ce numéro) — sans objet pour cinetpay/fedapay (redirection).
const topupValidator = [
  body('amount').isFloat({ gt: 0 }).withMessage('Le montant doit être un nombre strictement positif'),
  body('provider').isIn(PROVIDERS).withMessage(`Le provider doit être : ${PROVIDERS.join(', ')}`),
  body('phone_number')
    .if(body('provider').equals('paygate'))
    .trim().notEmpty().withMessage('Le numéro de téléphone est requis pour PayGate')
    .isLength({ min: 6, max: 20 }).withMessage('Numéro de téléphone invalide'),
  body('network')
    .if(body('provider').equals('paygate'))
    .isIn(PAYGATE_NETWORKS).withMessage(`Le réseau doit être : ${PAYGATE_NETWORKS.join(', ')}`),
];

// --- Annulation ---
const reverseValidator = [
  param('id').isUUID().withMessage('Identifiant de transaction invalide'),
  body('reason').optional({ nullable: true }).trim().isLength({ max: 500 })
    .withMessage('La raison ne peut pas dépasser 500 caractères'),
];

// --- Catégories ---
const createCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Le nom est requis').isLength({ max: 100 })
    .withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('type').isIn(CATEGORY_TYPES).withMessage("Le type doit être 'income' ou 'expense'"),
  body('icon').optional({ nullable: true }).trim().isLength({ max: 50 })
    .withMessage("L'icône ne peut pas dépasser 50 caractères"),
  body('color').optional({ nullable: true }).trim().isLength({ max: 20 })
    .withMessage('La couleur ne peut pas dépasser 20 caractères'),
];

const updateCategoryValidator = [
  param('id').isUUID().withMessage('Identifiant de catégorie invalide'),
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide').isLength({ max: 100 })
    .withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('icon').optional({ nullable: true }).trim().isLength({ max: 50 })
    .withMessage("L'icône ne peut pas dépasser 50 caractères"),
  body('color').optional({ nullable: true }).trim().isLength({ max: 20 })
    .withMessage('La couleur ne peut pas dépasser 20 caractères'),
];

// --- Admin — observabilité des recharges ---
const TOPUP_STATUSES = ['pending', 'completed', 'failed', 'cancelled'];
const adminListTopupsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(TOPUP_STATUSES).withMessage(`Le statut doit être : ${TOPUP_STATUSES.join(', ')}`),
];

// NB: pas de validateur pour le webhook. La route /webhook/:provider doit
// TOUJOURS répondre 200 (cf. wallet.controller.handleWebhook) ; une validation
// renvoyant 400 casserait ce contrat et provoquerait des retries en boucle.
// Le contrôleur valide lui-même le provider via SUPPORTED_PROVIDERS.

// --- Commun ---
const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

module.exports = {
  TX_TYPES,
  CATEGORY_TYPES,
  SOURCES,
  PROVIDERS,
  TOPUP_STATUSES,
  listTransactionsValidator,
  incomeValidator,
  expenseValidator,
  topupValidator,
  reverseValidator,
  createCategoryValidator,
  updateCategoryValidator,
  idParamValidator,
  adminListTopupsValidator,
};
