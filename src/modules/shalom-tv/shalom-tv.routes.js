const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./shalom-tv.controller');
const validator = require('./shalom-tv.validator');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { AppError } = require('../../middlewares/error.middleware');

const router = Router();

// Configuration Multer pour les fichiers volumineux (vidéos, audios) - Directement sur disque
const tvUploadsDir = path.join(__dirname, '../../../uploads/shalom-tv');
if (!fs.existsSync(tvUploadsDir)) {
  fs.mkdirSync(tvUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tvUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1 GB max
});

const cpUpload = upload.fields([
  { name: 'media', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

const handleUpload = (req, res, next) => {
  cpUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Le fichier dépasse la taille maximale (1 GB)', 400));
      }
      return next(new AppError(`Erreur d'upload : ${err.message}`, 400));
    }
    next();
  });
};

const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');

// --- Routes Publiques (Abonnés) ---
// SHALOM TV est réservé aux abonnés (ou en essai gratuit).
router.get('/', authenticate, requireActiveSubscription, validator.listContentsValidator, controller.listContents);
router.get('/:id', authenticate, requireActiveSubscription, controller.getContent);

// --- Routes Admin ---
router.post('/', authenticate, requireAdmin, handleUpload, validator.createContentValidator, controller.createContent);
router.put('/:id', authenticate, requireAdmin, handleUpload, validator.updateContentValidator, controller.updateContent);
router.delete('/:id', authenticate, requireAdmin, controller.deleteContent);

module.exports = router;
