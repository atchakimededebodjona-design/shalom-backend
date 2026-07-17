// src/modules/finance/finance.controller.js
// Contrôleur du module Gestion Financière.

const financeService = require('./finance.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

// =========================================================================
//  Catégories
// =========================================================================

const createCategory = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const category = await financeService.createCategory(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Catégorie créée', data: { category } });
  } catch (error) {
    next(error);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const categories = await financeService.listCategories(req.user.id, { type: req.query.type });
    return res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const category = await financeService.updateCategory(req.params.id, req.user.id, req.body);
    if (!category) throw new AppError('Catégorie introuvable', 404, 'CATEGORY_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Catégorie mise à jour', data: { category } });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await financeService.softDeleteCategory(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Catégorie introuvable', 404, 'CATEGORY_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Catégorie supprimée', data: {} });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
//  Transactions
// =========================================================================

const createTransaction = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const transaction = await financeService.createTransaction(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Transaction enregistrée', data: { transaction } });
  } catch (error) {
    next(error);
  }
};

const listTransactions = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { transactions, total } = await financeService.listTransactions(req.user.id, {
      type: req.query.type || null,
      category_id: req.query.category_id || null,
      from: req.query.from || null,
      to: req.query.to || null,
      limit,
      offset,
    });
    return res.status(200).json({
      success: true,
      data: { transactions, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

const getTransaction = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const transaction = await financeService.getTransactionById(req.params.id, req.user.id);
    if (!transaction) throw new AppError('Transaction introuvable', 404, 'TRANSACTION_NOT_FOUND');
    return res.status(200).json({ success: true, data: { transaction } });
  } catch (error) {
    next(error);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const transaction = await financeService.updateTransaction(req.params.id, req.user.id, req.body);
    if (!transaction) throw new AppError('Transaction introuvable', 404, 'TRANSACTION_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Transaction mise à jour', data: { transaction } });
  } catch (error) {
    next(error);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await financeService.softDeleteTransaction(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Transaction introuvable', 404, 'TRANSACTION_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Transaction supprimée', data: {} });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
//  Objectifs
// =========================================================================

const createGoal = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const goal = await financeService.createGoal(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Objectif créé', data: { goal } });
  } catch (error) {
    next(error);
  }
};

const listGoals = async (req, res, next) => {
  try {
    const goals = await financeService.listGoals(req.user.id, { status: req.query.status });
    return res.status(200).json({ success: true, data: { goals } });
  } catch (error) {
    next(error);
  }
};

const getGoal = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const goal = await financeService.getGoalById(req.params.id, req.user.id);
    if (!goal) throw new AppError('Objectif introuvable', 404, 'GOAL_NOT_FOUND');
    return res.status(200).json({ success: true, data: { goal } });
  } catch (error) {
    next(error);
  }
};

const updateGoal = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const goal = await financeService.updateGoal(req.params.id, req.user.id, req.body);
    if (!goal) throw new AppError('Objectif introuvable', 404, 'GOAL_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Objectif mis à jour', data: { goal } });
  } catch (error) {
    next(error);
  }
};

const deleteGoal = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await financeService.softDeleteGoal(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Objectif introuvable', 404, 'GOAL_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Objectif supprimé', data: {} });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
//  Analyse
// =========================================================================

const getSummary = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const yearMonth = req.query.year_month || new Date().toISOString().slice(0, 7);
    const summary = await financeService.getMonthlySummary(req.user.id, yearMonth);
    return res.status(200).json({ success: true, data: { summary } });
  } catch (error) {
    next(error);
  }
};

const getOverview = async (req, res, next) => {
  try {
    const overview = await financeService.getOverview(req.user.id);
    return res.status(200).json({ success: true, data: { overview } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  createGoal,
  listGoals,
  getGoal,
  updateGoal,
  deleteGoal,
  getSummary,
  getOverview,
};
