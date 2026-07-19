// src/modules/billing/billing.service.js
// Logique métier du module Facturation « Reçu+ ».
//
// Un abonné SHALOM peut déclarer son entreprise (une seule par compte), y
// rattacher des clients (simples contacts, pas forcément des comptes SHALOM)
// et leur émettre des factures. Chaque paiement enregistré crédite
// automatiquement le portefeuille SHALOM (wallet) du propriétaire de
// l'entreprise, via le service du module wallet (cf. AGENTS.md : « les
// modules ne s'importent jamais entre eux directement, utiliser les
// services »).

const { pool, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');
const walletService = require('../wallet/wallet.service');

const computeStatus = (amountPaid, total, dueDateStr) => {
  if (amountPaid <= 0) {
    if (dueDateStr && new Date(dueDateStr) < new Date()) return 'overdue';
    return 'draft';
  }
  if (amountPaid < total) return 'partial';
  return 'paid';
};

// =========================================================================
// Entreprise
// =========================================================================

const createBusiness = async (userId, data) => {
  const existing = await query(
    'SELECT id FROM businesses WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (existing.rows.length > 0) {
    throw new AppError('Vous avez déjà une entreprise enregistrée', 409, 'BUSINESS_ALREADY_EXISTS');
  }

  const { name, logo_url, address, phone, tax_id, currency, invoice_prefix } = data;
  const result = await query(
    `INSERT INTO businesses (user_id, name, logo_url, address, phone, tax_id, currency, invoice_prefix)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'XOF'), COALESCE($8, 'FAC'))
     RETURNING *`,
    [userId, name, logo_url || null, address || null, phone || null, tax_id || null, currency || null, invoice_prefix || null]
  );
  return result.rows[0];
};

const getBusinessByUserId = async (userId) => {
  const result = await query(
    'SELECT * FROM businesses WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return result.rows[0] || null;
};

const updateBusiness = async (userId, data) => {
  const { name, logo_url, address, phone, tax_id, currency, invoice_prefix } = data;
  const result = await query(
    `UPDATE businesses
     SET name = COALESCE($1, name),
         logo_url = COALESCE($2, logo_url),
         address = COALESCE($3, address),
         phone = COALESCE($4, phone),
         tax_id = COALESCE($5, tax_id),
         currency = COALESCE($6, currency),
         invoice_prefix = COALESCE($7, invoice_prefix)
     WHERE user_id = $8 AND deleted_at IS NULL
     RETURNING *`,
    [name, logo_url, address, phone, tax_id, currency, invoice_prefix, userId]
  );
  return result.rows[0] || null;
};

// =========================================================================
// Clients
// =========================================================================

const createClient = async (businessId, data) => {
  const { name, phone, email, address } = data;
  const result = await query(
    `INSERT INTO clients (business_id, name, phone, email, address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [businessId, name, phone || null, email || null, address || null]
  );
  return result.rows[0];
};

const listClients = async (businessId, { page, limit, offset }) => {
  const countResult = await query(
    'SELECT COUNT(*) FROM clients WHERE business_id = $1 AND deleted_at IS NULL',
    [businessId]
  );
  const result = await query(
    `SELECT * FROM clients
     WHERE business_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [businessId, limit, offset]
  );
  return { clients: result.rows, total: parseInt(countResult.rows[0].count, 10) };
};

const updateClient = async (businessId, clientId, data) => {
  const { name, phone, email, address } = data;
  const result = await query(
    `UPDATE clients
     SET name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         email = COALESCE($3, email),
         address = COALESCE($4, address)
     WHERE id = $5 AND business_id = $6 AND deleted_at IS NULL
     RETURNING *`,
    [name, phone, email, address, clientId, businessId]
  );
  return result.rows[0] || null;
};

const deleteClient = async (businessId, clientId) => {
  const result = await query(
    `UPDATE clients SET deleted_at = now()
     WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [clientId, businessId]
  );
  return result.rows.length > 0;
};

// =========================================================================
// Factures
// =========================================================================

const createInvoice = async (business, data) => {
  const { client_id, items, tax_rate, issue_date, due_date, notes, discount_amount, down_payment } = data;

  const clientCheck = await query(
    'SELECT id FROM clients WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL',
    [client_id, business.id]
  );
  if (clientCheck.rows.length === 0) {
    throw new AppError('Client introuvable', 404, 'CLIENT_NOT_FOUND');
  }

  let subtotal = 0;
  const processedItems = items.map((item, index) => {
    const quantity = parseFloat(item.quantity);
    const unitPrice = parseInt(item.unit_price, 10);
    const lineTotal = Math.round(quantity * unitPrice);
    subtotal += lineTotal;
    return { description: item.description, quantity, unitPrice, lineTotal, sortOrder: item.sort_order ?? index };
  });

  const taxRate = tax_rate ? parseFloat(tax_rate) : 0;
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const total = subtotal + taxAmount;

  const discountAmount = discount_amount ? parseInt(discount_amount, 10) : 0;
  if (discountAmount > total) {
    throw new AppError('La remise ne peut pas dépasser le total de la facture', 400, 'DISCOUNT_EXCEEDS_TOTAL');
  }
  const downPaymentAmount = down_payment ? parseInt(down_payment, 10) : 0;
  if (downPaymentAmount > total - discountAmount) {
    throw new AppError("L'acompte ne peut pas dépasser le montant net à payer", 400, 'DOWN_PAYMENT_EXCEEDS_DUE');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Numérotation séquentielle par entreprise et par année, sous verrou.
    const businessRow = await client.query(
      'SELECT invoice_prefix FROM businesses WHERE id = $1 FOR UPDATE',
      [business.id]
    );
    const prefix = businessRow.rows[0].invoice_prefix || 'FAC';
    const currentYear = new Date().getFullYear();
    const countResult = await client.query(
      `SELECT COUNT(*) AS count FROM invoices
       WHERE business_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
      [business.id, currentYear]
    );
    const nextNumber = parseInt(countResult.rows[0].count, 10) + 1;
    const invoiceNumber = `${prefix}-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

    const invoiceResult = await client.query(
      `INSERT INTO invoices (business_id, client_id, invoice_number, status, issue_date, due_date,
                              subtotal, tax_rate, tax_amount, total, discount_amount, amount_paid, notes)
       VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,0,$11)
       RETURNING *`,
      [
        business.id, client_id, invoiceNumber,
        issue_date || new Date().toISOString().split('T')[0],
        due_date || null,
        subtotal, taxRate, taxAmount, total, discountAmount, notes || null,
      ]
    );
    const invoice = invoiceResult.rows[0];

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [invoice.id, item.description, item.quantity, item.unitPrice, item.lineTotal, item.sortOrder]
      );
    }

    await client.query('COMMIT');
    invoice.items = processedItems;

    // L'acompte versé à la création n'est pas stocké sur la facture : il est
    // enregistré comme un paiement normal (crédite le wallet, alimente
    // amount_paid/status) via le même chemin que les paiements ultérieurs.
    if (downPaymentAmount > 0) {
      const payment = await createPayment(business, invoice.id, {
        amount: downPaymentAmount,
        payment_method: 'cash',
        payment_date: invoice.issue_date,
      });
      const updated = payment.invoice;
      updated.items = processedItems;
      return updated;
    }

    return invoice;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getInvoiceById = async (businessId, invoiceId) => {
  const result = await query(
    'SELECT * FROM invoices WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL',
    [invoiceId, businessId]
  );
  if (result.rows.length === 0) return null;

  const invoice = result.rows[0];
  const itemsResult = await query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC',
    [invoiceId]
  );
  invoice.items = itemsResult.rows;
  return invoice;
};

const listInvoices = async (businessId, { page, limit, offset, status }) => {
  const params = [businessId];
  let where = 'business_id = $1 AND deleted_at IS NULL';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }

  const countResult = await query(`SELECT COUNT(*) FROM invoices WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await query(
    `SELECT * FROM invoices WHERE ${where}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { invoices: result.rows, total };
};

const updateInvoice = async (businessId, invoiceId, updates) => {
  const { items, client_id, status, due_date, notes, tax_rate, discount_amount } = updates;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkResult = await client.query(
      'SELECT * FROM invoices WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [invoiceId, businessId]
    );
    if (checkResult.rows.length === 0) {
      throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    }
    const current = checkResult.rows[0];

    let subtotal = current.subtotal;
    let taxRate = tax_rate !== undefined ? parseFloat(tax_rate) : parseFloat(current.tax_rate);
    const discountAmount = discount_amount !== undefined ? parseInt(discount_amount, 10) : current.discount_amount;

    if (items) {
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
      subtotal = 0;
      const processedItems = items.map((item, index) => {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseInt(item.unit_price, 10);
        const lineTotal = Math.round(quantity * unitPrice);
        subtotal += lineTotal;
        return { description: item.description, quantity, unitPrice, lineTotal, sortOrder: item.sort_order ?? index };
      });
      for (const item of processedItems) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [invoiceId, item.description, item.quantity, item.unitPrice, item.lineTotal, item.sortOrder]
        );
      }
    }

    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const total = subtotal + taxAmount;
    if (discountAmount > total) {
      throw new AppError('La remise ne peut pas dépasser le total de la facture', 400, 'DISCOUNT_EXCEEDS_TOTAL');
    }
    const newDueDate = due_date !== undefined ? due_date : current.due_date;
    const newStatus = status !== undefined ? status : computeStatus(current.amount_paid, total - discountAmount, newDueDate);

    if (client_id) {
      const clientCheck = await client.query(
        'SELECT id FROM clients WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL',
        [client_id, businessId]
      );
      if (clientCheck.rows.length === 0) {
        throw new AppError('Client introuvable', 404, 'CLIENT_NOT_FOUND');
      }
    }

    const result = await client.query(
      `UPDATE invoices
       SET client_id = COALESCE($1, client_id),
           subtotal = $2, tax_rate = $3, tax_amount = $4, total = $5,
           discount_amount = $6,
           status = $7, due_date = $8,
           notes = COALESCE($9, notes)
       WHERE id = $10 AND business_id = $11
       RETURNING *`,
      [client_id || null, subtotal, taxRate, taxAmount, total, discountAmount, newStatus, newDueDate, notes, invoiceId, businessId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteInvoice = async (businessId, invoiceId) => {
  const result = await query(
    `UPDATE invoices SET deleted_at = now()
     WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [invoiceId, businessId]
  );
  return result.rows.length > 0;
};

// =========================================================================
// Paiements — chaque paiement crédite le wallet SHALOM du propriétaire
// =========================================================================

const createPayment = async (business, invoiceId, data) => {
  const { amount, payment_method, reference_id, payment_date } = data;

  const client = await pool.connect();
  let paidInvoice;
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      'SELECT * FROM invoices WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [invoiceId, business.id]
    );
    if (invoiceResult.rows.length === 0) {
      throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    }
    const invoice = invoiceResult.rows[0];
    const netTotal = invoice.total - invoice.discount_amount;

    const newAmountPaid = invoice.amount_paid + amount;
    if (newAmountPaid > netTotal) {
      throw new AppError(
        `Le paiement de ${amount} dépasse le montant restant dû de ${netTotal - invoice.amount_paid}.`,
        400,
        'PAYMENT_EXCEEDS_DUE'
      );
    }

    const clientRow = await client.query('SELECT name FROM clients WHERE id = $1', [invoice.client_id]);
    const clientName = clientRow.rows[0]?.name || 'client';

    const paymentResult = await client.query(
      `INSERT INTO payments (business_id, invoice_id, amount, payment_method, reference_id, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [business.id, invoiceId, amount, payment_method || 'cash', reference_id || null, payment_date || new Date().toISOString().split('T')[0]]
    );
    const payment = paymentResult.rows[0];

    const newStatus = computeStatus(newAmountPaid, netTotal, invoice.due_date);
    const updatedInvoiceResult = await client.query(
      `UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3 RETURNING *`,
      [newAmountPaid, newStatus, invoiceId]
    );
    paidInvoice = updatedInvoiceResult.rows[0];

    await client.query('COMMIT');

    // Crédite le portefeuille SHALOM du propriétaire de l'entreprise. Étape
    // séparée volontairement (wallet.service gère sa propre transaction) :
    // le paiement est déjà acté même si ce crédit échouait.
    try {
      const { transaction } = await walletService.creditWallet(business.user_id, {
        amount,
        source: 'invoice',
        reference_type: 'recu_invoice',
        reference_id: invoiceId,
        description: `Paiement facture ${paidInvoice.invoice_number} — ${clientName} (${business.name})`,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: paidInvoice.invoice_number,
          client_id: invoice.client_id,
          client_name: clientName,
          business_id: business.id,
          business_name: business.name,
          payment_id: payment.id,
          payment_method: payment.payment_method,
        },
      });
      await query('UPDATE payments SET wallet_transaction_id = $1 WHERE id = $2', [transaction.id, payment.id]);
      payment.wallet_transaction_id = transaction.id;
    } catch (walletErr) {
      console.error('❌ Paiement enregistré mais crédit wallet échoué :', walletErr.message);
    }

    payment.invoice = paidInvoice;
    return payment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listPaymentsByInvoice = async (businessId, invoiceId) => {
  const invoiceCheck = await query(
    'SELECT id FROM invoices WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL',
    [invoiceId, businessId]
  );
  if (invoiceCheck.rows.length === 0) {
    throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
  }
  const result = await query(
    `SELECT * FROM payments WHERE invoice_id = $1 AND business_id = $2 AND deleted_at IS NULL
     ORDER BY payment_date DESC, created_at DESC`,
    [invoiceId, businessId]
  );
  return result.rows;
};

const deletePayment = async (business, paymentId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [paymentId, business.id]
    );
    if (paymentResult.rows.length === 0) {
      throw new AppError('Paiement introuvable', 404, 'PAYMENT_NOT_FOUND');
    }
    const payment = paymentResult.rows[0];

    const invoiceResult = await client.query(
      'SELECT * FROM invoices WHERE id = $1 AND business_id = $2 FOR UPDATE',
      [payment.invoice_id, business.id]
    );
    const invoice = invoiceResult.rows[0];

    await client.query('UPDATE payments SET deleted_at = now() WHERE id = $1', [paymentId]);

    const sumResult = await client.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = $1 AND deleted_at IS NULL',
      [payment.invoice_id]
    );
    const recalculated = parseInt(sumResult.rows[0].total_paid, 10);
    const newStatus = computeStatus(recalculated, invoice.total - invoice.discount_amount, invoice.due_date);

    await client.query('UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3', [
      recalculated, newStatus, payment.invoice_id,
    ]);

    await client.query('COMMIT');

    if (payment.wallet_transaction_id) {
      try {
        await walletService.reverseTransaction(payment.wallet_transaction_id, business.user_id, 'Paiement Reçu+ annulé');
      } catch (walletErr) {
        console.error('❌ Paiement annulé mais annulation wallet échouée :', walletErr.message);
      }
    }

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =========================================================================
// Impression & partage WhatsApp
// =========================================================================

/**
 * Charge une facture avec ses lignes, son entreprise et son client, sans
 * filtrer par utilisateur — l'appelant est responsable du contrôle d'accès
 * (business_id pour le propriétaire, share_token pour le lien public).
 */
const fetchInvoiceFull = async (whereClause, params) => {
  const result = await query(
    `SELECT i.*,
            b.name AS business_name, b.logo_url AS business_logo_url,
            b.address AS business_address, b.phone AS business_phone, b.tax_id AS business_tax_id,
            b.currency AS business_currency,
            c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.address AS client_address
     FROM invoices i
     JOIN businesses b ON b.id = i.business_id
     JOIN clients c ON c.id = i.client_id
     WHERE ${whereClause} AND i.deleted_at IS NULL`,
    params
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const itemsResult = await query(
    'SELECT description, quantity, unit_price, line_total FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC',
    [row.id]
  );

  return {
    invoice: row,
    items: itemsResult.rows,
    business: {
      name: row.business_name, logo_url: row.business_logo_url, address: row.business_address,
      phone: row.business_phone, tax_id: row.business_tax_id, currency: row.business_currency,
    },
    client: { name: row.client_name, phone: row.client_phone, email: row.client_email, address: row.client_address },
  };
};

const getInvoiceForPrint = async (businessId, invoiceId) =>
  fetchInvoiceFull('i.id = $1 AND i.business_id = $2', [invoiceId, businessId]);

const getInvoiceByShareToken = async (shareToken) =>
  fetchInvoiceFull('i.share_token = $1', [shareToken]);

const formatAmount = (amount, currency) =>
  `${Number(amount).toLocaleString('fr-FR')} ${currency}`;

/**
 * Génère une page HTML autonome et imprimable pour une facture (utilisée par
 * la route privée et la route publique). Pas de dépendance PDF : l'impression
 * passe par le dialogue « Imprimer » du navigateur (Ctrl+P / Enregistrer en PDF).
 */
const renderInvoiceHtml = ({ invoice, items, business, client }) => {
  const currency = business.currency || 'XOF';
  const statusLabels = { draft: 'Brouillon', partial: 'Partiellement payée', paid: 'Payée', overdue: 'En retard' };
  const rows = items.map((item) => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:right">${Number(item.quantity)}</td>
      <td style="text-align:right">${formatAmount(item.unit_price, currency)}</td>
      <td style="text-align:right">${formatAmount(item.line_total, currency)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Facture ${invoice.invoice_number}</title>
<style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; max-width: 720px; margin: 40px auto; padding: 0 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
  .business { display: flex; align-items: flex-start; gap: 12px; }
  .business img { width: 56px; height: 56px; object-fit: contain; border-radius: 6px; }
  .business h1 { margin: 0 0 4px; font-size: 20px; }
  .business p { margin: 2px 0; font-size: 13px; color: #444; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { margin: 0 0 4px; font-size: 18px; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #eee; }
  .client { margin-bottom: 24px; }
  .client h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; border-bottom: 1px solid #ccc; padding: 6px 4px; font-size: 12px; text-transform: uppercase; color: #888; }
  th:not(:first-child), td:not(:first-child) { text-align: right; }
  td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 14px; }
  .totals { margin-left: auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
  .totals .total { font-weight: bold; font-size: 16px; border-top: 2px solid #1a1a1a; margin-top: 4px; padding-top: 8px; }
  .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
  @media print { .no-print { display: none; } body { margin: 0; } }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="float:right; padding:8px 14px;">🖨️ Imprimer</button>
  <div class="header">
    <div class="business">
      ${business.logo_url ? `<img src="${business.logo_url}" alt="Logo" />` : ''}
      <div>
        <h1>${business.name}</h1>
        ${business.address ? `<p>${business.address}</p>` : ''}
        ${business.phone ? `<p>Tél : ${business.phone}</p>` : ''}
        ${business.tax_id ? `<p>NIF/RCCM : ${business.tax_id}</p>` : ''}
      </div>
    </div>
    <div class="invoice-meta">
      <h2>Facture ${invoice.invoice_number}</h2>
      <p><span class="status">${statusLabels[invoice.status] || invoice.status}</span></p>
      <p>Émise le : ${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</p>
      ${invoice.due_date ? `<p>Échéance : ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}</p>` : ''}
    </div>
  </div>

  <div class="client">
    <h3>Facturé à</h3>
    <p><strong>${client.name}</strong></p>
    ${client.address ? `<p>${client.address}</p>` : ''}
    ${client.phone ? `<p>${client.phone}</p>` : ''}
    ${client.email ? `<p>${client.email}</p>` : ''}
  </div>

  <table>
    <thead><tr><th>Description</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Sous-total</span><span>${formatAmount(invoice.subtotal, currency)}</span></div>
    <div><span>TVA (${Number(invoice.tax_rate)}%)</span><span>${formatAmount(invoice.tax_amount, currency)}</span></div>
    <div class="total"><span>Total</span><span>${formatAmount(invoice.total, currency)}</span></div>
    ${invoice.discount_amount > 0 ? `<div><span>Remise</span><span>-${formatAmount(invoice.discount_amount, currency)}</span></div>` : ''}
    <div><span>Payé</span><span>${formatAmount(invoice.amount_paid, currency)}</span></div>
    <div><span>Solde dû</span><span>${formatAmount(invoice.total - invoice.discount_amount - invoice.amount_paid, currency)}</span></div>
  </div>

  ${invoice.notes ? `<p><strong>Notes :</strong> ${invoice.notes}</p>` : ''}

  <div class="footer">Facture générée via Reçu+ — SHALOM</div>
</body>
</html>`;
};

/**
 * Construit le lien WhatsApp « click-to-chat » (wa.me) pré-rempli avec un
 * résumé de la facture et le lien public d'impression. Aucune API WhatsApp
 * requise : ouvre WhatsApp Web/mobile avec le message déjà rédigé.
 */
const buildWhatsappLink = ({ invoice, business, client }, publicUrl) => {
  if (!client.phone) {
    throw new AppError("Ce client n'a pas de numéro de téléphone renseigné", 400, 'CLIENT_PHONE_MISSING');
  }
  const digits = client.phone.replace(/[^\d]/g, '');
  const currency = business.currency || 'XOF';
  const message = [
    `Bonjour ${client.name}, voici votre facture ${invoice.invoice_number} de ${business.name}.`,
    `Montant à payer : ${formatAmount(invoice.total - invoice.discount_amount, currency)}`,
    invoice.due_date ? `Échéance : ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}` : null,
    `Voir/imprimer la facture : ${publicUrl}`,
  ].filter(Boolean).join('\n');

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

module.exports = {
  createBusiness,
  getBusinessByUserId,
  updateBusiness,
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
  getInvoiceForPrint,
  getInvoiceByShareToken,
  renderInvoiceHtml,
  buildWhatsappLink,
};
