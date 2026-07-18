// src/modules/uploads/uploads.service.js
// Sauvegarde d'un fichier téléversé après validation de son type réel.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../../middlewares/error.middleware');
const { identifier } = require('./file-signature');
const env = require('../../config/env');

const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

/**
 * Valide et enregistre un fichier téléversé sur disque.
 * @param {Buffer} buffer - contenu complet du fichier (fourni par multer, mémoire)
 * @returns {{url: string, mime: string, size: number}}
 */
const saveUpload = (buffer) => {
  if (!buffer || buffer.length === 0) {
    throw new AppError('Aucun fichier fourni', 400, 'NO_FILE');
  }

  const detected = identifier(buffer);
  if (!detected) {
    throw new AppError(
      'Type de fichier non supporté (PNG, JPEG, GIF, WEBP, MP4, MOV, WEBM uniquement)',
      400,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  ensureUploadsDir();

  // Nom aléatoire — jamais le nom fourni par le client (traversée de chemin,
  // collisions, informations non désirées) — extension dérivée du type détecté.
  const filename = `${crypto.randomUUID()}${detected.ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  return { url: `${env.PUBLIC_URL}/uploads/${filename}`, mime: detected.mime, size: buffer.length };
};

module.exports = { saveUpload };
