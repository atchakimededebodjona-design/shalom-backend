const service = require('./conseillers.service');
const { hasValidationErrors } = require('../../utils/validate');

// =========================================================================
// 1. Lister les conseillers
// =========================================================================

const listConseillers = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.getConseillers(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 2. Obtenir un conseiller
// =========================================================================

const getConseiller = async (req, res, next) => {
  try {
    const conseiller = await service.getConseillerById(req.params.id);
    return res.status(200).json({ success: true, data: conseiller });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 3. Créer un conseiller
// =========================================================================

const createConseiller = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const conseiller = await service.createConseiller(req.body);
    return res.status(201).json({ success: true, data: conseiller });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 4. Mettre à jour un conseiller
// =========================================================================

const updateConseiller = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const conseiller = await service.updateConseiller(req.params.id, req.body);
    return res.status(200).json({ success: true, data: conseiller });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 5. Supprimer un conseiller
// =========================================================================

const deleteConseiller = async (req, res, next) => {
  try {
    await service.deleteConseiller(req.params.id);
    return res.status(200).json({ success: true, message: 'Conseiller supprimé avec succès' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listConseillers,
  getConseiller,
  createConseiller,
  updateConseiller,
  deleteConseiller,
};
