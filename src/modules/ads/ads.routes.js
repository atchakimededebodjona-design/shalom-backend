const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./ads.controller');
const validator = require('./ads.validator');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { AppError } = require('../../middlewares/error.middleware');
const { identifier } = require('../uploads/file-signature');

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

// Ne fait pas confiance à `file.originalname`/`mimetype` (contrôlés par le
// client) pour accepter le fichier : comme le module uploads générique et
// shalom-tv, on relit les premiers octets déjà écrits sur disque pour
// vérifier la signature binaire réelle, et on rejette tout ce qui n'est pas
// une image reconnue (le champ 'image' des pubs n'accepte pas de vidéo/audio).
// Le nom sur disque est renommé pour correspondre à l'extension réelle.
const validateUploadedImage = (req, res, next) => {
  const file = req.files?.image?.[0];
  if (!file) return next();

  try {
    const fd = fs.openSync(file.path, 'r');
    const header = Buffer.alloc(32);
    const bytesRead = fs.readSync(fd, header, 0, 32, 0);
    fs.closeSync(fd);

    const detected = identifier(header.subarray(0, bytesRead));
    if (!detected || !detected.mime.startsWith('image/')) {
      fs.unlink(file.path, () => {});
      return next(new AppError(
        "Type d'image non supporté (PNG, JPEG, GIF, WEBP uniquement)",
        400,
        'UNSUPPORTED_FILE_TYPE'
      ));
    }

    const baseName = path.basename(file.path, path.extname(file.path));
    const newPath = path.join(path.dirname(file.path), baseName + detected.ext);
    fs.renameSync(file.path, newPath);
    file.path = newPath;
    file.filename = path.basename(newPath);
    file.mimetype = detected.mime;
    next();
  } catch (error) {
    fs.unlink(file.path, () => {});
    next(error);
  }
};

// --- Routes Publiques (Utilisateurs connectés) ---
router.get('/', authenticate, validator.listAdsValidator, controller.listAds);

// --- Routes Admin (déclarées avant `/:id` générique pour éviter tout conflit) ---
router.get('/manage', authenticate, requireAdmin, controller.adminListAds);
router.get('/:id/reports', authenticate, requireAdmin, controller.adminGetAdReports);

router.get('/:id', authenticate, controller.getAd);
router.post('/:id/report', authenticate, validator.reportAdValidator, controller.reportAd);

router.post('/', authenticate, requireAdmin, handleUpload, validateUploadedImage, validator.createAdValidator, controller.createAd);
router.put('/:id', authenticate, requireAdmin, handleUpload, validateUploadedImage, validator.updateAdValidator, controller.updateAd);
router.patch('/:id', authenticate, requireAdmin, handleUpload, validateUploadedImage, validator.updateAdValidator, controller.updateAd);
router.delete('/:id', authenticate, requireAdmin, controller.deleteAd);

module.exports = router;
