// src/modules/billing/billing.controller.js

const billingService = require('./billing.service');
const { AppError } = require('../../middlewares/error.middleware');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');

// --- Entreprise ---

const createBusiness = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const business = await billingService.createBusiness(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Entreprise créée avec succès', data: { business } });
  } catch (error) {
    next(error);
  }
};

const getMyBusiness = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: { business: req.business } });
  } catch (error) {
    next(error);
  }
};

const updateMyBusiness = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const business = await billingService.updateBusiness(req.user.id, req.body);
    return res.status(200).json({ success: true, message: 'Entreprise mise à jour', data: { business } });
  } catch (error) {
    next(error);
  }
};

// --- Clients ---

const createClient = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const client = await billingService.createClient(req.business.id, req.body);
    return res.status(201).json({ success: true, message: 'Client créé avec succès', data: { client } });
  } catch (error) {
    next(error);
  }
};

const listClients = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { clients, total } = await billingService.listClients(req.business.id, { page, limit, offset });
    return res.status(200).json({
      success: true,
      data: { clients, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

const updateClient = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const client = await billingService.updateClient(req.business.id, req.params.id, req.body);
    if (!client) throw new AppError('Client introuvable', 404, 'CLIENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Client mis à jour', data: { client } });
  } catch (error) {
    next(error);
  }
};

const deleteClient = async (req, res, next) => {
  try {
    const deleted = await billingService.deleteClient(req.business.id, req.params.id);
    if (!deleted) throw new AppError('Client introuvable', 404, 'CLIENT_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Client supprimé', data: {} });
  } catch (error) {
    next(error);
  }
};

// --- Factures ---

const createInvoice = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const invoice = await billingService.createInvoice(req.business, req.body);
    return res.status(201).json({ success: true, message: 'Facture créée avec succès', data: { invoice } });
  } catch (error) {
    next(error);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await billingService.getInvoiceById(req.business.id, req.params.id);
    if (!invoice) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    return res.status(200).json({ success: true, data: { invoice } });
  } catch (error) {
    next(error);
  }
};

const listInvoices = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { invoices, total } = await billingService.listInvoices(req.business.id, {
      page, limit, offset, status: req.query.status,
    });
    return res.status(200).json({
      success: true,
      data: { invoices, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const invoice = await billingService.updateInvoice(req.business.id, req.params.id, req.body);
    return res.status(200).json({ success: true, message: 'Facture mise à jour', data: { invoice } });
  } catch (error) {
    next(error);
  }
};

const deleteInvoice = async (req, res, next) => {
  try {
    const deleted = await billingService.deleteInvoice(req.business.id, req.params.id);
    if (!deleted) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Facture supprimée', data: {} });
  } catch (error) {
    next(error);
  }
};

// --- Paiements ---

const createPayment = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const payment = await billingService.createPayment(req.business, req.params.id, req.body);
    return res.status(201).json({ success: true, message: 'Paiement enregistré avec succès', data: { payment } });
  } catch (error) {
    next(error);
  }
};

const listPaymentsByInvoice = async (req, res, next) => {
  try {
    const payments = await billingService.listPaymentsByInvoice(req.business.id, req.params.id);
    return res.status(200).json({ success: true, data: { payments } });
  } catch (error) {
    next(error);
  }
};

const deletePayment = async (req, res, next) => {
  try {
    await billingService.deletePayment(req.business, req.params.paymentId);
    return res.status(200).json({ success: true, message: 'Paiement annulé', data: {} });
  } catch (error) {
    next(error);
  }
};

// --- Impression & partage WhatsApp ---

const printInvoice = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const full = await billingService.getInvoiceForPrint(req.business.id, req.params.id);
    if (!full) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(billingService.renderInvoiceHtml(full));
  } catch (error) {
    next(error);
  }
};

const printInvoicePublic = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const full = await billingService.getInvoiceByShareToken(req.params.token);
    if (!full) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(billingService.renderInvoiceHtml(full));
  } catch (error) {
    next(error);
  }
};

const getWhatsappLink = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const full = await billingService.getInvoiceForPrint(req.business.id, req.params.id);
    if (!full) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    const publicUrl = `${req.protocol}://${req.get('host')}/api/v1/billing/public/invoices/${full.invoice.share_token}`;
    const whatsapp_url = billingService.buildWhatsappLink(full, publicUrl);
    return res.status(200).json({ success: true, data: { whatsapp_url, public_url: publicUrl } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBusiness,
  getMyBusiness,
  updateMyBusiness,
  createClient,
  listClients,
  updateClient,
  deleteClient,
  createInvoice,
  getInvoiceById,
  listInvoices,
  updateInvoice,
  deleteInvoice,
  createPayment,
  listPaymentsByInvoice,
  deletePayment,
  printInvoice,
  printInvoicePublic,
  getWhatsappLink,
};
