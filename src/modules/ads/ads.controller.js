// src/modules/ads/ads.controller.js
// Contrôleur de l'espace publicitaire (module ads).

const adsService = require('./ads.service');
const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');

// Bandeau : annonces actives (tout utilisateur connecté).
const listActive = async (req, res, next) => {
  try {
    const ads = await adsService.listActive();
    return res.status(200).json({ success: true, data: { ads } });
  } catch (error) {
    next(error);
  }
};

// Administration : toutes les annonces (actives ou non).
const listAll = async (req, res, next) => {
  try {
    const ads = await adsService.listAll();
    return res.status(200).json({ success: true, data: { ads } });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const ad = await adsService.create(req.body);
    return res.status(201).json({ success: true, message: 'Publicité créée', data: { ad } });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const ad = await adsService.update(req.params.id, req.body);
    if (!ad) throw new AppError('Publicité introuvable', 404, 'AD_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Publicité mise à jour', data: { ad } });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await adsService.remove(req.params.id);
    if (!deleted) throw new AppError('Publicité introuvable', 404, 'AD_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Publicité supprimée', data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = { listActive, listAll, create, update, remove };
