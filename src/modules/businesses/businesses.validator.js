// src/modules/businesses/businesses.validator.js
// Validation des entrées du profil entreprise (module Reçu+).

const { body } = require('express-validator');

const currencyRule = body('currency')
  .optional({ checkFalsy: true })
  .trim()
  .isLength({ min: 3, max: 3 }).withMessage('La devise doit faire 3 lettres (ex : XOF)')
  .isAlpha().withMessage('La devise ne doit contenir que des lettres');

const prefixRule = body('invoice_prefix')
  .optional({ checkFalsy: true })
  .trim()
  .isLength({ max: 20 }).withMessage('Le préfixe ne peut pas dépasser 20 caractères');

const optionalFields = [
  body('address').optional({ nullable: true }).trim().isLength({ max: 500 })
    .withMessage("L'adresse ne peut pas dépasser 500 caractères"),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 40 })
    .withMessage('Le téléphone ne peut pas dépasser 40 caractères'),
  body('tax_id').optional({ nullable: true }).trim().isLength({ max: 100 })
    .withMessage('Le NIF/RCCM ne peut pas dépasser 100 caractères'),
  body('logo_url').optional({ nullable: true }).trim().isLength({ max: 1000 })
    .withMessage('URL du logo invalide'),
  currencyRule,
  prefixRule,
];

const createValidator = [
  body('name').trim().notEmpty().withMessage("Le nom de l'entreprise est requis")
    .isLength({ max: 150 }).withMessage('Le nom ne peut pas dépasser 150 caractères'),
  ...optionalFields,
];

const updateValidator = [
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide')
    .isLength({ max: 150 }).withMessage('Le nom ne peut pas dépasser 150 caractères'),
  ...optionalFields,
];

module.exports = { createValidator, updateValidator };
