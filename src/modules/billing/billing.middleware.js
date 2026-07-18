// src/modules/billing/billing.middleware.js
// Résout l'entreprise Reçu+ de l'utilisateur connecté et l'attache à req.business.
// À utiliser sur toutes les routes clients/factures/paiements (après authenticate).

const { AppError } = require('../../middlewares/error.middleware');
const billingService = require('./billing.service');

const requireBusiness = async (req, _res, next) => {
  try {
    const business = await billingService.getBusinessByUserId(req.user.id);
    if (!business) {
      throw new AppError(
        "Aucune entreprise enregistrée. Créez-la d'abord via POST /api/v1/billing/businesses",
        404,
        'BUSINESS_NOT_FOUND'
      );
    }
    req.business = business;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireBusiness };
