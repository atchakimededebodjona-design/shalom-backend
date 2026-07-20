// src/modules/invoices/invoices.service.js
// Accès aux données des factures (module Reçu+). Cloisonné par user_id, soft delete.
// Les totaux sont TOUJOURS calculés côté serveur.
//
// Intégration portefeuille : chaque paiement enregistré crédite, DANS LA MÊME
// transaction, le portefeuille SHALOM du propriétaire (source 'invoice'), via les
// helpers transactionnels exposés par wallet.service.

const { pool, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');
const { lockOrCreateWalletTx, applyMovementTx } = require('../wallet/wallet.service');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Calcule subtotal / tax_amount / total à partir des lignes et du taux de taxe. */
const computeTotals = (items, taxRate) => {
  const subtotal = round2(items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0));
  const tax_amount = round2((subtotal * Number(taxRate || 0)) / 100);
  const total = round2(subtotal + tax_amount);
  return { subtotal, tax_amount, total };
};

/** Recharge une facture complète (en-tête + lignes + paiements). */
const getById = async (id, userId) => {
  const invoiceResult = await query(
    `SELECT i.*, c.name AS client_name, c.email AS client_email
     FROM billing_invoices i
     LEFT JOIN billing_clients c ON i.client_id = c.id
     WHERE i.id = $1 AND i.user_id = $2 AND i.deleted_at IS NULL`,
    [id, userId]
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice) return null;

  const items = await query(
    `SELECT * FROM billing_invoice_items WHERE invoice_id = $1 ORDER BY position ASC, created_at ASC`,
    [id]
  );
  const payments = await query(
    `SELECT * FROM billing_payments WHERE invoice_id = $1 ORDER BY paid_at DESC, created_at DESC`,
    [id]
  );

  return { ...invoice, items: items.rows, payments: payments.rows };
};

const create = async (userId, data) => {
  const {
    client_id,
    invoice_number,
    currency,
    issue_date,
    due_date,
    notes,
    tax_rate = 0,
    items = [],
  } = data;

  const { subtotal, tax_amount, total } = computeTotals(items, tax_rate);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO billing_invoices
         (user_id, client_id, invoice_number, currency, issue_date, due_date, notes,
          tax_rate, subtotal, tax_amount, total)
       VALUES ($1, $2, $3, $4, COALESCE($5, current_date), $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        userId,
        client_id || null,
        invoice_number,
        currency || 'XOF',
        issue_date || null,
        due_date || null,
        notes || null,
        tax_rate,
        subtotal,
        tax_amount,
        total,
      ]
    );
    const invoiceId = inserted.rows[0].id;

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const amount = round2(Number(it.quantity) * Number(it.unit_price));
      await client.query(
        `INSERT INTO billing_invoice_items (invoice_id, description, quantity, unit_price, amount, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoiceId, it.description, it.quantity, it.unit_price, amount, i + 1]
      );
    }
    await client.query('COMMIT');
    return getById(invoiceId, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const list = async (userId, { status, client_id, from, to, limit, offset }) => {
  const filters = [userId];
  let where = 'i.user_id = $1 AND i.deleted_at IS NULL';
  if (status) { filters.push(status); where += ` AND i.status = $${filters.length}`; }
  if (client_id) { filters.push(client_id); where += ` AND i.client_id = $${filters.length}`; }
  if (from) { filters.push(from); where += ` AND i.issue_date >= $${filters.length}`; }
  if (to) { filters.push(to); where += ` AND i.issue_date <= $${filters.length}`; }

  const countResult = await query(`SELECT count(*)::int AS total FROM billing_invoices i WHERE ${where}`, filters);
  const total = countResult.rows[0].total;

  const rowsResult = await query(
    `SELECT i.id, i.invoice_number, i.status, i.currency, i.issue_date, i.due_date,
            i.total, i.amount_paid, i.client_id, c.name AS client_name, i.created_at
     FROM billing_invoices i
     LEFT JOIN billing_clients c ON i.client_id = c.id
     WHERE ${where}
     ORDER BY i.issue_date DESC, i.created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { invoices: rowsResult.rows, total };
};

/** Met à jour l'en-tête (hors lignes). Recalcule les taxes/total si tax_rate change. */
const update = async (id, userId, data) => {
  const existing = await getById(id, userId);
  if (!existing) return null;

  const { client_id, invoice_number, currency, issue_date, due_date, notes, status, tax_rate } = data;

  let { subtotal, tax_amount, total } = existing;
  if (tax_rate !== undefined && tax_rate !== null) {
    const recomputed = computeTotals(existing.items, tax_rate);
    subtotal = recomputed.subtotal;
    tax_amount = recomputed.tax_amount;
    total = recomputed.total;
  }

  const result = await query(
    `UPDATE billing_invoices
     SET client_id = COALESCE($1, client_id),
         invoice_number = COALESCE($2, invoice_number),
         currency = COALESCE($3, currency),
         issue_date = COALESCE($4, issue_date),
         due_date = COALESCE($5, due_date),
         notes = COALESCE($6, notes),
         status = COALESCE($7, status),
         tax_rate = COALESCE($8, tax_rate),
         subtotal = $9,
         tax_amount = $10,
         total = $11,
         updated_at = now()
     WHERE id = $12 AND user_id = $13 AND deleted_at IS NULL
     RETURNING id`,
    [
      client_id ?? null,
      invoice_number ?? null,
      currency ?? null,
      issue_date ?? null,
      due_date ?? null,
      notes ?? null,
      status ?? null,
      tax_rate ?? null,
      subtotal,
      tax_amount,
      total,
      id,
      userId,
    ]
  );
  if (result.rowCount === 0) return null;
  return getById(id, userId);
};

const softDelete = async (id, userId) => {
  const result = await query(
    `UPDATE billing_invoices SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

/**
 * Enregistre un paiement (reçu) contre une facture ET crédite le portefeuille
 * SHALOM du propriétaire, le tout dans UNE seule transaction :
 *   - verrou row-level sur la facture (FOR UPDATE) ;
 *   - insertion du paiement ;
 *   - crédit du portefeuille (source 'invoice') via les helpers wallet ;
 *   - mise à jour amount_paid + statut (partially_paid / paid).
 */
const recordPayment = async (invoiceId, userId, payment) => {
  const { amount, method, paid_at, reference, note } = payment;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const locked = await client.query(
      `SELECT id, invoice_number, total, amount_paid, status
       FROM billing_invoices
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [invoiceId, userId]
    );
    const invoice = locked.rows[0];
    if (!invoice) throw new AppError('Facture introuvable', 404, 'INVOICE_NOT_FOUND');
    if (invoice.status === 'cancelled') {
      throw new AppError('Impossible de payer une facture annulée', 409, 'INVOICE_CANCELLED');
    }

    // Crédit du portefeuille SHALOM (dans la même transaction) — source 'invoice'.
    const wallet = await lockOrCreateWalletTx(client, userId);
    const { transaction: walletTx } = await applyMovementTx(client, wallet, {
      type: 'credit',
      amount,
      source: 'invoice',
      reference_type: 'recu_invoice',
      reference_id: invoiceId,
      description: `Paiement facture ${invoice.invoice_number}`,
      metadata: { invoice_id: invoiceId, method: method || 'cash' },
    });

    // Enregistrement du reçu, rattaché au mouvement de portefeuille.
    await client.query(
      `INSERT INTO billing_payments
         (invoice_id, user_id, amount, method, paid_at, reference, note, wallet_transaction_id)
       VALUES ($1, $2, $3, $4, COALESCE($5, current_date), $6, $7, $8)`,
      [invoiceId, userId, amount, method || 'cash', paid_at || null, reference || null, note || null, walletTx.id]
    );

    const newPaid = round2(Number(invoice.amount_paid) + Number(amount));
    const newStatus = newPaid >= Number(invoice.total) ? 'paid' : 'partially_paid';

    await client.query(
      `UPDATE billing_invoices SET amount_paid = $1, status = $2, updated_at = now() WHERE id = $3`,
      [newPaid, newStatus, invoiceId]
    );

    await client.query('COMMIT');
    return { wallet_transaction_id: walletTx.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listPayments = async (invoiceId, userId) => {
  const owner = await query(
    `SELECT id FROM billing_invoices WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [invoiceId, userId]
  );
  if (owner.rowCount === 0) return null;

  const result = await query(
    `SELECT * FROM billing_payments WHERE invoice_id = $1 ORDER BY paid_at DESC, created_at DESC`,
    [invoiceId]
  );
  return result.rows;
};

/** Aperçu : compteurs par statut, montants facturés / encaissés / restant dû. */
const overview = async (userId) => {
  const totals = await query(
    `SELECT
       count(*)::int AS invoices_count,
       COALESCE(SUM(total), 0)::numeric(14,2) AS total_invoiced,
       COALESCE(SUM(amount_paid), 0)::numeric(14,2) AS total_paid
     FROM billing_invoices
     WHERE user_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'`,
    [userId]
  );

  const byStatus = await query(
    `SELECT status, count(*)::int AS count
     FROM billing_invoices
     WHERE user_id = $1 AND deleted_at IS NULL
     GROUP BY status`,
    [userId]
  );

  const row = totals.rows[0];
  const totalInvoiced = Number(row.total_invoiced);
  const totalPaid = Number(row.total_paid);
  const statusCounts = {};
  byStatus.rows.forEach((r) => { statusCounts[r.status] = r.count; });

  return {
    invoices_count: row.invoices_count,
    total_invoiced: totalInvoiced,
    total_paid: totalPaid,
    total_outstanding: round2(totalInvoiced - totalPaid),
    by_status: statusCounts,
  };
};

module.exports = {
  create,
  list,
  getById,
  update,
  softDelete,
  recordPayment,
  listPayments,
  overview,
};
