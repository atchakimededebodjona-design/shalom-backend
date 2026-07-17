// src/modules/community/community.controller.js
// Contrôleur du module Outils communautaires.

const service = require('./community.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');
const { isAdminEmail } = require('../../utils/admin');

// =========================================================================
//  Événements
// =========================================================================

const createEvent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.createEvent(req.user.id, req.body);
    if (result.code === 'NOT_A_MEMBER') {
      throw new AppError("Vous devez être membre du groupe pour y créer un événement", 403, 'NOT_A_MEMBER');
    }
    return res.status(201).json({ success: true, message: 'Événement créé', data: { event: result } });
  } catch (error) { next(error); }
};

const listEvents = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { events, total } = await service.listEvents(req.user.id, {
      event_type: req.query.event_type || null,
      status: req.query.status || null,
      group_id: req.query.group_id || null,
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
    if (!event) {
      throw new AppError("Événement introuvable ou vous n'en êtes pas l'organisateur", 404, 'EVENT_NOT_FOUND');
    }
    return res.status(200).json({ success: true, message: 'Événement mis à jour', data: { event } });
  } catch (error) { next(error); }
};

const deleteEvent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeleteEvent(req.params.id, req.user.id);
    if (!deleted) {
      throw new AppError("Événement introuvable ou vous n'en êtes pas l'organisateur", 404, 'EVENT_NOT_FOUND');
    }
    return res.status(200).json({ success: true, message: 'Événement supprimé', data: {} });
  } catch (error) { next(error); }
};

const register = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.registerToEvent(req.params.id, req.user.id);
    if (result.code === 'EVENT_NOT_FOUND') throw new AppError('Événement introuvable', 404, 'EVENT_NOT_FOUND');
    if (result.code === 'EVENT_CANCELLED') throw new AppError('Cet événement est annulé', 409, 'EVENT_CANCELLED');
    if (result.code === 'EVENT_FULL') throw new AppError('Cet événement est complet', 409, 'EVENT_FULL');
    return res.status(201).json({ success: true, message: 'Inscription enregistrée', data: { registration: result } });
  } catch (error) { next(error); }
};

const unregister = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const cancelled = await service.cancelRegistration(req.params.id, req.user.id);
    if (!cancelled) throw new AppError('Inscription introuvable', 404, 'REGISTRATION_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Inscription annulée', data: {} });
  } catch (error) { next(error); }
};

const listRegistrations = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const registrations = await service.listRegistrations(req.params.id, req.user.id);
    if (!registrations) {
      throw new AppError("Événement introuvable ou vous n'en êtes pas l'organisateur", 404, 'EVENT_NOT_FOUND');
    }
    return res.status(200).json({ success: true, data: { registrations } });
  } catch (error) { next(error); }
};

// =========================================================================
//  Demandes de prière partagées
// =========================================================================

const createPrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.createSharedPrayer(req.user.id, req.body);
    if (result.code === 'GROUP_REQUIRED') {
      throw new AppError("Un groupe est requis pour une demande à visibilité 'group'", 400, 'GROUP_REQUIRED');
    }
    if (result.code === 'NOT_A_MEMBER') {
      throw new AppError('Vous devez être membre du groupe pour y partager une demande', 403, 'NOT_A_MEMBER');
    }
    return res.status(201).json({ success: true, message: 'Demande partagée', data: { prayer: result } });
  } catch (error) { next(error); }
};

const listPrayers = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { prayers, total } = await service.listSharedPrayers(req.user.id, {
      visibility: req.query.visibility || null,
      status: req.query.status || null,
      group_id: req.query.group_id || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { prayers, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const getPrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const prayer = await service.getSharedPrayerById(req.params.id, req.user.id);
    if (!prayer) throw new AppError('Demande introuvable', 404, 'PRAYER_NOT_FOUND');
    return res.status(200).json({ success: true, data: { prayer } });
  } catch (error) { next(error); }
};

const updatePrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const prayer = await service.updateSharedPrayer(req.params.id, req.user.id, req.body);
    if (!prayer) throw new AppError("Demande introuvable ou vous n'en êtes pas l'auteur", 404, 'PRAYER_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Demande mise à jour', data: { prayer } });
  } catch (error) { next(error); }
};

const deletePrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeleteSharedPrayer(req.params.id, req.user.id);
    if (!deleted) throw new AppError("Demande introuvable ou vous n'en êtes pas l'auteur", 404, 'PRAYER_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Demande supprimée', data: {} });
  } catch (error) { next(error); }
};

const support = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.supportPrayer(req.params.id, req.user.id);
    if (result.code === 'PRAYER_NOT_FOUND') throw new AppError('Demande introuvable', 404, 'PRAYER_NOT_FOUND');
    return res.status(200).json({
      success: true,
      message: result.already_supported ? 'Vous priez déjà pour cette demande' : 'Merci de prier 🙏',
      data: result,
    });
  } catch (error) { next(error); }
};

const unsupport = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.unsupportPrayer(req.params.id, req.user.id);
    return res.status(200).json({ success: true, message: 'Soutien retiré', data: result });
  } catch (error) { next(error); }
};

// =========================================================================
//  Annonces
// =========================================================================

const createAnnouncement = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    // Une annonce globale (sans groupe) est diffusée à toute la communauté :
    // réservée aux administrateurs. Une annonce de groupe exige d'en être
    // admin ou modérateur (vérifié dans le service).
    if (!req.body.group_id && !isAdminEmail(req.user.email)) {
      throw new AppError('Seul un administrateur peut publier une annonce globale', 403, 'FORBIDDEN_ADMIN_ONLY');
    }
    const result = await service.createAnnouncement(req.user.id, req.body);
    if (result.code === 'NOT_GROUP_MANAGER') {
      throw new AppError("Vous devez être admin ou modérateur du groupe pour y publier une annonce", 403, 'NOT_GROUP_MANAGER');
    }
    return res.status(201).json({ success: true, message: 'Annonce publiée', data: { announcement: result } });
  } catch (error) { next(error); }
};

const listAnnouncements = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { announcements, total } = await service.listAnnouncements(req.user.id, {
      group_id: req.query.group_id || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { announcements, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const updateAnnouncement = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const announcement = await service.updateAnnouncement(req.params.id, req.user.id, req.body);
    if (!announcement) throw new AppError("Annonce introuvable ou vous n'en êtes pas l'auteur", 404, 'ANNOUNCEMENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Annonce mise à jour', data: { announcement } });
  } catch (error) { next(error); }
};

const deleteAnnouncement = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeleteAnnouncement(req.params.id, req.user.id);
    if (!deleted) throw new AppError("Annonce introuvable ou vous n'en êtes pas l'auteur", 404, 'ANNOUNCEMENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Annonce supprimée', data: {} });
  } catch (error) { next(error); }
};

module.exports = {
  createEvent, listEvents, getEvent, updateEvent, deleteEvent,
  register, unregister, listRegistrations,
  createPrayer, listPrayers, getPrayer, updatePrayer, deletePrayer, support, unsupport,
  createAnnouncement, listAnnouncements, updateAnnouncement, deleteAnnouncement,
};
