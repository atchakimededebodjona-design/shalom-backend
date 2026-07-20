// src/modules/clients/clients.validator.js
// Validation des entrées pour les clients à facturer (module Reçu+).

const { body, param, query } = require('express-validator');

const createValidator = [
  body('name').trim().notEmpty().withMessage('Le nom est requis').isLength({ max: 150 })
    .withMessage('Le nom ne peut pas dépasser 150 caractères'),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Email invalide'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 40 })
    .withMessage('Le téléphone ne peut pas dépasser 40 caractères'),
  body('address').optional({ nullable: true }).trim().isLength({ max: 500 })
    .withMessage("L'adresse ne peut pas dépasser 500 caractères"),
];

const updateValidator = [
  param('id').isUUID().withMessage('Identifiant de client invalide'),
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide').isLength({ max: 150 })
    .withMessage('Le nom ne peut pas dépasser 150 caractères'),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Email invalide'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 40 })
    .withMessage('Le téléphone ne peut pas dépasser 40 caractères'),
  body('address').optional({ nullable: true }).trim().isLength({ max: 500 })
    .withMessage("L'adresse ne peut pas dépasser 500 caractères"),
];

const listValidator = [
  query('search').optional().trim().isLength({ max: 150 }),
];

const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

module.exports = { createValidator, updateValidator, listValidator, idParamValidator };
