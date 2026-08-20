const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./shalom-tv.controller');
const validator = require('./shalom-tv.validator');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { AppError } = require('../../middlewares/error.middleware');
const { identifier } = require('../uploads/file-signature');

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

// Le fichier est déjà entièrement écrit sur disque à ce stade (diskStorage,
// nécessaire pour les vidéos jusqu'à 1 Go — pas de buffering en mémoire).
// On ne relit que les premiers octets pour vérifier la signature binaire
// réelle, comme le fait le module uploads générique pour les fichiers plus
// petits qu'il garde en mémoire. Toute extension trompeuse est ignorée : le
// nom sur disque est renommé pour correspondre au type détecté.
const validateUploadedMedia = (req, res, next) => {
  const files = [
    ...(req.files?.media || []),
    ...(req.files?.thumbnail || []),
  ];

  const cleanup = () => {
    for (const file of files) {
      fs.unlink(file.path, () => {});
    }
  };

  try {
    for (const file of files) {
      const fd = fs.openSync(file.path, 'r');
      const header = Buffer.alloc(32);
      const bytesRead = fs.readSync(fd, header, 0, 32, 0);
      fs.closeSync(fd);

      const detected = identifier(header.subarray(0, bytesRead));
      if (!detected) {
        cleanup();
        return next(new AppError(
          'Type de fichier non supporté (image, vidéo ou audio invalide)',
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
    }
    next();
  } catch (error) {
    cleanup();
    next(error);
  }
};

const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');

// --- Routes Publiques (Abonnés) ---
// SHALOM TV est réservé aux abonnés (ou en essai gratuit).
router.get('/', authenticate, requireActiveSubscription, validator.listContentsValidator, controller.listContents);
router.get('/:id', authenticate, requireActiveSubscription, controller.getContent);

// --- Routes Admin ---
router.post('/', authenticate, requireAdmin, handleUpload, validateUploadedMedia, validator.createContentValidator, controller.createContent);
router.put('/:id', authenticate, requireAdmin, handleUpload, validateUploadedMedia, validator.updateContentValidator, controller.updateContent);
router.delete('/:id', authenticate, requireAdmin, controller.deleteContent);

module.exports = router;
