// src/modules/comments/comments.controller.js
// Contrôleur pour les commentaires

const commentsService = require('./comments.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * POST /api/v1/comments/post/:postId
 * Ajouter un commentaire à un post
 */
const addComment = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { postId } = req.params;
    const authorId = req.user.id;
    
    // Le service va vérifier si le post existe via la foreign key (qui lèvera une erreur SQL si introuvable).
    // On pourrait aussi ajouter un check préalable si on veut une erreur 404 plus propre.
    const comment = await commentsService.addComment(postId, authorId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Commentaire ajouté avec succès',
      data: { comment },
    });
  } catch (error) {
    // Si l'erreur vient d'une violation de contrainte de clé étrangère (post_id invalide)
    if (error.code === '23503') {
      next(new AppError('Le post spécifié n\'existe pas', 404, 'POST_NOT_FOUND'));
    } else {
      next(error);
    }
  }
};

/**
 * GET /api/v1/comments/post/:postId
 * Lister les commentaires d'un post
 */
const getCommentsByPost = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { postId } = req.params;
    const { page, limit, offset } = getPagination(req.query);

    const { comments, total } = await commentsService.getCommentsByPost(postId, limit, offset);
    const pagination = formatPagination(page, limit, total);

    return res.status(200).json({
      success: true,
      data: {
        comments,
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/comments/:id
 * Supprimer son propre commentaire (soft delete)
 */
const deleteComment = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;
    const authorId = req.user.id;

    const isDeleted = await commentsService.softDeleteComment(id, authorId);

    if (!isDeleted) {
      throw new AppError(
        'Commentaire introuvable ou vous n\'avez pas les droits de suppression',
        403,
        'FORBIDDEN'
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Commentaire supprimé avec succès',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addComment,
  getCommentsByPost,
  deleteComment,
};
