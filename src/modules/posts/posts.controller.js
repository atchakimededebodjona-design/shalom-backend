// src/modules/posts/posts.controller.js
// Contrôleur pour le module posts

const postsService = require('./posts.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * GET /api/v1/posts
 * Récupérer le fil d'actualité avec pagination
 */
const getFeed = async (req, res, next) => {
  try {
    // Pagination depuis les utilitaires
    const { page, limit, offset } = getPagination(req.query);

    const { posts, total } = await postsService.getFeed(req.user.id, limit, offset);
    const pagination = formatPagination(page, limit, total);

    return res.status(200).json({
      success: true,
      data: {
        posts,
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/posts/:id
 * Récupérer un post par son ID
 */
const getPostById = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;
    const post = await postsService.getPostById(id, req.user.id);

    if (!post) {
      throw new AppError('Post introuvable ou supprimé', 404, 'POST_NOT_FOUND');
    }

    return res.status(200).json({
      success: true,
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/posts
 * Créer un nouveau post
 */
const createPost = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const authorId = req.user.id;
    const post = await postsService.createPost(authorId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Post créé avec succès',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/posts/:id
 * Modifier un post existant
 */
const updatePost = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;
    const authorId = req.user.id;

    const updatedPost = await postsService.updatePost(id, authorId, req.body);

    if (!updatedPost) {
      throw new AppError(
        'Post introuvable ou vous n\'avez pas les droits de modification',
        403,
        'FORBIDDEN'
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Post mis à jour avec succès',
      data: { post: updatedPost },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/posts/:id
 * Supprimer un post (soft delete)
 */
const deletePost = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;
    const authorId = req.user.id;

    const isDeleted = await postsService.softDeletePost(id, authorId);

    if (!isDeleted) {
      throw new AppError(
        'Post introuvable ou vous n\'avez pas les droits de suppression',
        403,
        'FORBIDDEN'
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Post supprimé avec succès',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeed,
  getPostById,
  createPost,
  updatePost,
  deletePost,
};
