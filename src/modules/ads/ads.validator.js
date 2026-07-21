// src/modules/ads/ads.validator.js
// Validation des entrées du module Publicités (table `ads` : title + image_url + lien).

const { body, param } = require('express-validator');

const createValidator = [
  body('title').trim().notEmpty().withMessage('Le titre est requis')
    .isLength({ max: 150 }).withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('image_url').trim().notEmpty().withMessage("L'image est requise")
    .isLength({ max: 2000 }).withMessage("L'URL de l'image est trop longue"),
  body('link_url').optional({ nullable: true }).trim()
    .isLength({ max: 2000 }).withMessage('Le lien est trop long'),
  body('is_active').optional().isBoolean().withMessage('is_active doit être un booléen'),
  body('display_order').optional().isInt({ min: 0 }).withMessage("L'ordre doit être un entier positif"),
];

const updateValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide')
    .isLength({ max: 150 }).withMessage('Le titre ne peut pas dépasser 150 caractères'),
  body('image_url').optional().trim().notEmpty().withMessage("L'image ne peut pas être vide")
    .isLength({ max: 2000 }).withMessage("L'URL de l'image est trop longue"),
  body('link_url').optional({ nullable: true }).trim()
    .isLength({ max: 2000 }).withMessage('Le lien est trop long'),
  body('is_active').optional().isBoolean().withMessage('is_active doit être un booléen'),
  body('display_order').optional().isInt({ min: 0 }).withMessage("L'ordre doit être un entier positif"),
];

const idParamValidator = [
  param('id').isUUID().withMessage('Identifiant invalide'),
];

module.exports = { createValidator, updateValidator, idParamValidator };
