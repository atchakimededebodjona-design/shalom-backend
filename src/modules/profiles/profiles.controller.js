// src/modules/profiles/profiles.controller.js
// Contrôleur du module profiles — reçoit les requêtes, appelle le service, renvoie les réponses

const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { isAdminEmail } = require('../../utils/admin');
const profilesService = require('./profiles.service');

/**
 * GET /api/v1/profiles/me
 * Récupérer le profil de l'utilisateur connecté
 */
const getMe = async (req, res, next) => {
  try {
    const profile = await profilesService.findProfileByUserId(req.user.id);

    if (!profile) {
      throw new AppError(
        'Profil introuvable',
        404,
        'PROFILE_NOT_FOUND'
      );
    }

    // Indicateur admin (calculé depuis ADMIN_EMAILS) : sert au frontend à
    // afficher l'espace d'administration. L'autorisation réelle reste vérifiée
    // côté serveur sur chaque route admin (requireAdmin).
    return res.status(200).json({
      success: true,
      data: { profile: { ...profile, is_admin: isAdminEmail(profile.email) } },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/profiles/search?q=&page=&limit=
 * Rechercher des utilisateurs par nom d'affichage
 */
const search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const { page, limit, offset } = getPagination(req.query);

    // Terme vide → résultats vides (on ne liste pas tous les utilisateurs)
    if (q.length < 1) {
      return res.status(200).json({
        success: true,
        data: { profiles: [], pagination: formatPagination(page, limit, 0) },
      });
    }

    const { profiles, total } = await profilesService.searchProfiles(q, req.user.id, limit, offset);
    const pagination = formatPagination(page, limit, total);

    return res.status(200).json({
      success: true,
      data: { profiles, pagination },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/profiles/:userId
 * Récupérer le profil public d'un autre utilisateur
 */
const getById = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const profile = await profilesService.findPublicProfileByUserId(req.params.userId);

    if (!profile) {
      throw new AppError('Profil introuvable', 404, 'PROFILE_NOT_FOUND');
    }

    return res.status(200).json({
      success: true,
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/profiles/me
 * Mettre à jour le profil de l'utilisateur connecté
 */
const updateMe = async (req, res, next) => {
  try {
    // Vérifier les erreurs de validation
    if (hasValidationErrors(req, res)) return;

    // Extraire uniquement les champs autorisés
    const {
      display_name,
      bio,
      avatar_url,
      cover_url,
      country,
      city,
      church_name,
      denomination,
      website,
    } = req.body;

    const updatedProfile = await profilesService.updateProfile(req.user.id, {
      display_name,
      bio,
      avatar_url,
      cover_url,
      country,
      city,
      church_name,
      denomination,
      website,
    });

    return res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: { profile: updatedProfile },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  search,
  getById,
  updateMe,
};
