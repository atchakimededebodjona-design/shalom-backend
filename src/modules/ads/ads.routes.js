const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./ads.controller');
const validator = require('./ads.validator');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { AppError } = require('../../middlewares/error.middleware');

const router = Router();

// Configuration Multer pour l'image de la publicité - Directement sur disque
const adsUploadsDir = path.join(__dirname, '../../../uploads/ads');
if (!fs.existsSync(adsUploadsDir)) {
  fs.mkdirSync(adsUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, adsUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

const cpUpload = upload.fields([{ name: 'image', maxCount: 1 }]);

const handleUpload = (req, res, next) => {
  cpUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Le fichier dépasse la taille maximale (5 MB)', 400));
      }
      return next(new AppError(`Erreur d'upload : ${err.message}`, 400));
    }
    next();
  });
};

// --- Routes Publiques (Utilisateurs connectés) ---
router.get('/', authenticate, validator.listAdsValidator, controller.listAds);

// --- Routes Admin (déclarées avant `/:id` générique pour éviter tout conflit) ---
router.get('/manage', authenticate, requireAdmin, controller.adminListAds);
router.get('/:id/reports', authenticate, requireAdmin, controller.adminGetAdReports);

router.get('/:id', authenticate, controller.getAd);
router.post('/:id/report', authenticate, validator.reportAdValidator, controller.reportAd);

router.post('/', authenticate, requireAdmin, handleUpload, validator.createAdValidator, controller.createAd);
router.put('/:id', authenticate, requireAdmin, handleUpload, validator.updateAdValidator, controller.updateAd);
router.patch('/:id', authenticate, requireAdmin, handleUpload, validator.updateAdValidator, controller.updateAd);
router.delete('/:id', authenticate, requireAdmin, controller.deleteAd);

module.exports = router;
