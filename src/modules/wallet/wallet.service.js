// src/modules/wallet/wallet.service.js
// Logique métier du module Portefeuille (Shalom Tools).
//
// Deux natures de mouvements cohabitent dans les mêmes tables :
//   - suivi personnel : revenus/dépenses manuels catégorisés ;
//   - transactions réelles plateforme : rechargements CinetPay/FedaPay,
//     abonnements CAMAJ+, achats de crédits, factures Reçu+, commissions.
//
// Invariants :
//   - le solde est TOUJOURS modifié sous verrou row-level (SELECT ... FOR UPDATE)
//     dans une transaction pool.connect() ;
//   - aucune suppression physique de mouvement (soft delete + annulation inverse) ;
//   - les webhooks providers sont idempotents (UNIQUE provider + provider_tx_id).

const crypto = require('crypto');
const { pool, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// Secrets HMAC par provider — à renseigner dans .env lors de l'intégration réelle.
// (Laissés en process.env direct tant que les providers ne sont pas branchés.)
const PROVIDER_SECRETS = {
  cinetpay: process.env.CINETPAY_WEBHOOK_SECRET,
  fedapay: process.env.FEDAPAY_WEBHOOK_SECRET,
};

const SUPPORTED_PROVIDERS = ['cinetpay', 'fedapay'];

// =========================================================================
//  Helpers internes (utilisés à l'intérieur d'une transaction déjà ouverte)
// =========================================================================

/**
 * Verrouille le portefeuille actif d'un utilisateur, en le créant à la volée
 * si nécessaire. À n'appeler qu'entre BEGIN et COMMIT (verrou FOR UPDATE).
 *
 * L'upsert s'appuie sur l'index partiel `uniq_wallets_user_active` :
 * deux mouvements concurrents pour un utilisateur sans portefeuille ne peuvent
 * pas créer deux lignes — l'un insère, l'autre récupère et attend le verrou.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 * @returns {Promise<object>} la ligne wallet verrouillée
 */
const lockOrCreateWalletTx = async (client, userId) => {
  await client.query(
    `INSERT INTO wallets (user_id) VALUES ($1)
     ON CONFLICT (user_id) WHERE deleted_at IS NULL DO NOTHING`,
    [userId]
  );
  const res = await client.query(
    `SELECT id, balance, currency, status
     FROM wallets
     WHERE user_id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [userId]
  );
  return res.rows[0];
};

/**
 * Verrouille le portefeuille actif d'un utilisateur SANS le créer.
 * @returns {Promise<object|null>}
 */
const lockWalletByUserTx = async (client, userId) => {
  const res = await client.query(
    `SELECT id, balance, currency, status
     FROM wallets
     WHERE user_id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [userId]
  );
  return res.rows[0] || null;
};

/**
 * Applique un mouvement (crédit ou débit) à un portefeuille DÉJÀ VERROUILLÉ,
 * met à jour le solde et insère la ligne wallet_transactions.
 * Ne gère pas la transaction (BEGIN/COMMIT) : c'est l'appelant qui l'ouvre.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} wallet - ligne wallet verrouillée (id, balance, status)
 * @param {object} mv
 * @param {'credit'|'debit'} mv.type
 * @param {number} mv.amount - montant strictement positif
 * @param {string} mv.source
 * @param {boolean} [mv.allowNegative=false] - autorise un solde négatif (annulations, débits providers)
 * @returns {Promise<{transaction: object, balance: string}>}
 */
const applyMovementTx = async (client, wallet, mv) => {
  const {
    type,
    amount,
    source,
    category_id,
    reference_type,
    reference_id,
    provider,
    provider_tx_id,
    status = 'completed',
    description,
    metadata,
    reverses_transaction_id = null,
    allowNegative = false,
  } = mv;

  if (!wallet) {
    throw new AppError('Portefeuille introuvable', 404, 'WALLET_NOT_FOUND');
  }
  if (wallet.status !== 'active') {
    throw new AppError("Le portefeuille n'est pas actif", 409, 'WALLET_NOT_ACTIVE');
  }

  // Vérification de solde (uniquement pour les débits applicatifs classiques).
  if (type === 'debit' && !allowNegative && Number(wallet.balance) < Number(amount)) {
    throw new AppError('Solde insuffisant', 400, 'INSUFFICIENT_BALANCE');
  }

  // Le calcul du nouveau solde est fait par PostgreSQL (NUMERIC exact),
  // et récupéré via RETURNING pour renseigner balance_after sans dérive.
  const delta = type === 'credit' ? Number(amount) : -Number(amount);
  const updated = await client.query(
    `UPDATE wallets SET balance = balance + $1, updated_at = now()
     WHERE id = $2
     RETURNING balance`,
    [delta, wallet.id]
  );
  const balanceAfter = updated.rows[0].balance;

  const inserted = await client.query(
    `INSERT INTO wallet_transactions
       (wallet_id, type, source, amount, balance_after, category_id,
        reference_type, reference_id, provider, provider_tx_id, status,
        description, metadata, reverses_transaction_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      wallet.id,
      type,
      source,
      amount,
      balanceAfter,
      category_id || null,
      reference_type || null,
      reference_id || null,
      provider || null,
      provider_tx_id || null,
      status,
      description || null,
      metadata ? JSON.stringify(metadata) : '{}',
      reverses_transaction_id,
    ]
  );

  return { transaction: inserted.rows[0], balance: balanceAfter };
};

// =========================================================================
//  Crédit / Débit
// =========================================================================

/**
 * Crédite le portefeuille d'un utilisateur (revenu manuel, commission,
 * remboursement, confirmation de rechargement...). Verrou FOR UPDATE.
 *
 * @param {string} userId
 * @param {object} data - { amount, source, category_id, reference_type, reference_id, provider, provider_tx_id, description, metadata }
 * @returns {Promise<{transaction: object, balance: string}>}
 */
const creditWallet = async (userId, data) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wallet = await lockOrCreateWalletTx(client, userId);
    const result = await applyMovementTx(client, wallet, { ...data, type: 'credit' });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Débite le portefeuille d'un utilisateur (dépense manuelle, abonnement,
 * achat de crédits, facture...). Vérifie la suffisance du solde. Verrou FOR UPDATE.
 *
 * @param {string} userId
 * @param {object} data
 * @returns {Promise<{transaction: object, balance: string}>}
 */
const debitWallet = async (userId, data) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wallet = await lockOrCreateWalletTx(client, userId);
    const result = await applyMovementTx(client, wallet, { ...data, type: 'debit' });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =========================================================================
//  Annulation (reversal) — jamais de suppression, un mouvement inverse traçable
// =========================================================================

/**
 * Annule une transaction en créant le mouvement inverse et en marquant
 * l'originale `status='reversed'`. La suffisance de solde n'est pas exigée
 * (annuler un crédit déjà dépensé peut rendre le solde négatif — c'est voulu).
 *
 * @param {string} transactionId
 * @param {string} userId - propriétaire (contrôle d'accès)
 * @param {string} [reason]
 * @returns {Promise<{code: string}|{reversal: object, balance: string, original_id: string}>}
 *   un code d'erreur ('TRANSACTION_NOT_FOUND'|'ALREADY_REVERSED'|'NOT_REVERSIBLE'), sinon le résultat.
 */
const reverseTransaction = async (transactionId, userId, reason) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verrou portefeuille d'abord (ordre de verrouillage cohérent avec crédit/débit).
    const wallet = await lockWalletByUserTx(client, userId);
    if (!wallet) {
      await client.query('ROLLBACK');
      return { code: 'TRANSACTION_NOT_FOUND' };
    }

    // Puis la transaction d'origine, verrouillée et rattachée à ce portefeuille.
    const origRes = await client.query(
      `SELECT * FROM wallet_transactions
       WHERE id = $1 AND wallet_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [transactionId, wallet.id]
    );
    const original = origRes.rows[0];
    if (!original) {
      await client.query('ROLLBACK');
      return { code: 'TRANSACTION_NOT_FOUND' };
    }
    if (original.status === 'reversed') {
      await client.query('ROLLBACK');
      return { code: 'ALREADY_REVERSED' };
    }
    if (original.status !== 'completed') {
      await client.query('ROLLBACK');
      return { code: 'NOT_REVERSIBLE' };
    }

    const inverseType = original.type === 'credit' ? 'debit' : 'credit';
    const result = await applyMovementTx(client, wallet, {
      type: inverseType,
      amount: original.amount,
      source: 'reversal',
      category_id: original.category_id,
      reference_type: original.reference_type,
      reference_id: original.reference_id,
      description: reason
        ? `Annulation : ${reason}`
        : `Annulation de la transaction ${original.id}`,
      metadata: { reversed_transaction_id: original.id, reason: reason || null },
      reverses_transaction_id: original.id,
      allowNegative: true,
    });

    await client.query(
      `UPDATE wallet_transactions SET status = 'reversed' WHERE id = $1`,
      [original.id]
    );

    await client.query('COMMIT');
    return { reversal: result.transaction, balance: result.balance, original_id: original.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =========================================================================
//  Webhooks providers — idempotents (log brut d'abord, puis réconciliation)
// =========================================================================

/**
 * Traite un webhook provider de façon idempotente.
 *
 * Phase 1 : journalise le payload brut (provider_transactions) dans sa PROPRE
 *   transaction, committée immédiatement — l'événement n'est jamais perdu.
 *   L'unicité (provider, provider_tx_id) garantit qu'on ne le journalise qu'une fois.
 * Phase 2 : verrouille le portefeuille, applique le crédit/débit, puis réconcilie
 *   (status='processed', wallet_transaction_id renseigné).
 *
 * Un webhook déjà 'processed' → no-op idempotent. Un webhook 'received'/'failed'
 * (Phase 2 précédemment échouée) est retraité.
 *
 * @param {object} p
 * @param {string} p.provider
 * @param {string} p.provider_tx_id
 * @param {object} p.raw_payload
 * @param {string} p.userId
 * @param {number} p.amount
 * @param {'credit'|'debit'} p.direction
 * @param {string} [p.source]
 * @param {string} [p.reference_type]
 * @param {string} [p.reference_id]
 * @param {string} [p.category_id]
 * @param {string} [p.description]
 * @returns {Promise<{duplicate: boolean, transaction?: object, balance?: string, provider_transaction?: object}>}
 */
const processProviderWebhook = async ({
  provider,
  provider_tx_id,
  raw_payload,
  userId,
  amount,
  direction,
  source,
  reference_type,
  reference_id,
  category_id,
  description,
}) => {
  // --- Phase 1 : journalisation brute (transaction courte, committée seule) ---
  let providerRowId;
  const logClient = await pool.connect();
  try {
    await logClient.query('BEGIN');
    const ins = await logClient.query(
      `INSERT INTO provider_transactions (provider, provider_tx_id, user_id, raw_payload, status)
       VALUES ($1, $2, $3, $4, 'received')
       ON CONFLICT (provider, provider_tx_id) DO NOTHING
       RETURNING id`,
      [provider, provider_tx_id, userId || null, raw_payload ? JSON.stringify(raw_payload) : '{}']
    );
    if (ins.rowCount === 0) {
      // Déjà journalisé : est-il déjà traité ?
      const existing = await logClient.query(
        `SELECT id, status, wallet_transaction_id
         FROM provider_transactions
         WHERE provider = $1 AND provider_tx_id = $2`,
        [provider, provider_tx_id]
      );
      await logClient.query('COMMIT');
      if (existing.rows[0].status === 'processed') {
        return { duplicate: true, provider_transaction: existing.rows[0] };
      }
      providerRowId = existing.rows[0].id; // à retraiter
    } else {
      providerRowId = ins.rows[0].id;
      await logClient.query('COMMIT');
    }
  } catch (err) {
    await logClient.query('ROLLBACK');
    throw err;
  } finally {
    logClient.release();
  }

  // --- Phase 2 : réconciliation (verrou journal + portefeuille + mouvement) ---
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verrou sur la ligne du journal : évite deux réconciliations concurrentes.
    const lock = await client.query(
      `SELECT id, status FROM provider_transactions WHERE id = $1 FOR UPDATE`,
      [providerRowId]
    );
    if (lock.rows[0].status === 'processed') {
      await client.query('COMMIT');
      return { duplicate: true, provider_transaction: lock.rows[0] };
    }

    const wallet = await lockOrCreateWalletTx(client, userId);
    const result = await applyMovementTx(client, wallet, {
      type: direction,
      amount,
      source: source || (direction === 'credit' ? 'topup' : 'withdrawal'),
      category_id,
      reference_type,
      reference_id,
      provider,
      provider_tx_id,
      description,
      metadata: { provider, provider_tx_id },
      // Un mouvement provider reflète un paiement déjà acté côté provider :
      // on n'oppose pas la vérif de solde applicative à un débit provider.
      allowNegative: direction === 'debit',
    });

    await client.query(
      `UPDATE provider_transactions
       SET wallet_transaction_id = $1, status = 'processed'
       WHERE id = $2`,
      [result.transaction.id, providerRowId]
    );

    await client.query('COMMIT');
    return { duplicate: false, transaction: result.transaction, balance: result.balance };
  } catch (err) {
    await client.query('ROLLBACK');
    // Best-effort : marquer le journal en échec pour supervision / rejeu ultérieur.
    try {
      await query(
        `UPDATE provider_transactions SET status = 'failed'
         WHERE id = $1 AND status <> 'processed'`,
        [providerRowId]
      );
    } catch (_) {
      /* best-effort, ne pas masquer l'erreur d'origine */
    }
    throw err;
  } finally {
    client.release();
  }
};

// =========================================================================
//  Rechargement (topup) — initiation d'un paiement réel
// =========================================================================

/**
 * Initie un rechargement via un provider. Le crédit réel n'a lieu qu'à la
 * confirmation asynchrone du provider (webhook). On renvoie ici l'URL de
 * paiement à ouvrir côté client.
 *
 * @param {string} userId
 * @param {object} data - { amount, provider }
 * @returns {Promise<object>} infos de paiement (URL de redirection, référence)
 */
const initiateTopup = async (userId, { amount, provider }) => {
  const payment = await initiateProviderPayment({ provider, amount, userId });
  // NB: on ne crée PAS de wallet_transaction 'pending' ici pour éviter tout
  // double comptage. La source de vérité du crédit est le webhook provider.
  return payment;
};

// =========================================================================
//  Consultation : résumé + historique filtré
// =========================================================================

/**
 * Résumé du portefeuille : solde + historique paginé.
 * Si l'utilisateur n'a encore aucun mouvement, renvoie un état vide cohérent
 * (sans créer de portefeuille).
 *
 * @param {string} userId
 * @param {{limit: number, offset: number}} pagination
 * @returns {Promise<{wallet: object, transactions: object[], total: number}>}
 */
const getWalletSummary = async (userId, { limit, offset }) => {
  const walletRes = await query(
    `SELECT id, balance, currency, status, created_at, updated_at
     FROM wallets
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const wallet = walletRes.rows[0];

  if (!wallet) {
    return {
      wallet: { balance: '0.00', currency: 'XOF', status: 'active' },
      transactions: [],
      total: 0,
    };
  }

  const countRes = await query(
    `SELECT count(*)::int AS total
     FROM wallet_transactions
     WHERE wallet_id = $1 AND deleted_at IS NULL`,
    [wallet.id]
  );

  const txRes = await query(
    `SELECT wt.*, c.name AS category_name, c.icon AS category_icon
     FROM wallet_transactions wt
     LEFT JOIN wallet_categories c ON c.id = wt.category_id
     WHERE wt.wallet_id = $1 AND wt.deleted_at IS NULL
     ORDER BY wt.created_at DESC
     LIMIT $2 OFFSET $3`,
    [wallet.id, limit, offset]
  );

  return { wallet, transactions: txRes.rows, total: countRes.rows[0].total };
};

/**
 * Liste filtrée des mouvements (type credit/debit, catégorie, source, période).
 *
 * @param {string} userId
 * @param {object} filters - { type, category_id, source, from, to, limit, offset }
 * @returns {Promise<{transactions: object[], total: number}>}
 */
const listTransactions = async (userId, { type, category_id, source, from, to, limit, offset }) => {
  const walletRes = await query(
    `SELECT id FROM wallets WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const wallet = walletRes.rows[0];
  if (!wallet) return { transactions: [], total: 0 };

  const params = [wallet.id];
  let where = 'wt.wallet_id = $1 AND wt.deleted_at IS NULL';
  if (type) { params.push(type); where += ` AND wt.type = $${params.length}`; }
  if (category_id) { params.push(category_id); where += ` AND wt.category_id = $${params.length}`; }
  if (source) { params.push(source); where += ` AND wt.source = $${params.length}`; }
  if (from) { params.push(from); where += ` AND wt.created_at >= $${params.length}`; }
  if (to) { params.push(to); where += ` AND wt.created_at <= $${params.length}`; }

  const countRes = await query(
    `SELECT count(*)::int AS total FROM wallet_transactions wt WHERE ${where}`,
    params
  );

  const rowsRes = await query(
    `SELECT wt.*, c.name AS category_name, c.icon AS category_icon
     FROM wallet_transactions wt
     LEFT JOIN wallet_categories c ON c.id = wt.category_id
     WHERE ${where}
     ORDER BY wt.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { transactions: rowsRes.rows, total: countRes.rows[0].total };
};

// =========================================================================
//  Catégories (système partagées + personnalisées par utilisateur)
// =========================================================================

/**
 * Liste les catégories visibles par l'utilisateur : les siennes + les catégories
 * système (user_id NULL). Filtre optionnel par type.
 */
const listCategories = async (userId, { type } = {}) => {
  const params = [userId];
  let where = '(user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL';
  if (type) {
    params.push(type);
    where += ` AND type = $${params.length}`;
  }
  const result = await query(
    `SELECT * FROM wallet_categories
     WHERE ${where}
     ORDER BY is_system DESC, name ASC`,
    params
  );
  return result.rows;
};

const createCategory = async (userId, { name, type, icon, color }) => {
  const result = await query(
    `INSERT INTO wallet_categories (user_id, name, type, icon, color, is_system)
     VALUES ($1, $2, $3, $4, $5, false)
     RETURNING *`,
    [userId, name, type, icon || null, color || null]
  );
  return result.rows[0];
};

/**
 * Met à jour une catégorie personnalisée. Les catégories système (is_system)
 * ne sont jamais modifiables par un utilisateur.
 */
const updateCategory = async (id, userId, { name, icon, color }) => {
  const result = await query(
    `UPDATE wallet_categories
     SET name = COALESCE($1, name),
         icon = COALESCE($2, icon),
         color = COALESCE($3, color)
     WHERE id = $4 AND user_id = $5 AND is_system = false AND deleted_at IS NULL
     RETURNING *`,
    [name ?? null, icon ?? null, color ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteCategory = async (id, userId) => {
  const result = await query(
    `UPDATE wallet_categories
     SET deleted_at = now()
     WHERE id = $1 AND user_id = $2 AND is_system = false AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  STUBS providers — À COMPLÉTER avec la doc API de CinetPay / FedaPay
// =========================================================================

/**
 * Vérifie la signature HMAC d'un webhook provider.
 *
 * ⚠️ STUB : chaque provider signe différemment (nom du header, algorithme,
 * encodage, corps exact signé). À implémenter avec la doc de chaque provider.
 * ⚠️ Le HMAC doit porter sur le corps BRUT de la requête : il faut donc capter
 * le raw body (ex: express.json({ verify }) ) — voir wallet.controller.js.
 *
 * @param {string} provider
 * @param {string|Buffer} rawBody
 * @param {string} signature - signature transmise par le provider (header)
 * @returns {boolean}
 */
const verifyWebhookSignature = (provider, rawBody, signature) => {
  const secret = PROVIDER_SECRETS[provider];
  if (!secret) {
    // Fail-closed en production : un webhook non signé ne doit JAMAIS créditer.
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[wallet] ❌ Secret webhook absent pour "${provider}" en production — requête REJETÉE. ` +
        `Configurez ${provider.toUpperCase()}_WEBHOOK_SECRET.`
      );
      return false;
    }
    // Hors production : on ne bloque pas le dev, mais on trace fortement.
    console.warn(
      `[wallet] ⚠️  Aucun secret webhook configuré pour "${provider}" — signature NON vérifiée (dev only)`
    );
    return true;
  }
  // Implémentation générique HMAC-SHA256 hex — À ADAPTER selon le provider.
  const expected = crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
  } catch (_) {
    return false;
  }
};

/**
 * Initie un paiement chez le provider (rechargement).
 *
 * ⚠️ STUB : à remplacer par l'appel réel à l'API CinetPay / FedaPay
 * (création de la transaction, retour de l'URL de paiement et de l'identifiant
 * provider_tx_id réel). La valeur renvoyée ici est FACTICE.
 *
 * @param {object} p - { provider, amount, currency, userId, metadata }
 * @returns {Promise<{provider, provider_tx_id, amount, currency, payment_url, stub}>}
 */
const initiateProviderPayment = async ({ provider, amount, currency = 'XOF' }) => {
  // TODO(provider): appeler l'API réelle et renvoyer l'URL de redirection + id réel.
  const fakeRef = `STUB-${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    provider,
    provider_tx_id: fakeRef,
    amount,
    currency,
    payment_url: `https://checkout.${provider}.example/pay/${fakeRef}`, // factice
    stub: true,
  };
};

module.exports = {
  SUPPORTED_PROVIDERS,
  // helpers transactionnels (pour intégrations intra-process qui doivent créditer
  // le portefeuille DANS leur propre transaction — ex: module Facturation Reçu+).
  // À n'utiliser qu'entre BEGIN et COMMIT d'un client pool.connect().
  lockOrCreateWalletTx,
  applyMovementTx,
  // mouvements
  creditWallet,
  debitWallet,
  reverseTransaction,
  processProviderWebhook,
  initiateTopup,
  // consultation
  getWalletSummary,
  listTransactions,
  // catégories
  listCategories,
  createCategory,
  updateCategory,
  softDeleteCategory,
  // stubs providers
  verifyWebhookSignature,
  initiateProviderPayment,
};
