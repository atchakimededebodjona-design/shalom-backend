const { validationResult } = require('express-validator');
const reportsService = require('./reports.service');

exports.createReport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array(), code: 'VALIDATION_ERROR' });
  }

  try {
    const report = await reportsService.createReport(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: { report },
      message: "Signalement enregistré avec succès"
    });
  } catch (err) {
    if (err.code === 'REPORT_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, error: err.message, code: err.code });
    }
    console.error('createReport error:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la création du signalement", code: "INTERNAL_ERROR" });
  }
};

exports.getReports = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array(), code: 'VALIDATION_ERROR' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status || 'en_attente'
    };

    const data = await reportsService.getReports(filters, page, limit);
    res.json({
      success: true,
      data,
      message: "Signalements récupérés avec succès"
    });
  } catch (err) {
    console.error('getReports error:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des signalements", code: "INTERNAL_ERROR" });
  }
};

exports.updateReport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array(), code: 'VALIDATION_ERROR' });
  }

  try {
    const reportId = req.params.id;
    const { status, apply_action } = req.body;
    const adminId = req.user.id;

    const report = await reportsService.updateReportStatus(reportId, status, apply_action || false, adminId);
    res.json({
      success: true,
      data: { report },
      message: "Signalement mis à jour avec succès"
    });
  } catch (err) {
    if (err.code === 'REPORT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: err.message, code: err.code });
    }
    console.error('updateReport error:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour du signalement", code: "INTERNAL_ERROR" });
  }
};
