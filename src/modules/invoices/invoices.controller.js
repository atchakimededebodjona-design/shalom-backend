// src/modules/invoices/invoices.controller.js
// Contrôleur du module Facturation (Reçu+).

const invoicesService = require('./invoices.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

const create = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const invoice = await invoicesService.create(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Facture créée', data: { invoice } });
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { invoices, total } = await invoicesService.list(req.user.id, {
      status: req.query.status || null,
      client_id: req.query.client_id || null,
      from: req.query.from || null,
      to: req.query.to || null,
      limit,
      offset,
    });
    return res.status(200).json({
      success: true,
      data: { invoices, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const invoice = await invoicesService.getById(req.params.id, req.user.id);
    if (!invoice) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    return res.status(200).json({ success: true, data: { invoice } });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const invoice = await invoicesService.update(req.params.id, req.user.id, req.body);
    if (!invoice) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Facture mise à jour', data: { invoice } });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await invoicesService.softDelete(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Facture supprimée', data: {} });
  } catch (error) {
    next(error);
  }
};

const addPayment = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    // Enregistre le reçu et crédite le portefeuille SHALOM (même transaction).
    await invoicesService.recordPayment(req.params.id, req.user.id, req.body);
    const invoice = await invoicesService.getById(req.params.id, req.user.id);
    return res.status(201).json({
      success: true,
      message: 'Paiement enregistré et portefeuille crédité',
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

const listPayments = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const payments = await invoicesService.listPayments(req.params.id, req.user.id);
    if (payments === null) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    return res.status(200).json({ success: true, data: { payments } });
  } catch (error) {
    next(error);
  }
};

const overview = async (req, res, next) => {
  try {
    const data = await invoicesService.overview(req.user.id);
    return res.status(200).json({ success: true, data: { overview: data } });
  } catch (error) {
    next(error);
  }
};

module.exports = { create, list, getOne, update, remove, addPayment, listPayments, overview };
