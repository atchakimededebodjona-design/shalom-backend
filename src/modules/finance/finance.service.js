// src/modules/finance/finance.service.js
// Accès aux données du module Gestion Financière. Tout est cloisonné par user_id
// et utilise le soft delete (deleted_at) là où la table le prévoit.

const { query } = require('../../config/db');

// =========================================================================
//  Catégories
// =========================================================================

const createCategory = async (userId, { name, type, icon }) => {
  const result = await query(
    `INSERT INTO finance_categories (user_id, name, type, icon)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, name, type, icon || null]
  );
  return result.rows[0];
};

const listCategories = async (userId, { type } = {}) => {
  const params = [userId];
  let where = 'user_id = $1 AND deleted_at IS NULL';
  if (type) {
    params.push(type);
    where += ` AND type = $${params.length}`;
  }
  const result = await query(
    `SELECT * FROM finance_categories WHERE ${where} ORDER BY name ASC`,
    params
  );
  return result.rows;
};

const updateCategory = async (id, userId, { name, icon }) => {
  const result = await query(
    `UPDATE finance_categories
     SET name = COALESCE($1, name),
         icon = COALESCE($2, icon)
     WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [name ?? null, icon ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteCategory = async (id, userId) => {
  const result = await query(
    `UPDATE finance_categories
     SET deleted_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Transactions
// =========================================================================

const createTransaction = async (userId, data) => {
  const { category_id, type, amount, note, transaction_date, is_recurring, recurrence_frequency } = data;
  const result = await query(
    `INSERT INTO finance_transactions
       (user_id, category_id, type, amount, note, transaction_date, is_recurring, recurrence_frequency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      category_id || null,
      type,
      amount,
      note || null,
      transaction_date,
      is_recurring ?? false,
      recurrence_frequency || null,
    ]
  );
  return result.rows[0];
};

const listTransactions = async (userId, { type, category_id, from, to, limit, offset }) => {
  const filters = [userId];
  let where = 't.user_id = $1 AND t.deleted_at IS NULL';
  if (type) { filters.push(type); where += ` AND t.type = $${filters.length}`; }
  if (category_id) { filters.push(category_id); where += ` AND t.category_id = $${filters.length}`; }
  if (from) { filters.push(from); where += ` AND t.transaction_date >= $${filters.length}`; }
  if (to) { filters.push(to); where += ` AND t.transaction_date <= $${filters.length}`; }

  const countResult = await query(
    `SELECT count(*)::int AS total FROM finance_transactions t WHERE ${where}`,
    filters
  );
  const total = countResult.rows[0].total;

  const rowsResult = await query(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon
     FROM finance_transactions t
     LEFT JOIN finance_categories c ON t.category_id = c.id
     WHERE ${where}
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );

  return { transactions: rowsResult.rows, total };
};

const getTransactionById = async (id, userId) => {
  const result = await query(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon
     FROM finance_transactions t
     LEFT JOIN finance_categories c ON t.category_id = c.id
     WHERE t.id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const updateTransaction = async (id, userId, data) => {
  const { category_id, type, amount, note, transaction_date, is_recurring, recurrence_frequency } = data;
  const result = await query(
    `UPDATE finance_transactions
     SET category_id = COALESCE($1, category_id),
         type = COALESCE($2, type),
         amount = COALESCE($3, amount),
         note = COALESCE($4, note),
         transaction_date = COALESCE($5, transaction_date),
         is_recurring = COALESCE($6, is_recurring),
         recurrence_frequency = COALESCE($7, recurrence_frequency),
         updated_at = now()
     WHERE id = $8 AND user_id = $9 AND deleted_at IS NULL
     RETURNING *`,
    [
      category_id ?? null,
      type ?? null,
      amount ?? null,
      note ?? null,
      transaction_date ?? null,
      is_recurring ?? null,
      recurrence_frequency ?? null,
      id,
      userId,
    ]
  );
  return result.rows[0] || null;
};

const softDeleteTransaction = async (id, userId) => {
  const result = await query(
    `UPDATE finance_transactions
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Objectifs d'épargne
// =========================================================================

const createGoal = async (userId, data) => {
  const { title, target_amount, current_amount, target_date } = data;
  const result = await query(
    `INSERT INTO finance_goals (user_id, title, target_amount, current_amount, target_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, title, target_amount, current_amount ?? 0, target_date || null]
  );
  return result.rows[0];
};

const listGoals = async (userId, { status } = {}) => {
  const params = [userId];
  let where = 'user_id = $1 AND deleted_at IS NULL';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  const result = await query(
    `SELECT * FROM finance_goals WHERE ${where} ORDER BY created_at DESC`,
    params
  );
  return result.rows;
};

const getGoalById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM finance_goals WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const updateGoal = async (id, userId, data) => {
  const { title, target_amount, current_amount, target_date, status } = data;
  const result = await query(
    `UPDATE finance_goals
     SET title = COALESCE($1, title),
         target_amount = COALESCE($2, target_amount),
         current_amount = COALESCE($3, current_amount),
         target_date = COALESCE($4, target_date),
         status = COALESCE($5, status),
         updated_at = now()
     WHERE id = $6 AND user_id = $7 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, target_amount ?? null, current_amount ?? null, target_date ?? null, status ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteGoal = async (id, userId) => {
  const result = await query(
    `UPDATE finance_goals
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Analyse : résumé mensuel + aperçu global
// =========================================================================

/**
 * Calcule (et met en cache dans finance_monthly_summary) le résumé d'un mois.
 * @param {string} userId
 * @param {string} yearMonth - format 'YYYY-MM'
 */
const getMonthlySummary = async (userId, yearMonth) => {
  const totals = await query(
    `SELECT type, COALESCE(SUM(amount), 0)::numeric(12,2) AS total
     FROM finance_transactions
     WHERE user_id = $1 AND deleted_at IS NULL
       AND to_char(transaction_date, 'YYYY-MM') = $2
     GROUP BY type`,
    [userId, yearMonth]
  );

  let totalIncome = 0;
  let totalExpense = 0;
  totals.rows.forEach((r) => {
    if (r.type === 'income') totalIncome = Number(r.total);
    else if (r.type === 'expense') totalExpense = Number(r.total);
  });

  const breakdown = await query(
    `SELECT COALESCE(c.name, 'Sans catégorie') AS name,
            COALESCE(SUM(t.amount), 0)::numeric(12,2) AS total
     FROM finance_transactions t
     LEFT JOIN finance_categories c ON t.category_id = c.id
     WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.type = 'expense'
       AND to_char(t.transaction_date, 'YYYY-MM') = $2
     GROUP BY COALESCE(c.name, 'Sans catégorie')
     ORDER BY total DESC`,
    [userId, yearMonth]
  );
  const categoryBreakdown = {};
  breakdown.rows.forEach((r) => { categoryBreakdown[r.name] = Number(r.total); });

  const savingsRate = totalIncome > 0
    ? Number((((totalIncome - totalExpense) / totalIncome) * 100).toFixed(2))
    : 0;

  const upsert = await query(
    `INSERT INTO finance_monthly_summary
       (user_id, year_month, total_income, total_expense, savings_rate, category_breakdown, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id, year_month) DO UPDATE
       SET total_income = EXCLUDED.total_income,
           total_expense = EXCLUDED.total_expense,
           savings_rate = EXCLUDED.savings_rate,
           category_breakdown = EXCLUDED.category_breakdown,
           updated_at = now()
     RETURNING *`,
    [userId, yearMonth, totalIncome, totalExpense, savingsRate, JSON.stringify(categoryBreakdown)]
  );

  return {
    ...upsert.rows[0],
    balance: Number((totalIncome - totalExpense).toFixed(2)),
  };
};

/**
 * Aperçu global tous mois confondus : totaux, solde et objectifs actifs.
 */
const getOverview = async (userId) => {
  const totals = await query(
    `SELECT type, COALESCE(SUM(amount), 0)::numeric(12,2) AS total
     FROM finance_transactions
     WHERE user_id = $1 AND deleted_at IS NULL
     GROUP BY type`,
    [userId]
  );
  let income = 0;
  let expense = 0;
  totals.rows.forEach((r) => {
    if (r.type === 'income') income = Number(r.total);
    else if (r.type === 'expense') expense = Number(r.total);
  });

  const goals = await query(
    `SELECT COUNT(*)::int AS active_goals
     FROM finance_goals
     WHERE user_id = $1 AND deleted_at IS NULL AND status = 'active'`,
    [userId]
  );

  return {
    total_income: income,
    total_expense: expense,
    balance: Number((income - expense).toFixed(2)),
    active_goals: goals.rows[0].active_goals,
  };
};

module.exports = {
  createCategory,
  listCategories,
  updateCategory,
  softDeleteCategory,
  createTransaction,
  listTransactions,
  getTransactionById,
  updateTransaction,
  softDeleteTransaction,
  createGoal,
  listGoals,
  getGoalById,
  updateGoal,
  softDeleteGoal,
  getMonthlySummary,
  getOverview,
};
