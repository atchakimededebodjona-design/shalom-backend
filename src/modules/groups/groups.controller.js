// src/modules/groups/groups.controller.js
// Contrôleur pour les groupes

const groupsService = require('./groups.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

const createGroup = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const userId = req.user.id;
    const group = await groupsService.createGroup(userId, req.body);
    
    return res.status(201).json({
      success: true,
      message: 'Groupe créé avec succès',
      data: { group }
    });
  } catch (error) {
    next(error);
  }
};

const getGroups = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search || null;
    
    const { groups, total } = await groupsService.getGroups(limit, offset, search);
    const pagination = formatPagination(page, limit, total);
    
    return res.status(200).json({
      success: true,
      data: { groups, pagination }
    });
  } catch (error) {
    next(error);
  }
};

const getGroupById = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id } = req.params;
    const group = await groupsService.getGroupById(id);
    
    if (!group) {
      throw new AppError('Groupe introuvable ou supprimé', 404, 'GROUP_NOT_FOUND');
    }
    
    return res.status(200).json({
      success: true,
      data: { group }
    });
  } catch (error) {
    next(error);
  }
};

const updateGroup = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id } = req.params;
    const userId = req.user.id;
    
    const group = await groupsService.updateGroup(id, userId, req.body);
    if (!group) {
      throw new AppError('Non autorisé ou groupe introuvable', 403, 'FORBIDDEN');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Groupe mis à jour',
      data: { group }
    });
  } catch (error) {
    next(error);
  }
};

const deleteGroup = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id } = req.params;
    const userId = req.user.id;
    
    const isDeleted = await groupsService.softDeleteGroup(id, userId);
    if (!isDeleted) {
      throw new AppError('Non autorisé ou groupe introuvable', 403, 'FORBIDDEN');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Groupe supprimé avec succès',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

const joinGroup = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id } = req.params;
    const userId = req.user.id;
    
    const status = await groupsService.joinGroup(id, userId);
    
    if (status === 'en_attente') {
      return res.status(200).json({
        success: true,
        message: "Votre demande est en attente d'approbation",
        data: { status }
      });
    }
    
    return res.status(201).json({
      success: true,
      message: "Vous avez rejoint le groupe",
      data: { status }
    });
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      next(new AppError('Groupe introuvable', 404, 'GROUP_NOT_FOUND'));
    } else if (error.message === 'ALREADY_MEMBER') {
      next(new AppError('Déjà membre ou demande déjà en attente', 409, 'ALREADY_MEMBER'));
    } else {
      next(error);
    }
  }
};

const getMembers = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    
    const { members, total } = await groupsService.getMembers(id, limit, offset);
    const pagination = formatPagination(page, limit, total);
    
    return res.status(200).json({
      success: true,
      data: { members, pagination }
    });
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id, userId } = req.params;
    const currentUserId = req.user.id;
    
    const isRemoved = await groupsService.removeMember(id, currentUserId, userId);
    if (!isRemoved) {
      throw new AppError('Non autorisé ou membre introuvable', 403, 'FORBIDDEN');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Membre retiré du groupe',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id, userId } = req.params;
    const currentUserId = req.user.id;
    const { role } = req.body;
    
    const isUpdated = await groupsService.updateMemberRole(id, currentUserId, userId, role);
    if (!isUpdated) {
      throw new AppError('Non autorisé ou membre introuvable', 403, 'FORBIDDEN');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Rôle mis à jour',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

const updateMemberStatus = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id, userId } = req.params;
    const currentUserId = req.user.id;
    const { status } = req.body;
    
    const isUpdated = await groupsService.updateMemberStatus(id, currentUserId, userId, status);
    if (!isUpdated) {
      throw new AppError('Non autorisé ou demande introuvable', 403, 'FORBIDDEN');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Statut du membre mis à jour',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/groups/directory
 * Annuaire des groupes / cellules de prière, filtrable par catégorie.
 */
const getDirectory = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);

    const { groups, total } = await groupsService.getDirectory({
      category: req.query.category || null,
      search: req.query.search || null,
      limit,
      offset
    });
    const pagination = formatPagination(page, limit, total);

    return res.status(200).json({
      success: true,
      data: { groups, pagination }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/groups/mine
 * Groupes dont l'utilisateur est membre actif, avec son rôle.
 */
const getMyGroups = async (req, res, next) => {
  try {
    const groups = await groupsService.getMyGroups(req.user.id);
    return res.status(200).json({ success: true, data: { groups } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroup,
  getMembers,
  removeMember,
  updateMemberRole,
  updateMemberStatus,
  getDirectory,
  getMyGroups
};
