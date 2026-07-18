// src/modules/billing/billing.routes.js
// Module Facturation « Reçu+ » — voir API_ROUTES.md section 18.

const express = require('express');
const router = express.Router();
const controller = require('./billing.controller');
const { authenticate } = require('../auth/auth.middleware');
const { requireBusiness } = require('./billing.middleware');
const v = require('./billing.validator');

// --- Consultation/impression publique (déclarée avant authenticate : le
//     share_token est le secret qui autorise l'accès, pas de JWT requis) ---
router.get('/public/invoices/:token', v.tokenParamValidator, controller.printInvoicePublic);

router.use(authenticate);

// --- Entreprise ---
router.post('/businesses', v.createBusinessValidator, controller.createBusiness);
router.get('/businesses/me', requireBusiness, controller.getMyBusiness);
router.patch('/businesses/me', requireBusiness, v.updateBusinessValidator, controller.updateMyBusiness);

// --- Clients ---
router.post('/clients', requireBusiness, v.createClientValidator, controller.createClient);
router.get('/clients', requireBusiness, v.listClientsValidator, controller.listClients);
router.patch('/clients/:id', requireBusiness, v.idParamValidator, v.updateClientValidator, controller.updateClient);
router.delete('/clients/:id', requireBusiness, v.idParamValidator, controller.deleteClient);

// --- Factures ---
router.post('/invoices', requireBusiness, v.createInvoiceValidator, controller.createInvoice);
router.get('/invoices', requireBusiness, v.listInvoicesValidator, controller.listInvoices);
router.get('/invoices/:id', requireBusiness, v.idParamValidator, controller.getInvoiceById);
router.get('/invoices/:id/print', requireBusiness, v.idParamValidator, controller.printInvoice);
router.get('/invoices/:id/whatsapp-link', requireBusiness, v.idParamValidator, controller.getWhatsappLink);
router.patch('/invoices/:id', requireBusiness, v.idParamValidator, v.updateInvoiceValidator, controller.updateInvoice);
router.delete('/invoices/:id', requireBusiness, v.idParamValidator, controller.deleteInvoice);

// --- Paiements (crédite le wallet SHALOM du propriétaire à chaque paiement) ---
router.post('/invoices/:id/payments', requireBusiness, v.idParamValidator, v.createPaymentValidator, controller.createPayment);
router.get('/invoices/:id/payments', requireBusiness, v.idParamValidator, controller.listPaymentsByInvoice);
router.delete('/payments/:paymentId', requireBusiness, v.paymentIdParamValidator, controller.deletePayment);

module.exports = router;
