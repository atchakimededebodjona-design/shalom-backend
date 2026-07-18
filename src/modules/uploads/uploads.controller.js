// src/modules/uploads/uploads.controller.js

const uploadsService = require('./uploads.service');
const { AppError } = require('../../middlewares/error.middleware');

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('Aucun fichier fourni (champ multipart attendu : "file")', 400, 'NO_FILE');
    }
    const result = uploadsService.saveUpload(req.file.buffer);
    return res.status(201).json({ success: true, message: 'Fichier téléversé avec succès', data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFile };
