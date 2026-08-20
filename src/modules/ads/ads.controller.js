const service = require('./ads.service');
const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');
const env = require('../../config/env');
const { isAdminEmail } = require('../../utils/admin');

// =========================================================================
// 1. Lister les publicités (Public filtré / Admin)
// =========================================================================

const listAds = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    // Seul un admin peut voir les publicités inactives. Les autres utilisateurs
    // ne voient que l'espace publicitaire réellement affiché sur le fil d'actualité.
    if (!req.user || !isAdminEmail(req.user.email)) {
      req.query.is_active = true;
    }

    const result = await service.getAds(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 2. Récupérer une publicité spécifique
// =========================================================================

const getAd = async (req, res, next) => {
  try {
    const adId = req.params.id;
    const ad = await service.getAdById(adId);

    if (!ad.is_active && (!req.user || !isAdminEmail(req.user.email))) {
      throw new AppError('Publicité non disponible', 403);
    }

    return res.status(200).json({ success: true, data: ad });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 3. Créer une publicité (Admin)
// =========================================================================

const createAd = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const data = { ...req.body };

    if (req.files && req.files['image']) {
      data.image_url = `${env.PUBLIC_URL}/uploads/ads/${req.files['image'][0].filename}`;
    }

    if (!data.image_url) {
      throw new AppError("L'image de la publicité est requise", 400);
    }

    const ad = await service.createAd(data);
    return res.status(201).json({ success: true, data: ad });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 4. Mettre à jour une publicité (Admin)
// =========================================================================

const updateAd = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const adId = req.params.id;

    const data = { ...req.body };

    if (req.files && req.files['image']) {
      data.image_url = `${env.PUBLIC_URL}/uploads/ads/${req.files['image'][0].filename}`;
    }

    const ad = await service.updateAd(adId, data);
    return res.status(200).json({ success: true, data: ad });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 5. Supprimer une publicité (Admin)
// =========================================================================

const deleteAd = async (req, res, next) => {
  try {
    const adId = req.params.id;
    await service.deleteAd(adId);
    return res.status(200).json({ success: true, message: 'Publicité supprimée avec succès' });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 6. Lister les publicités pour l'admin (toutes + compte de signalements)
// =========================================================================

const adminListAds = async (req, res, next) => {
  try {
    const result = await service.getAdsForAdmin();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 7. Signaler une publicité (utilisateur connecté)
// =========================================================================

const reportAd = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    await service.reportAd(req.params.id, req.user.id, req.body.reason);
    return res.status(200).json({ success: true, message: 'Publicité signalée, merci.' });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 8. Lister les signalements d'une publicité (admin)
// =========================================================================

const adminGetAdReports = async (req, res, next) => {
  try {
    const result = await service.getAdReports(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listAds,
  getAd,
  createAd,
  updateAd,
  deleteAd,
  adminListAds,
  reportAd,
  adminGetAdReports
};
