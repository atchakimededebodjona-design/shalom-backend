// src/modules/likes/likes.controller.js
// Contrôleur pour le module likes

const likesService = require('./likes.service');
const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * POST /api/v1/likes
 * Liker un post ou un commentaire
 */
const addLike = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const userId = req.user.id;
    
    // Le body contient likeable_type (enum: 'post' | 'comment') et likeable_id (UUID)
    const added = await likesService.addLike(userId, req.body);

    if (!added) {
      // Déjà liké
      return res.status(409).json({
        success: false,
        message: 'Vous avez déjà liké ce contenu',
        data: {},
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Like ajouté avec succès',
      data: {},
    });
  } catch (error) {
    // Erreur de clé étrangère (si le post ou commentaire ciblé n'existe pas)
    if (error.code === '23503') {
      next(new AppError('La ressource ciblée n\'existe pas', 404, 'RESOURCE_NOT_FOUND'));
    } else {
      next(error);
    }
  }
};

/**
 * DELETE /api/v1/likes
 * Retirer un like
 */
const removeLike = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const userId = req.user.id;

    const removed = await likesService.removeLike(userId, req.body);

    if (!removed) {
      // N'était pas liké
      return res.status(200).json({
        success: true,
        message: 'Aucun like à retirer',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Like retiré avec succès',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addLike,
  removeLike,
};
