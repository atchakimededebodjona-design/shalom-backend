// src/modules/uploads/uploads.routes.js

const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('./uploads.controller');
const { authenticate } = require('../auth/auth.middleware');
const { AppError } = require('../../middlewares/error.middleware');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 Mo

// Stockage en mémoire : on doit inspecter les octets avant de savoir si le
// fichier est accepté et quelle extension lui donner (cf. uploads.service.js).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

// Convertit les erreurs multer (taille dépassée, champ inattendu...) en
// AppError propre au lieu de laisser remonter une erreur 500 générique.
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Le fichier dépasse la taille maximale autorisée (50 Mo)', 400, 'FILE_TOO_LARGE'));
    }
    return next(new AppError(`Téléversement invalide : ${err.message}`, 400, 'UPLOAD_ERROR'));
  });
};

router.post('/', authenticate, handleUpload, controller.uploadFile);
router.get('/usage', authenticate, controller.getUsage);

module.exports = router;
