// src/modules/businesses/businesses.controller.js
// Contrôleur du profil « entreprise émettrice » (module Reçu+).
// Une entreprise par membre. Le front s'appuie sur le code BUSINESS_NOT_FOUND
// pour afficher l'écran de création.

const businessesService = require('./businesses.service');
const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');

const getMine = async (req, res, next) => {
  try {
    const business = await businessesService.getByUser(req.user.id);
    if (!business) throw new AppError('Aucune entreprise déclarée', 404, 'BUSINESS_NOT_FOUND');
    return res.status(200).json({ success: true, data: { business } });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const existing = await businessesService.getByUser(req.user.id);
    if (existing) throw new AppError('Une entreprise existe déjà pour ce compte', 409, 'BUSINESS_EXISTS');
    const business = await businessesService.create(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Entreprise créée', data: { business } });
  } catch (error) {
    next(error);
  }
};

const updateMine = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const business = await businessesService.updateByUser(req.user.id, req.body);
    if (!business) throw new AppError('Aucune entreprise déclarée', 404, 'BUSINESS_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Entreprise mise à jour', data: { business } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMine, create, updateMine };
