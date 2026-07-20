// src/modules/invoices/invoices.validator.js
// Validation des entrées du module Facturation (Reçu+).

const { body, param, query } = require('express-validator');

const INVOICE_STATUSES = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'];
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'];

const createValidator = [
  body('invoice_number').trim().notEmpty().withMessage('Le numéro de facture est requis')
    .isLength({ max: 50 }).withMessage('Le numéro ne peut pas dépasser 50 caractères'),
  body('client_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de client invalide'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).withMessage('La devise doit faire 3 lettres (ex: XOF)'),
  body('issue_date').optional({ nullable: true }).isISO8601().withMessage("La date d'émission doit être au format YYYY-MM-DD"),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage("La date d'échéance doit être au format YYYY-MM-DD"),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Le taux de taxe doit être entre 0 et 100'),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('Les notes ne peuvent pas dépasser 2000 caractères'),
  body('items').isArray({ min: 1 }).withMessage('Une facture doit contenir au moins une ligne'),
  body('items.*.description').trim().notEmpty().withMessage('Chaque ligne doit avoir une description')
    .isLength({ max: 255 }).withMessage('La description ne peut pas dépasser 255 caractères'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('La quantité doit être strictement positive'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Le prix unitaire ne peut pas être négatif'),
];

const updateValidator = [
  param('id').isUUID().withMessage('Identifiant de facture invalide'),
  body('invoice_number').optional().trim().notEmpty().withMessage('Le numéro ne peut pas être vide')
    .isLength({ max: 50 }).withMessage('Le numéro ne peut pas dépasser 50 caractères'),
  body('client_id').optional({ nullable: true }).isUUID().withMessage('Identifiant de client invalide'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).withMessage('La devise doit faire 3 lettres'),
  body('issue_date').optional({ nullable: true }).isISO8601().withMessage("La date d'émission doit être au format YYYY-MM-DD"),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage("La date d'échéance doit être au format YYYY-MM-DD"),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Le taux de taxe doit être entre 0 et 100'),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('Les notes ne peuvent pas dépasser 2000 caractères'),
  body('status').optional().isIn(INVOICE_STATUSES).withMessage(`Le statut doit être : ${INVOICE_STATUSES.join(', ')}`),
];

const listValidator = [
  query('status').optional().isIn(INVOICE_STATUSES).withMessage(`Le statut doit être : ${INVOICE_STATUSES.join(', ')}`),
  query('client_id').optional().isUUID().withMessage('Identifiant de client invalide'),
  query('from').optional().isISO8601().withMessage('La date "from" doit être au format YYYY-MM-DD'),
  query('to').optional().isISO8601().withMessage('La date "to" doit être au format YYYY-MM-DD'),
];

const paymentValidator = [
  param('id').isUUID().withMessage('Identifiant de facture invalide'),
  body('amount').isFloat({ gt: 0 }).withMessage('Le montant doit être strictement positif'),
  body('method').optional().isIn(PAYMENT_METHODS).withMessage(`Le moyen doit être : ${PAYMENT_METHODS.join(', ')}`),
  body('paid_at').optional({ nullable: true }).isISO8601().withMessage('La date doit être au format YYYY-MM-DD'),
  body('reference').optional({ nullable: true }).trim().isLength({ max: 100 }).withMessage('La référence ne peut pas dépasser 100 caractères'),
  body('note').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('La note ne peut pas dépasser 500 caractères'),
];

const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

module.exports = {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  createValidator,
  updateValidator,
  listValidator,
  paymentValidator,
  idParamValidator,
};
