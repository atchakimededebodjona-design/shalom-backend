// src/modules/invoices/invoices.controller.js
// Contrôleur du module Facturation (Reçu+).

const invoicesService = require('./invoices.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');
const businessesService = require('../businesses/businesses.service');

// --- Helpers impression / partage -------------------------------------------
const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtMoney = (n, currency) => `${Number(n || 0).toLocaleString('fr-FR')} ${currency || ''}`.trim();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

const STATUS_FR = {
  draft: 'Brouillon', sent: 'Envoyée', partially_paid: 'Partielle',
  paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée',
};

// Facture imprimable : document HTML autonome avec en-tête entreprise + logo.
const buildInvoiceHtml = (invoice, business) => {
  const currency = invoice.currency || 'XOF';
  const remaining = Number(invoice.total) - Number(invoice.amount_paid);
  const rows = (invoice.items || []).map((it) => (
    `<tr><td>${escapeHtml(it.description)}</td>`
    + `<td class="num">${Number(it.quantity)}</td>`
    + `<td class="num">${fmtMoney(it.unit_price, currency)}</td>`
    + `<td class="num">${fmtMoney(it.amount, currency)}</td></tr>`
  )).join('');

  const logo = business && business.logo_url
    ? `<img class="logo" src="${escapeHtml(business.logo_url)}" alt="">` : '';
  const issuerMeta = business
    ? [business.address, business.phone, business.tax_id && ('NIF/RCCM : ' + business.tax_id)]
      .filter(Boolean).map(escapeHtml).join(' · ')
    : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Facture ${escapeHtml(invoice.invoice_number)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1c2a;margin:0;padding:32px}
  .sheet{max-width:800px;margin:0 auto}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid #eee;padding-bottom:20px}
  .logo{max-height:72px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px}
  .name{font-size:20px;font-weight:700}
  .meta{color:#666;font-size:13px;margin-top:4px}
  .doc{text-align:right}
  .doc h1{margin:0;font-size:26px;letter-spacing:.04em}
  .doc .sub{color:#666;font-size:13px;margin-top:4px}
  .parties{margin:28px 0}
  .parties h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#888}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{padding:10px 12px;text-align:left;font-size:14px}
  thead th{background:#f5f6fa;border-bottom:2px solid #e5e8f0}
  tbody td{border-bottom:1px solid #eee}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .totals{margin-top:20px;margin-left:auto;width:300px}
  .totals .row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
  .totals .final{border-top:2px solid #e5e8f0;font-weight:700;font-size:16px;margin-top:6px;padding-top:10px}
  .totals .due{color:#b23;font-weight:700}
  .status{display:inline-block;padding:3px 10px;border-radius:999px;background:#eef;font-size:12px}
  .notes{margin-top:24px;color:#444;font-size:13px}
  .printbar{text-align:center;margin:0 0 24px}
  .printbar button{padding:10px 22px;border:0;border-radius:8px;background:#34508a;color:#fff;font-size:14px;cursor:pointer}
  @media print{.printbar{display:none}body{padding:0}}
</style></head>
<body><div class="sheet">
  <div class="printbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
  <header>
    <div>${logo}<div class="name">${escapeHtml(business ? business.name : 'Facture')}</div><div class="meta">${issuerMeta}</div></div>
    <div class="doc">
      <h1>FACTURE</h1>
      <div class="sub">${escapeHtml(invoice.invoice_number)}</div>
      <div class="sub">Émise le ${fmtDate(invoice.issue_date)}</div>
      ${invoice.due_date ? `<div class="sub">Échéance ${fmtDate(invoice.due_date)}</div>` : ''}
      <div class="sub"><span class="status">${STATUS_FR[invoice.status] || escapeHtml(invoice.status)}</span></div>
    </div>
  </header>

  <div class="parties">
    <h3>Facturé à</h3>
    <div class="name" style="font-size:15px">${escapeHtml(invoice.client_name || '—')}</div>
    ${invoice.client_address ? `<div class="meta">${escapeHtml(invoice.client_address)}</div>` : ''}
    ${invoice.client_phone ? `<div class="meta">${escapeHtml(invoice.client_phone)}</div>` : ''}
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">Aucune ligne.</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Sous-total</span><span>${fmtMoney(invoice.subtotal, currency)}</span></div>
    <div class="row"><span>TVA (${Number(invoice.tax_rate)}%)</span><span>${fmtMoney(invoice.tax_amount, currency)}</span></div>
    <div class="row final"><span>Total</span><span>${fmtMoney(invoice.total, currency)}</span></div>
    <div class="row"><span>Payé</span><span>${fmtMoney(invoice.amount_paid, currency)}</span></div>
    <div class="row due"><span>Solde dû</span><span>${fmtMoney(remaining, currency)}</span></div>
  </div>

  ${invoice.notes ? `<div class="notes"><strong>Notes :</strong> ${escapeHtml(invoice.notes)}</div>` : ''}
</div></body></html>`;
};

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

// Facture imprimable (HTML) — ouverte dans un nouvel onglet côté front.
const print = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const invoice = await invoicesService.getById(req.params.id, req.user.id);
    if (!invoice) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    const business = await businessesService.getByUser(req.user.id);
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildInvoiceHtml(invoice, business));
  } catch (error) {
    next(error);
  }
};

// Lien WhatsApp pré-rempli pour envoyer la facture au client.
const whatsappLink = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const invoice = await invoicesService.getById(req.params.id, req.user.id);
    if (!invoice) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    const business = await businessesService.getByUser(req.user.id);
    const currency = invoice.currency || 'XOF';
    const remaining = Number(invoice.total) - Number(invoice.amount_paid);
    const lines = [
      business && business.name ? `*${business.name}*` : 'Facture',
      `Facture ${invoice.invoice_number}`,
      `Total : ${fmtMoney(invoice.total, currency)}`,
      remaining > 0 ? `Restant dû : ${fmtMoney(remaining, currency)}` : 'Facture payée ✅',
    ];
    const text = encodeURIComponent(lines.join('\n'));
    const phone = String(invoice.client_phone || '').replace(/[^0-9]/g, '');
    const whatsapp_url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    return res.status(200).json({ success: true, data: { whatsapp_url } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create, list, getOne, update, remove, addPayment, listPayments, overview, print, whatsappLink,
};
