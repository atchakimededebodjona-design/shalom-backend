// src/modules/tools/tools.controller.js
// Contrôleur du module Outils pratiques du quotidien.

const service = require('./tools.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

// Les query strings arrivent en texte : 'true'/'false' → booléen, sinon null.
const parseBool = (v) => (v === undefined || v === '' ? null : v === 'true' || v === true);

// =========================================================================
//  Dîme / offrandes
// =========================================================================

const createTithe = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const calculation = await service.createTithe(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Calcul enregistré', data: { calculation } });
  } catch (error) { next(error); }
};

const listTithes = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { calculations, total } = await service.listTithes(req.user.id, {
      is_paid: parseBool(req.query.is_paid),
      from: req.query.from || null,
      to: req.query.to || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { calculations, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const getTithe = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const calculation = await service.getTitheById(req.params.id, req.user.id);
    if (!calculation) throw new AppError('Calcul introuvable', 404, 'TITHE_NOT_FOUND');
    return res.status(200).json({ success: true, data: { calculation } });
  } catch (error) { next(error); }
};

const updateTithe = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const calculation = await service.updateTithe(req.params.id, req.user.id, req.body);
    if (!calculation) throw new AppError('Calcul introuvable', 404, 'TITHE_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Calcul mis à jour', data: { calculation } });
  } catch (error) { next(error); }
};

const deleteTithe = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.deleteTithe(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Calcul introuvable', 404, 'TITHE_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Calcul supprimé', data: {} });
  } catch (error) { next(error); }
};

// =========================================================================
//  Événements personnels
// =========================================================================

const createEvent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const event = await service.createEvent(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Événement planifié', data: { event } });
  } catch (error) { next(error); }
};

const listEvents = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { events, total } = await service.listEvents(req.user.id, {
      status: req.query.status || null,
      event_type: req.query.event_type || null,
      from: req.query.from || null,
      to: req.query.to || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { events, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const getEvent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const event = await service.getEventById(req.params.id, req.user.id);
    if (!event) throw new AppError('Événement introuvable', 404, 'EVENT_NOT_FOUND');
    return res.status(200).json({ success: true, data: { event } });
  } catch (error) { next(error); }
};

const updateEvent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const event = await service.updateEvent(req.params.id, req.user.id, req.body);
    if (!event) throw new AppError('Événement introuvable', 404, 'EVENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Événement mis à jour', data: { event } });
  } catch (error) { next(error); }
};

const deleteEvent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeleteEvent(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Événement introuvable', 404, 'EVENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Événement supprimé', data: {} });
  } catch (error) { next(error); }
};

// =========================================================================
//  Listes de tâches
// =========================================================================

const createList = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const list = await service.createList(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Liste créée', data: { list } });
  } catch (error) { next(error); }
};

const listLists = async (req, res, next) => {
  try {
    const lists = await service.listLists(req.user.id);
    return res.status(200).json({ success: true, data: { lists } });
  } catch (error) { next(error); }
};

const getList = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const list = await service.getListById(req.params.id, req.user.id);
    if (!list) throw new AppError('Liste introuvable', 404, 'LIST_NOT_FOUND');
    return res.status(200).json({ success: true, data: { list } });
  } catch (error) { next(error); }
};

const updateList = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const list = await service.updateList(req.params.id, req.user.id, req.body);
    if (!list) throw new AppError('Liste introuvable', 404, 'LIST_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Liste mise à jour', data: { list } });
  } catch (error) { next(error); }
};

const deleteList = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeleteList(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Liste introuvable', 404, 'LIST_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Liste supprimée', data: {} });
  } catch (error) { next(error); }
};

const reorderTasks = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const tasks = await service.reorderTasks(req.params.id, req.user.id, req.body.ordered_ids);
    if (!tasks) {
      throw new AppError(
        'Liste introuvable, ou certaines tâches n\'appartiennent pas à cette liste',
        404,
        'REORDER_INVALID'
      );
    }
    return res.status(200).json({ success: true, message: 'Tâches réordonnées', data: { tasks } });
  } catch (error) { next(error); }
};

// =========================================================================
//  Tâches
// =========================================================================

const createTask = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const task = await service.createTask(req.user.id, req.body);
    if (!task) throw new AppError('Liste introuvable', 404, 'LIST_NOT_FOUND');
    return res.status(201).json({ success: true, message: 'Tâche ajoutée', data: { task } });
  } catch (error) { next(error); }
};

const listTasks = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { tasks, total } = await service.listTasks(req.user.id, {
      list_id: req.query.list_id || null,
      is_completed: parseBool(req.query.is_completed),
      due_before: req.query.due_before || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { tasks, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const getTask = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const task = await service.getTaskById(req.params.id, req.user.id);
    if (!task) throw new AppError('Tâche introuvable', 404, 'TASK_NOT_FOUND');
    return res.status(200).json({ success: true, data: { task } });
  } catch (error) { next(error); }
};

const updateTask = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const task = await service.updateTask(req.params.id, req.user.id, req.body);
    if (!task) throw new AppError('Tâche introuvable', 404, 'TASK_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Tâche mise à jour', data: { task } });
  } catch (error) { next(error); }
};

const deleteTask = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeleteTask(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Tâche introuvable', 404, 'TASK_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Tâche supprimée', data: {} });
  } catch (error) { next(error); }
};

// =========================================================================
//  Convertisseur
// =========================================================================

const listUnits = async (req, res, next) => {
  try {
    const categories = await service.listUnits();
    return res.status(200).json({ success: true, data: { categories } });
  } catch (error) { next(error); }
};

const convert = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.convert(req.user.id, req.body);
    if (result.code === 'UNIT_NOT_FOUND') throw new AppError('Unité introuvable', 404, 'UNIT_NOT_FOUND');
    if (result.code === 'CATEGORY_MISMATCH') {
      throw new AppError('Les deux unités doivent appartenir à la même catégorie', 400, 'CATEGORY_MISMATCH');
    }
    return res.status(200).json({ success: true, data: { conversion: result } });
  } catch (error) { next(error); }
};

const listConversionHistory = async (req, res, next) => {
  try {
    const history = await service.listConversionHistory(req.user.id);
    return res.status(200).json({ success: true, data: { history } });
  } catch (error) { next(error); }
};

module.exports = {
  createTithe, listTithes, getTithe, updateTithe, deleteTithe,
  createEvent, listEvents, getEvent, updateEvent, deleteEvent,
  createList, listLists, getList, updateList, deleteList, reorderTasks,
  createTask, listTasks, getTask, updateTask, deleteTask,
  listUnits, convert, listConversionHistory,
};
