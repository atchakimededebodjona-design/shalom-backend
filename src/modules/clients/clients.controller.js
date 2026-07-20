// src/modules/clients/clients.controller.js
// Contrôleur des clients à facturer (module Reçu+).

const clientsService = require('./clients.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

const create = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const client = await clientsService.create(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Client créé', data: { client } });
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { clients, total } = await clientsService.list(req.user.id, {
      search: req.query.search || null,
      limit,
      offset,
    });
    return res.status(200).json({
      success: true,
      data: { clients, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const client = await clientsService.getById(req.params.id, req.user.id);
    if (!client) throw new AppError('Client introuvable', 404, 'CLIENT_NOT_FOUND');
    return res.status(200).json({ success: true, data: { client } });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const client = await clientsService.update(req.params.id, req.user.id, req.body);
    if (!client) throw new AppError('Client introuvable', 404, 'CLIENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Client mis à jour', data: { client } });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await clientsService.softDelete(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Client introuvable', 404, 'CLIENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Client supprimé', data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = { create, list, getOne, update, remove };
