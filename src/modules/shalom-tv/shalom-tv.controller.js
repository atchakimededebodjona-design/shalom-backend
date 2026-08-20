const service = require('./shalom-tv.service');
const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');
const env = require('../../config/env');
const { isAdminEmail } = require('../../utils/admin');

// =========================================================================
// 1. Lister les contenus (Public / Filtré)
// =========================================================================

const listContents = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    // Seul un admin peut voir les non-publiés. Par défaut, on force is_published = true pour les utilisateurs.
    if (!req.user || !isAdminEmail(req.user.email)) {
      req.query.is_published = true;
    }

    const result = await service.getContents(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 2. Récupérer un contenu spécifique
// =========================================================================

const getContent = async (req, res, next) => {
  try {
    const contentId = req.params.id;
    const content = await service.getContentById(contentId);

    // Vérifier si publié (sauf si admin)
    if (!content.is_published && (!req.user || !isAdminEmail(req.user.email))) {
      throw new AppError('Contenu non disponible', 403);
    }

    return res.status(200).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 3. Créer un contenu (Admin)
// =========================================================================

const createContent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const data = { ...req.body };

    // Si des fichiers ont été uploadés (media, thumbnail)
    if (req.files) {
      if (req.files['media']) {
        data.media_url = `${env.PUBLIC_URL}/uploads/shalom-tv/${req.files['media'][0].filename}`;
      }
      if (req.files['thumbnail']) {
        data.thumbnail_url = `${env.PUBLIC_URL}/uploads/shalom-tv/${req.files['thumbnail'][0].filename}`;
      }
    }

    const content = await service.createContent(data);
    return res.status(201).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 4. Mettre à jour un contenu (Admin)
// =========================================================================

const updateContent = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const contentId = req.params.id;
    
    const data = { ...req.body };

    // Si de nouveaux fichiers ont été uploadés
    if (req.files) {
      if (req.files['media']) {
        data.media_url = `${env.PUBLIC_URL}/uploads/shalom-tv/${req.files['media'][0].filename}`;
      }
      if (req.files['thumbnail']) {
        data.thumbnail_url = `${env.PUBLIC_URL}/uploads/shalom-tv/${req.files['thumbnail'][0].filename}`;
      }
    }

    const content = await service.updateContent(contentId, data);
    return res.status(200).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 5. Supprimer un contenu (Admin)
// =========================================================================

const deleteContent = async (req, res, next) => {
  try {
    const contentId = req.params.id;
    await service.deleteContent(contentId);
    return res.status(200).json({ success: true, message: 'Contenu supprimé avec succès' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listContents,
  getContent,
  createContent,
  updateContent,
  deleteContent
};
