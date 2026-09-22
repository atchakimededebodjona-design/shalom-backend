// src/modules/uploads/uploads.controller.js

const uploadsService = require('./uploads.service');
const { AppError } = require('../../middlewares/error.middleware');
const env = require('../../config/env');

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('Aucun fichier fourni (champ multipart attendu : "file")', 400, 'NO_FILE');
    }
    const result = await uploadsService.saveUpload(req.user.id, req.file.buffer);
    return res.status(201).json({ success: true, message: 'Fichier téléversé avec succès', data: result });
  } catch (error) {
    next(error);
  }
};

const getUsage = async (req, res, next) => {
  try {
    const usedBytes = await uploadsService.getUsageBytes(req.user.id);
    return res.status(200).json({
      success: true,
      data: {
        used_bytes: usedBytes,
        quota_bytes: env.UPLOAD_QUOTA_BYTES,
        remaining_bytes: Math.max(env.UPLOAD_QUOTA_BYTES - usedBytes, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFile, getUsage };
