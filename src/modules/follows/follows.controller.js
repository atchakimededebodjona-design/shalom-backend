// src/modules/follows/follows.controller.js
const followsService = require('./follows.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

const followUser = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    
    const followerId = req.user.id;
    const { followed_id } = req.body;
    
    const isNewFollow = await followsService.followUser(followerId, followed_id);
    
    if (!isNewFollow) {
      return res.status(200).json({
        success: true,
        message: 'Vous suivez déjà cet utilisateur',
        data: { followed: true }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Utilisateur suivi avec succès',
      data: { followed: true }
    });
  } catch (error) {
    if (error.message === 'SELF_FOLLOW') {
      next(new AppError('Vous ne pouvez pas vous suivre vous-même', 400, 'SELF_FOLLOW'));
    } else if (error.message === 'USER_NOT_FOUND') {
      next(new AppError('Utilisateur introuvable', 404, 'USER_NOT_FOUND'));
    } else {
      next(error);
    }
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const followerId = req.user.id;
    const { followedId } = req.params;
    
    const isUnfollowed = await followsService.unfollowUser(followerId, followedId);
    
    if (!isUnfollowed) {
      return res.status(200).json({
        success: true,
        message: 'Vous ne suiviez pas cet utilisateur',
        data: { followed: false }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Désabonnement réussi',
      data: { followed: false }
    });
  } catch (error) {
    next(error);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    
    const { userId } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    
    const { followers, total } = await followsService.getFollowers(userId, limit, offset);
    const pagination = formatPagination(page, limit, total);
    
    return res.status(200).json({
      success: true,
      data: { followers, pagination }
    });
  } catch (error) {
    next(error);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    
    const { userId } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    
    const { following, total } = await followsService.getFollowing(userId, limit, offset);
    const pagination = formatPagination(page, limit, total);
    
    return res.status(200).json({
      success: true,
      data: { following, pagination }
    });
  } catch (error) {
    next(error);
  }
};

const checkFollowStatus = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    
    const followerId = req.user.id;
    const { userId } = req.params;
    
    const isFollowing = await followsService.checkFollowStatus(followerId, userId);
    
    return res.status(200).json({
      success: true,
      data: { isFollowing }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
};
