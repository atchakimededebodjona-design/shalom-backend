// src/modules/wallet/wallet.controller.js
// Contrôleur du module Portefeuille : validation des entrées, mapping req/res,
// et gestion spécifique des webhooks (toujours 200, log serveur).

const walletService = require('./wallet.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

// =========================================================================
//  Consultation
// =========================================================================

const getWallet = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { wallet, transactions, total } = await walletService.getWalletSummary(req.user.id, { limit, offset });
    return res.status(200).json({
      success: true,
      data: { wallet, transactions, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) {
    next(error);
  }
};

const listTransactions = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { transactions, total } = await walletService.listTransactions(req.user.id, {
      type: req.query.type || null,
      category_id: req.query.category_id || null,
      source: req.query.source || null,
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

// =========================================================================
//  Revenu / Dépense manuels
// =========================================================================

const createIncome = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await walletService.creditWallet(req.user.id, {
      amount: req.body.amount,
      source: 'manual',
      category_id: req.body.category_id,
      reference_type: req.body.reference_type,
      reference_id: req.body.reference_id,
      description: req.body.description,
    });
    return res.status(201).json({
      success: true,
      message: 'Revenu enregistré',
      data: { transaction: result.transaction, balance: result.balance },
    });
  } catch (error) {
    next(error);
  }
};

const createExpense = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await walletService.debitWallet(req.user.id, {
      amount: req.body.amount,
      source: 'manual',
      category_id: req.body.category_id,
      reference_type: req.body.reference_type,
      reference_id: req.body.reference_id,
      description: req.body.description,
    });
    return res.status(201).json({
      success: true,
      message: 'Dépense enregistrée',
      data: { transaction: result.transaction, balance: result.balance },
    });
  } catch (error) {
    // Solde insuffisant → AppError 400 (INSUFFICIENT_BALANCE) remonté au errorHandler
    next(error);
  }
};

// =========================================================================
//  Rechargement (topup)
// =========================================================================

const initiateTopup = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const payment = await walletService.initiateTopup(req.user.id, {
      amount: req.body.amount,
      provider: req.body.provider,
    });
    return res.status(200).json({
      success: true,
      message: 'Rechargement initié — redirigez l\'utilisateur vers payment_url',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
//  Annulation
// =========================================================================

const reverseTransaction = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    // req.body peut être undefined (POST sans corps) : reason est optionnel.
    const reason = req.body ? req.body.reason : undefined;
    const result = await walletService.reverseTransaction(req.params.id, req.user.id, reason);

    if (result.code === 'TRANSACTION_NOT_FOUND') {
      throw new AppError('Transaction introuvable', 404, 'TRANSACTION_NOT_FOUND');
    }
    if (result.code === 'ALREADY_REVERSED') {
      throw new AppError('Transaction déjà annulée', 409, 'ALREADY_REVERSED');
    }
    if (result.code === 'NOT_REVERSIBLE') {
      throw new AppError('Transaction non annulable (statut invalide)', 409, 'NOT_REVERSIBLE');
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction annulée',
      data: { reversal: result.reversal, balance: result.balance, original_id: result.original_id },
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
//  Webhooks providers — PAS de JWT, signature HMAC, TOUJOURS 200
// =========================================================================

/**
 * Normalise le payload BRUT d'un provider vers le format interne.
 *
 * ⚠️ STUB : à compléter avec la doc de chaque provider. Les noms de champs,
 * le statut « paiement réussi », et l'emplacement de l'identifiant utilisateur
 * (généralement un champ metadata/custom renseigné lors de initiateProviderPayment)
 * diffèrent d'un provider à l'autre.
 *
 * @returns {object|null} champs normalisés, ou null si payload inexploitable.
 */
const normalizeProviderPayload = (provider, body = {}) => {
  const userId = body.user_id || (body.metadata && body.metadata.user_id);
  const providerTxId = body.provider_tx_id || body.transaction_id || body.id;
  const amount = body.amount;
  const direction = body.direction || 'credit';
  const currency = body.currency || 'XOF';
  // ⚠️ STUB : nom de champ à adapter au provider réel — c'est la référence
  // interne SHALOM (wallet_topup_requests.reference) que le provider est
  // censé recevoir en donnée personnalisée/metadata à l'initiation et nous
  // renvoyer telle quelle ici. Sans elle, le webhook est refusé (cf.
  // processProviderWebhook) : on ne peut rien vérifier sans elle.
  const internalReference = body.reference || (body.metadata && body.metadata.reference) || null;
  // ⚠️ STUB : nom de champ et valeur "succès" réels à adapter au provider.
  const paymentStatus = body.status || body.payment_status || walletService.PAYMENT_STATUS_SUCCESS;

  if (!userId || !providerTxId || amount === undefined || amount === null) {
    return null;
  }
  return {
    userId,
    provider_tx_id: String(providerTxId),
    amount,
    currency,
    direction,
    internalReference,
    paymentStatus,
    source: body.source, // laissé au service (défaut selon direction)
    reference_type: body.reference_type || null,
    reference_id: body.reference_id || null,
    description: body.description || `Paiement ${provider}`,
  };
};

/**
 * Traite la notification CinetPay (mécanisme réel, distinct du chemin
 * générique ci-dessous utilisé par les providers encore en STUB).
 *
 * D'après la documentation officielle CinetPay, la notification POST ne
 * transmet PAS de statut de paiement fiable ("pour des raisons de
 * sécurité") — seul le champ cpm_trans_id (l'identifiant de transaction,
 * qui est la référence SHALOM elle-même, cf. initiateCinetpayPayment) est
 * exploité ici. Tout le reste (montant, devise, statut réel) est obtenu en
 * interrogeant CinetPay lui-même (reconcileCinetpayNotification), jamais
 * depuis ce corps de requête.
 */
const handleCinetpayWebhook = async (req, res) => {
  const cpmTransId = req.body?.cpm_trans_id;
  if (!cpmTransId) {
    console.warn('[wallet][webhook][cinetpay] cpm_trans_id absent — notification ignorée');
    return res.status(200).json({ received: true });
  }

  const xToken = req.headers['x-token'] || '';
  if (!walletService.verifyCinetpayXToken(req.body, xToken)) {
    console.warn('[wallet][webhook][cinetpay] X-TOKEN invalide — notification rejetée');
    return res.status(200).json({ received: true });
  }

  const result = await walletService.reconcileCinetpayNotification(cpmTransId);
  if (result.rejected) {
    console.warn(`[wallet][webhook][cinetpay] rejeté : ${result.reason}`);
  }
  return res.status(200).json({ received: true, duplicate: result.duplicate });
};

const handleWebhook = async (req, res) => {
  const { provider } = req.params;
  try {
    if (!walletService.SUPPORTED_PROVIDERS.includes(provider)) {
      console.warn(`[wallet][webhook] provider non supporté : ${provider}`);
      return res.status(200).json({ received: true });
    }

    if (provider === 'cinetpay') {
      return await handleCinetpayWebhook(req, res);
    }

    // --- Chemin générique STUB (FedaPay, hors périmètre de cette phase) ---
    // 1. Vérification de signature HMAC. req.rawBody est capté par le `verify`
    // de express.json() (voir app.js) — ce sont les octets exacts envoyés par
    // le provider, indispensables pour que le HMAC corresponde.
    const signature = req.headers['x-provider-signature'] || req.headers['x-signature'] || '';
    const rawBody = req.rawBody || Buffer.from('');
    if (!walletService.verifyWebhookSignature(provider, rawBody, signature)) {
      console.warn(`[wallet][webhook] signature invalide (${provider})`);
      return res.status(200).json({ received: true });
    }

    // 2. Normalisation du payload (STUB par provider).
    const normalized = normalizeProviderPayload(provider, req.body);
    if (!normalized) {
      console.warn(`[wallet][webhook] payload non exploitable (${provider})`);
      return res.status(200).json({ received: true });
    }

    // 3. Traitement idempotent (log brut → vérification de la demande de
    // recharge attendue → crédit/débit → réconciliation).
    const result = await walletService.processProviderWebhook({
      provider,
      raw_payload: req.body,
      ...normalized,
    });

    if (result.rejected) {
      console.warn(`[wallet][webhook] rejeté (${provider}) : ${result.reason}`);
    }

    return res.status(200).json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    // TOUJOURS 200 pour éviter les retries en boucle du provider ; on log côté serveur.
    console.error(`[wallet][webhook] erreur de traitement (${provider}) :`, error);
    return res.status(200).json({ received: true });
  }
};

// =========================================================================
//  Admin — observabilité des recharges (diagnostiquer pending/completed/failed/cancelled)
// =========================================================================

const adminListTopups = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await walletService.adminListTopupRequests({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
//  Catégories
// =========================================================================

const listCategories = async (req, res, next) => {
  try {
    const categories = await walletService.listCategories(req.user.id, { type: req.query.type });
    return res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const category = await walletService.createCategory(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Catégorie créée', data: { category } });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const category = await walletService.updateCategory(req.params.id, req.user.id, req.body);
    if (!category) throw new AppError('Catégorie introuvable ou non modifiable', 404, 'CATEGORY_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Catégorie mise à jour', data: { category } });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await walletService.softDeleteCategory(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Catégorie introuvable ou non supprimable', 404, 'CATEGORY_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Catégorie supprimée', data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWallet,
  listTransactions,
  createIncome,
  createExpense,
  initiateTopup,
  reverseTransaction,
  handleWebhook,
  adminListTopups,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
