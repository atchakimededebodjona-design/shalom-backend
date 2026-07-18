// src/modules/ambassador/ambassador.validator.js
// Règles de validation express-validator du module Ambassadeur.
// Pattern identique aux autres modules : les arrays ne contiennent que des
// règles express-validator. La vérification est faite dans le contrôleur
// via hasValidationErrors(req, res).

'use strict';

const { body, param, query } = require('express-validator');

// =========================================================================
// Paramètre :id UUID générique
// =========================================================================
const idParamValidator = [
  param('id').isUUID(4).withMessage('ID invalide'),
];

// =========================================================================
// Rejoindre le programme ambassadeur
// =========================================================================
const joinProgramValidator = [
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La biographie ne peut pas dépasser 500 caractères'),
];

// =========================================================================
// Mise à jour du profil ambassadeur
// =========================================================================
const updateProfileValidator = [
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La biographie ne peut pas dépasser 500 caractères'),
];

// =========================================================================
// Lister les parrainages
// =========================================================================
const listReferralsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un entier ≥ 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  query('status')
    .optional()
    .isIn(['registered', 'subscribed', 'qualified', 'expired'])
    .withMessage('Statut invalide. Valeurs : registered, subscribed, qualified, expired'),
];

// =========================================================================
// Lister les commissions
// =========================================================================
const listCommissionsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un entier ≥ 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'paid', 'cancelled'])
    .withMessage('Statut invalide. Valeurs : pending, approved, paid, cancelled'),
  query('month')
    .optional()
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('Le mois doit être au format YYYY-MM'),
];

// =========================================================================
// Demande de retrait Mobile Money
// =========================================================================
const requestWithdrawalValidator = [
  body('amount')
    .notEmpty().withMessage('Le montant est requis')
    .isInt({ min: 5000 })
    .withMessage('Le montant minimum de retrait est 5 000 FCFA'),
  body('phone_number')
    .notEmpty().withMessage('Le numéro de téléphone Mobile Money est requis')
    .matches(/^\+?[1-9]\d{7,14}$/)
    .withMessage('Numéro invalide — format international requis (ex: +22997123456)'),
  body('operator')
    .notEmpty().withMessage("L'opérateur Mobile Money est requis")
    .isIn(['mtn', 'moov', 'wave', 'orange', 'other'])
    .withMessage('Opérateur invalide. Valeurs : mtn, moov, wave, orange, other'),
];

// =========================================================================
// Admin : changer le niveau d'un ambassadeur
// =========================================================================
const adminSetLevelValidator = [
  param('id').isUUID(4).withMessage('ID ambassadeur invalide'),
  body('level')
    .notEmpty().withMessage('Le niveau est requis')
    .isIn(['standard', 'certified'])
    .withMessage('Niveau invalide. Valeurs : standard, certified'),
];

// =========================================================================
// Admin : changer le statut d'un ambassadeur
// =========================================================================
const adminSetStatusValidator = [
  param('id').isUUID(4).withMessage('ID ambassadeur invalide'),
  body('status')
    .notEmpty().withMessage('Le statut est requis')
    .isIn(['active', 'suspended', 'pending_review'])
    .withMessage('Statut invalide. Valeurs : active, suspended, pending_review'),
];

// =========================================================================
// Admin : traiter un retrait (compléter, rejeter, annuler)
// =========================================================================
const adminProcessWithdrawalValidator = [
  param('id').isUUID(4).withMessage('ID retrait invalide'),
  body('status')
    .notEmpty().withMessage('Le statut est requis')
    .isIn(['processing', 'completed', 'failed', 'cancelled'])
    .withMessage('Statut invalide. Valeurs : processing, completed, failed, cancelled'),
  body('reference')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 150 })
    .withMessage('La référence ne peut pas dépasser 150 caractères'),
  body('admin_notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Les notes ne peuvent pas dépasser 1 000 caractères'),
];

// =========================================================================
// Admin : approuver une commission
// =========================================================================
const adminApproveCommissionValidator = [
  param('id').isUUID(4).withMessage('ID commission invalide'),
];

// =========================================================================
// Admin : lister les ambassadeurs
// =========================================================================
const adminListAmbassadorsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un entier ≥ 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  query('level').optional().isIn(['standard', 'certified']).withMessage('Niveau invalide'),
  query('status').optional().isIn(['active', 'suspended', 'pending_review']).withMessage('Statut invalide'),
];

// =========================================================================
// Admin : lister toutes les commissions
// =========================================================================
const adminListCommissionsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un entier ≥ 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'paid', 'cancelled'])
    .withMessage('Statut invalide'),
  query('month')
    .optional()
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('Format YYYY-MM requis'),
  query('ambassador_id')
    .optional()
    .isUUID(4)
    .withMessage('ID ambassadeur invalide'),
];

module.exports = {
  idParamValidator,
  joinProgramValidator,
  updateProfileValidator,
  listReferralsValidator,
  listCommissionsValidator,
  requestWithdrawalValidator,
  adminSetLevelValidator,
  adminSetStatusValidator,
  adminProcessWithdrawalValidator,
  adminApproveCommissionValidator,
  adminListAmbassadorsValidator,
  adminListCommissionsValidator,
};
