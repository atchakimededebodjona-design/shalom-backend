// src/modules/profiles/profiles.controller.js
// Contrôleur du module profiles — reçoit les requêtes, appelle le service, renvoie les réponses

const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');
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
  updateMe,
};
