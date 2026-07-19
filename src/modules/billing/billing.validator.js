// src/modules/billing/billing.validator.js
// Règles de validation express-validator du module Facturation (Reçu+)

const { body, param, query } = require('express-validator');

const idParamValidator = [param('id').isUUID().withMessage('Identifiant invalide')];
const paymentIdParamValidator = [param('paymentId').isUUID().withMessage('Identifiant de paiement invalide')];
const tokenParamValidator = [param('token').isUUID().withMessage('Jeton de partage invalide')];

// --- Entreprise ---

const createBusinessValidator = [
  body('name').trim().notEmpty().withMessage("Le nom de l'entreprise est obligatoire")
    .isLength({ max: 255 }).withMessage("Le nom ne peut pas dépasser 255 caractères"),
  body('logo_url').optional({ nullable: true }).isURL({ require_tld: false }).withMessage('logo_url doit être une URL valide'), // accepte aussi les URLs localhost (fichiers téléversés en dev)
  body('address').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('tax_id').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('currency').optional({ nullable: true }).trim().isLength({ min: 3, max: 3 }).withMessage('currency doit faire 3 caractères (ex: XOF)'),
  body('invoice_prefix').optional({ nullable: true }).trim().isLength({ max: 10 }),
];

const updateBusinessValidator = [
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide')
    .isLength({ max: 255 }),
  body('logo_url').optional({ nullable: true }).isURL({ require_tld: false }).withMessage('logo_url doit être une URL valide'), // accepte aussi les URLs localhost (fichiers téléversés en dev)
  body('address').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('tax_id').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('currency').optional({ nullable: true }).trim().isLength({ min: 3, max: 3 }),
  body('invoice_prefix').optional({ nullable: true }).trim().isLength({ max: 10 }),
];

// --- Clients ---

const createClientValidator = [
  body('name').trim().notEmpty().withMessage('Le nom du client est obligatoire')
    .isLength({ max: 255 }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email invalide'),
  body('address').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

const updateClientValidator = [
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide').isLength({ max: 255 }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email invalide'),
  body('address').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

const listClientsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

// --- Factures ---

const invoiceItemValidator = (field) => [
  body(`${field}.*.description`).trim().notEmpty().withMessage('La description d\'un article est obligatoire'),
  body(`${field}.*.quantity`).isFloat({ gt: 0 }).withMessage('La quantité doit être strictement positive'),
  body(`${field}.*.unit_price`).isInt({ min: 0 }).withMessage('Le prix unitaire doit être un entier positif ou nul'),
];

const createInvoiceValidator = [
  body('client_id').isUUID().withMessage('client_id doit être un UUID valide'),
  body('items').isArray({ min: 1 }).withMessage('La facture doit contenir au moins un article'),
  ...invoiceItemValidator('items'),
  body('tax_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).withMessage('tax_rate doit être compris entre 0 et 100'),
  body('discount_amount').optional({ nullable: true }).isInt({ min: 0 }).withMessage('discount_amount doit être un entier positif ou nul'),
  body('down_payment').optional({ nullable: true }).isInt({ min: 0 }).withMessage('down_payment doit être un entier positif ou nul'),
  body('issue_date').optional({ nullable: true }).isISO8601().withMessage('issue_date doit être une date valide (YYYY-MM-DD)'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('due_date doit être une date valide (YYYY-MM-DD)'),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
];

const updateInvoiceValidator = [
  body('client_id').optional().isUUID().withMessage('client_id doit être un UUID valide'),
  body('items').optional().isArray({ min: 1 }).withMessage('La facture doit contenir au moins un article'),
  ...invoiceItemValidator('items').map((v) => v.optional()),
  body('tax_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('discount_amount').optional({ nullable: true }).isInt({ min: 0 }).withMessage('discount_amount doit être un entier positif ou nul'),
  body('due_date').optional({ nullable: true }).isISO8601(),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('status').optional().isIn(['draft', 'partial', 'paid', 'overdue']).withMessage('Statut invalide'),
];

const listInvoicesValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['draft', 'partial', 'paid', 'overdue']).withMessage('Statut invalide'),
];

// --- Paiements ---

const createPaymentValidator = [
  body('amount').isInt({ gt: 0 }).withMessage('Le montant doit être un entier strictement positif'),
  body('payment_method').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('reference_id').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('payment_date').optional({ nullable: true }).isISO8601().withMessage('payment_date doit être une date valide'),
];

module.exports = {
  idParamValidator,
  paymentIdParamValidator,
  tokenParamValidator,
  createBusinessValidator,
  updateBusinessValidator,
  createClientValidator,
  updateClientValidator,
  listClientsValidator,
  createInvoiceValidator,
  updateInvoiceValidator,
  listInvoicesValidator,
  createPaymentValidator,
};
