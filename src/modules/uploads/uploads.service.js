// src/modules/uploads/uploads.service.js
// Sauvegarde d'un fichier téléversé après validation de son type réel.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../../middlewares/error.middleware');
const { identifier } = require('./file-signature');
const env = require('../../config/env');
const { query } = require('../../config/db');

const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

/**
 * Usage cumulé (en octets) des téléversements d'un utilisateur via ce module.
 * @param {string} userId
 * @returns {Promise<number>}
 */
const getUsageBytes = async (userId) => {
  const result = await query(
    `SELECT COALESCE(SUM(size), 0)::bigint AS total FROM uploads WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0].total, 10);
};

/**
 * Valide et enregistre un fichier téléversé sur disque, dans la limite du
 * quota de stockage par utilisateur (env.UPLOAD_QUOTA_BYTES).
 * @param {string} userId - UUID de l'utilisateur authentifié (propriétaire)
 * @param {Buffer} buffer - contenu complet du fichier (fourni par multer, mémoire)
 * @returns {{url: string, mime: string, size: number}}
 */
const saveUpload = async (userId, buffer) => {
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

  const usedBytes = await getUsageBytes(userId);
  if (usedBytes + buffer.length > env.UPLOAD_QUOTA_BYTES) {
    const quotaMb = Math.floor(env.UPLOAD_QUOTA_BYTES / (1024 * 1024));
    throw new AppError(
      `Quota de stockage dépassé (${quotaMb} Mo maximum par compte)`,
      413,
      'UPLOAD_QUOTA_EXCEEDED'
    );
  }

  ensureUploadsDir();

  // Nom aléatoire — jamais le nom fourni par le client (traversée de chemin,
  // collisions, informations non désirées) — extension dérivée du type détecté.
  const filename = `${crypto.randomUUID()}${detected.ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  await query(
    `INSERT INTO uploads (user_id, filename, mime, size) VALUES ($1, $2, $3, $4)`,
    [userId, filename, detected.mime, buffer.length]
  );

  return { url: `${env.PUBLIC_URL}/uploads/${filename}`, mime: detected.mime, size: buffer.length };
};

module.exports = { saveUpload, getUsageBytes };
