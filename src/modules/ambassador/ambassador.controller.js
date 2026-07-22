// src/modules/ambassador/ambassador.controller.js
// Contrôleurs HTTP du module Ambassadeur SHALOM.

'use strict';

const service = require('./ambassador.service');
const { hasValidationErrors } = require('../../utils/validate');
const { isAdminEmail } = require('../../utils/admin');

// =========================================================================
// Helpers
// =========================================================================

/**
 * Vérifie que l'utilisateur connecté est administrateur.
 * Lève une erreur 403 sinon.
 * @param {object} req
 * @param {object} res
 * @returns {boolean} true si accès refusé (réponse déjà envoyée)
 */
const denyIfNotAdmin = (req, res) => {
  if (!isAdminEmail(req.user?.email)) {
    res.status(403).json({
      success: false,
      error: 'Accès réservé aux administrateurs SHALOM',
      code: 'FORBIDDEN',
    });
    return true;
  }
  return false;
};

// =========================================================================
// 1. Profil Ambassadeur
// =========================================================================

/**
 * POST /api/v1/ambassador/join
 * Rejoindre le programme ambassadeur
 */
const join = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const profile = await service.joinProgram(req.user.id, req.body);
    return res.status(201).json({
      success: true,
      message: 'Bienvenue dans le programme ambassadeur SHALOM 🕊️',
      data: { ambassador: profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ambassador/profile
 * Récupérer mon profil ambassadeur
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await service.getMyProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Vous n'êtes pas encore ambassadeur. Rejoignez le programme via POST /api/v1/ambassador/join",
        code: 'AMBASSADOR_NOT_FOUND',
      });
    }
    return res.status(200).json({ success: true, data: { ambassador: profile } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/ambassador/profile
 * Mettre à jour mon profil ambassadeur
 */
const updateProfile = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const profile = await service.updateMyProfile(req.user.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Profil ambassadeur mis à jour',
      data: { ambassador: profile },
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 2. Tableau de bord
// =========================================================================

/**
 * GET /api/v1/ambassador/dashboard
 * Tableau de bord ambassadeur
 */
const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await service.getDashboard(req.user.id);
    return res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 3. Parrainages
// =========================================================================

/**
 * GET /api/v1/ambassador/referral-link
 * Obtenir mon lien et QR de parrainage
 */
const getReferralLink = async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // Utilise l'env FRONTEND_URL si disponible (meilleure pratique)
    const frontendUrl = process.env.FRONTEND_URL || baseUrl;
    const result = await service.getReferralLink(req.user.id, frontendUrl);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ambassador/referrals
 * Lister mes parrainages (paginé, avec filtre ?status=)
 */
const listReferrals = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.listReferrals(req.user.id, req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 4. Commissions
// =========================================================================

/**
 * GET /api/v1/ambassador/commissions
 * Lister mes commissions
 */
const listCommissions = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.listMyCommissions(req.user.id, req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ambassador/commissions/summary
 * Résumé de mes commissions par statut
 */
const getCommissionSummary = async (req, res, next) => {
  try {
    const summary = await service.getCommissionSummary(req.user.id);
    return res.status(200).json({ success: true, data: { summary } });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 5. Retraits
// =========================================================================

/**
 * POST /api/v1/ambassador/withdrawals
 * Demander un retrait Mobile Money
 */
const requestWithdrawal = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const withdrawal = await service.requestWithdrawal(req.user.id, req.body);
    return res.status(201).json({
      success: true,
      message: 'Demande de retrait enregistrée. Elle sera traitée sous 24-48h.',
      data: { withdrawal },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ambassador/withdrawals
 * Lister mes retraits
 */
const listWithdrawals = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.listMyWithdrawals(req.user.id, req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 6. Routes Admin
// =========================================================================

/**
 * GET /api/v1/admin/ambassador/list
 * Lister tous les ambassadeurs
 */
const adminListAmbassadors = async (req, res, next) => {
  try {
    if (denyIfNotAdmin(req, res)) return;
    if (hasValidationErrors(req, res)) return;
    const result = await service.adminListAmbassadors(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/ambassador/:id/level
 * Changer le niveau d'un ambassadeur
 */
const adminSetLevel = async (req, res, next) => {
  try {
    if (denyIfNotAdmin(req, res)) return;
    if (hasValidationErrors(req, res)) return;
    const profile = await service.adminSetLevel(req.params.id, req.body.level);
    return res.status(200).json({
      success: true,
      message: `Niveau mis à jour : ${profile.level}`,
      data: { ambassador: profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/ambassador/:id/status
 * Changer le statut d'un ambassadeur (suspendre, réactiver)
 */
const adminSetStatus = async (req, res, next) => {
  try {
    if (denyIfNotAdmin(req, res)) return;
    if (hasValidationErrors(req, res)) return;
    const profile = await service.adminSetStatus(req.params.id, req.body.status);
    return res.status(200).json({
      success: true,
      message: `Statut mis à jour : ${profile.status}`,
      data: { ambassador: profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/ambassador/commissions
 * Lister toutes les commissions (admin)
 */
const adminListCommissions = async (req, res, next) => {
  try {
    if (denyIfNotAdmin(req, res)) return;
    if (hasValidationErrors(req, res)) return;
    const result = await service.adminListCommissions(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/ambassador/commissions/:id
 * Approuver une commission (crédite le solde de l'ambassadeur)
 */
const adminApproveCommission = async (req, res, next) => {
  try {
    if (denyIfNotAdmin(req, res)) return;
    if (hasValidationErrors(req, res)) return;
    const result = await service.approveCommission(req.params.id);
    return res.status(200).json({
      success: true,
      message: `Commission approuvée. Solde ambassadeur crédité de ${result.amount.toLocaleString('fr-FR')} FCFA`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/ambassador/withdrawals
 * Lister tous les retraits (admin)
 */
const adminListWithdrawals = async (req, res, next) => {
  try {
    if (denyIfNotAdmin(req, res)) return;
    if (hasValidationErrors(req, res)) return;
    const result = await service.adminListWithdrawals(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/ambassador/withdrawals/:id
 * Traiter un retrait (compléter, rejeter, annuler)
 */
const adminProcessWithdrawal = async (req, res, next) => {
  try {
    if (denyIfNotAdmin(req, res)) return;
    if (hasValidationErrors(req, res)) return;
    const withdrawal = await service.adminProcessWithdrawal(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: `Retrait mis à jour : ${withdrawal.status}`,
      data: { withdrawal },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  join,
  getProfile,
  updateProfile,
  getDashboard,
  getReferralLink,
  listReferrals,
  listCommissions,
  getCommissionSummary,
  requestWithdrawal,
  listWithdrawals,
  // Admin
  adminListAmbassadors,
  adminSetLevel,
  adminSetStatus,
  adminListCommissions,
  adminApproveCommission,
  adminListWithdrawals,
  adminProcessWithdrawal,
};
