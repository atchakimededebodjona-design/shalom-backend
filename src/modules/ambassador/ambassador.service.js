// src/modules/ambassador/ambassador.service.js
// Logique métier du Programme Ambassadeur SHALOM.
//
// Deux niveaux :
//   - Standard  : 10% sur abonnement, 5% sur renouvellement
//   - Certifié  : 15% sur abonnement, 10% sur renouvellement
//
// Règles :
//   - Seuil de retrait minimum : 5 000 FCFA
//   - Seuil de retrait maximum mensuel : 500 000 FCFA (conformité UEMOA)
//   - Montants stockés en FCFA entier (jamais de décimales)
//   - Soft delete uniquement

'use strict';

const crypto = require('crypto');
const { pool, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// =========================================================================
// Constantes métier
// =========================================================================
const MIN_WITHDRAWAL_AMOUNT = 5_000;   // FCFA
const MAX_MONTHLY_WITHDRAWAL = 500_000; // FCFA — conformité UEMOA
const CERTIFICATION_THRESHOLD = 10;    // Parrainages qualifiés requis

// =========================================================================
// Utilitaires internes
// =========================================================================

/**
 * Génère un code de parrainage unique au format SHLM-XXXXXX
 * @returns {string}
 */
const generateReferralCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SHLM-';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
};

/**
 * Génère un code unique en vérifiant l'unicité en base
 * @param {object} client - Client de connexion PG
 * @returns {Promise<string>}
 */
const generateUniqueReferralCode = async (client) => {
  let code;
  let attempts = 0;
  do {
    code = generateReferralCode();
    const { rows } = await client.query(
      'SELECT id FROM ambassador_profiles WHERE referral_code = $1',
      [code]
    );
    if (rows.length === 0) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    throw new AppError('Impossible de générer un code unique, réessayez', 500, 'CODE_GENERATION_FAILED');
  }
  return code;
};

// =========================================================================
// 1. Profil Ambassadeur
// =========================================================================

/**
 * Rejoindre le programme ambassadeur
 * @param {string} userId
 * @param {object} data - { bio? }
 * @returns {Promise<object>} ambassador_profile
 */
const joinProgram = async (userId, data = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Vérifier que l'utilisateur n'est pas déjà ambassadeur
    const existing = await client.query(
      'SELECT id FROM ambassador_profiles WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (existing.rows.length > 0) {
      throw new AppError('Vous êtes déjà inscrit au programme ambassadeur', 409, 'ALREADY_AMBASSADOR');
    }

    // Générer un code de parrainage unique
    const referralCode = await generateUniqueReferralCode(client);

    // Créer le profil ambassadeur
    const { rows } = await client.query(
      `INSERT INTO ambassador_profiles
         (user_id, level, status, referral_code, bio)
       VALUES ($1, 'standard', 'active', $2, $3)
       RETURNING *`,
      [userId, referralCode, data.bio || null]
    );

    // Mettre à jour le profil utilisateur (is_ambassador = true)
    await client.query(
      'UPDATE profiles SET is_ambassador = TRUE WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Récupérer le profil ambassadeur d'un utilisateur
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const getMyProfile = async (userId) => {
  let { rows } = await query(
    `SELECT ap.*,
            p.display_name, p.avatar_url,
            u.email
     FROM ambassador_profiles ap
     JOIN profiles p ON p.user_id = ap.user_id
     JOIN users   u ON u.id       = ap.user_id
     WHERE ap.user_id = $1 AND ap.deleted_at IS NULL`,
    [userId]
  );

  // Auto-inscription si le profil n'existe pas (anciens utilisateurs)
  if (rows.length === 0) {
    await joinProgram(userId);
    const result = await query(
      `SELECT ap.*,
              p.display_name, p.avatar_url,
              u.email
       FROM ambassador_profiles ap
       JOIN profiles p ON p.user_id = ap.user_id
       JOIN users   u ON u.id       = ap.user_id
       WHERE ap.user_id = $1 AND ap.deleted_at IS NULL`,
      [userId]
    );
    rows = result.rows;
  }

  return rows[0] || null;
};

/**
 * Mettre à jour le profil ambassadeur (bio uniquement côté ambassadeur)
 * @param {string} userId
 * @param {object} data - { bio }
 * @returns {Promise<object>}
 */
const updateMyProfile = async (userId, data) => {
  const { rows } = await query(
    `UPDATE ambassador_profiles
     SET bio        = COALESCE($1, bio),
         updated_at = now()
     WHERE user_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [data.bio || null, userId]
  );
  if (!rows[0]) {
    throw new AppError('Profil ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }
  return rows[0];
};

// =========================================================================
// 2. Tableau de bord
// =========================================================================

/**
 * Dashboard ambassadeur : résumé complet
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getDashboard = async (userId) => {
  const profile = await getMyProfile(userId);
  if (!profile) {
    throw new AppError('Profil ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }

  const ambassadorId = profile.id;

  // Commissions du mois en cours
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [monthlyResult, pendingResult, paidResult, referralsResult] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM ambassador_commissions
       WHERE ambassador_id = $1
         AND period_month  = $2
         AND status IN ('approved', 'paid')
         AND deleted_at IS NULL`,
      [ambassadorId, currentMonth]
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM ambassador_commissions
       WHERE ambassador_id = $1 AND status = 'pending' AND deleted_at IS NULL`,
      [ambassadorId]
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM ambassador_commissions
       WHERE ambassador_id = $1 AND status = 'paid' AND deleted_at IS NULL`,
      [ambassadorId]
    ),
    query(
      `SELECT status, COUNT(*) AS count
       FROM referrals
       WHERE ambassador_id = $1
       GROUP BY status`,
      [ambassadorId]
    ),
  ]);

  const referralStats = {};
  for (const row of referralsResult.rows) {
    referralStats[row.status] = parseInt(row.count, 10);
  }

  return {
    profile: {
      id:                profile.id,
      level:             profile.level,
      status:            profile.status,
      referral_code:     profile.referral_code,
      display_name:      profile.display_name,
      avatar_url:        profile.avatar_url,
      total_referrals:   profile.total_referrals,
      total_earnings:    parseInt(profile.total_earnings, 10),
      available_balance: parseInt(profile.available_balance, 10),
      joined_at:         profile.joined_at,
      certified_at:      profile.certified_at,
    },
    stats: {
      commissions_this_month: parseInt(monthlyResult.rows[0].total, 10),
      commissions_pending:    parseInt(pendingResult.rows[0].total, 10),
      commissions_pending_count: parseInt(pendingResult.rows[0].count, 10),
      commissions_paid_total: parseInt(paidResult.rows[0].total, 10),
      available_balance:      parseInt(profile.available_balance, 10),
      referrals:              referralStats,
    },
    certification: {
      is_certified:        profile.level === 'certified',
      qualified_referrals: profile.total_referrals,
      threshold:           CERTIFICATION_THRESHOLD,
      progress_pct:        Math.min(100, Math.round((profile.total_referrals / CERTIFICATION_THRESHOLD) * 100)),
    },
  };
};

// =========================================================================
// 3. Parrainages
// =========================================================================

/**
 * Récupérer le lien de parrainage
 * @param {string} userId
 * @param {string} baseUrl - URL de base du frontend ex: https://shalom.app
 * @returns {Promise<object>}
 */
const getReferralLink = async (userId, baseUrl) => {
  const profile = await getMyProfile(userId);
  if (!profile) {
    throw new AppError('Profil ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }

  const url = `${baseUrl}/register?ref=${profile.referral_code}`;
  return {
    referral_code: profile.referral_code,
    referral_url:  url,
    whatsapp_url:  `https://wa.me/?text=${encodeURIComponent(`Rejoins SHALOM, la plateforme chrétienne francophone pour les jeunes d'Afrique 🕊️\n${url}`)}`,
  };
};

/**
 * Lister les parrainages d'un ambassadeur (paginé)
 * @param {string} userId
 * @param {object} options - { page, limit, status }
 * @returns {Promise<object>}
 */
const listReferrals = async (userId, options = {}) => {
  const profile = await getMyProfile(userId);
  if (!profile) {
    throw new AppError('Profil ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }

  const page   = parseInt(options.page, 10)  || 1;
  const limit  = parseInt(options.limit, 10) || 20;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE r.ambassador_id = $1';
  const params = [profile.id];
  let paramIdx = 2;

  // Jointures nécessaires pour le COUNT et le SELECT
  const joins = `
     FROM referrals r
     JOIN users u ON u.id = r.referred_user_id
     JOIN profiles p ON p.user_id = r.referred_user_id
  `;

  if (options.status) {
    if (options.status === 'expired') {
      whereClause += ` AND r.status IN ('subscribed', 'qualified') AND p.plan = 'free'`;
    } else {
      whereClause += ` AND r.status = $${paramIdx}`;
      params.push(options.status);
      paramIdx++;
    }
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total ${joins} ${whereClause}`,
    params
  );

  const dataResult = await query(
    `SELECT r.*,
            p.display_name, p.avatar_url, p.plan, u.email
     ${joins}
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    referrals: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Enregistrer un parrainage lors de l'inscription d'un utilisateur
 * (appelé depuis auth.service.js au moment du register)
 * @param {string} referredUserId - L'ID de l'utilisateur nouvellement inscrit
 * @param {string} referralCode   - Le code de parrainage utilisé
 * @param {object} clientPg       - Client de connexion PG (transaction parente)
 * @returns {Promise<void>}
 */
const recordReferral = async (referredUserId, referralCode, clientPg) => {
  // Trouver l'ambassadeur correspondant au code
  const { rows } = await clientPg.query(
    `SELECT id, user_id FROM ambassador_profiles
     WHERE referral_code = $1 AND status = 'active' AND deleted_at IS NULL`,
    [referralCode]
  );

  if (rows.length === 0) return; // Code invalide ou ambassadeur inactif → on ignore silencieusement

  const ambassador = rows[0];

  // Éviter l'auto-parrainage
  if (ambassador.user_id === referredUserId) return;

  // Insérer le parrainage (UNIQUE referred_user_id → un seul parrainage par utilisateur)
  await clientPg.query(
    `INSERT INTO referrals (ambassador_id, referred_user_id, source, status)
     VALUES ($1, $2, 'code', 'registered')
     ON CONFLICT DO NOTHING`,
    [ambassador.id, referredUserId]
  );

  // Mettre à jour referred_by sur le profil
  await clientPg.query(
    'UPDATE profiles SET referred_by = $1 WHERE user_id = $2',
    [ambassador.user_id, referredUserId]
  );
};

// =========================================================================
// 4. Commissions
// =========================================================================

/**
 * Calculer et créer une commission lors d'un abonnement payant
 * (appelé depuis billing.service.js / subscription handler)
 * @param {string} subscribedUserId  - L'utilisateur qui s'abonne
 * @param {string} subscriptionId    - L'ID de l'abonnement
 * @param {number} subscriptionAmount - Montant de l'abonnement (FCFA)
 * @param {string} eventType         - 'subscription' | 'renewal'
 * @returns {Promise<object|null>} La commission créée, ou null si aucun parrain
 */
const createCommissionForSubscription = async (
  subscribedUserId,
  subscriptionId,
  subscriptionAmount,
  eventType = 'subscription'
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Trouver le parrainage qualifié
    const referralResult = await client.query(
      `SELECT r.id AS referral_id, r.ambassador_id,
              ap.level, ap.user_id AS ambassador_user_id
       FROM referrals r
       JOIN ambassador_profiles ap ON ap.id = r.ambassador_id
       WHERE r.referred_user_id = $1
         AND ap.status = 'active'
         AND ap.deleted_at IS NULL`,
      [subscribedUserId]
    );

    if (referralResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null; // Pas de parrain → aucune commission
    }

    const { referral_id, ambassador_id, level } = referralResult.rows[0];

    // 2. Récupérer le taux applicable
    const rateResult = await client.query(
      `SELECT rate FROM ambassador_commission_rates
       WHERE level = $1 AND event_type = $2 AND is_active = TRUE
       ORDER BY plan NULLS LAST
       LIMIT 1`,
      [level, eventType]
    );

    if (rateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null; // Aucun taux configuré → on ignore
    }

    const rate = parseFloat(rateResult.rows[0].rate);
    const commissionAmount = Math.ceil(subscriptionAmount * rate / 100); // Arrondi supérieur

    const currentMonth = new Date().toISOString().slice(0, 7);

    // 3. Créer la commission
    const commResult = await client.query(
      `INSERT INTO ambassador_commissions
         (ambassador_id, referred_user_id, subscription_id, type, amount, rate_applied, status, period_month)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [ambassador_id, subscribedUserId, subscriptionId, eventType, commissionAmount, rate, currentMonth]
    );

    const commission = commResult.rows[0];

    // 4. Mettre à jour le statut du parrainage → 'subscribed'
    await client.query(
      `UPDATE referrals
       SET status = 'subscribed', updated_at = now()
       WHERE id = $1 AND status = 'registered'`,
      [referral_id]
    );

    // 5. Mettre à jour les compteurs ambassadeur (total_earnings en attente)
    await client.query(
      `UPDATE ambassador_profiles
       SET updated_at = now()
       WHERE id = $1`,
      [ambassador_id]
    );

    await client.query('COMMIT');
    return commission;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Approuver une commission et créditer le solde de l'ambassadeur
 * (action admin)
 * @param {string} commissionId
 * @returns {Promise<object>}
 */
const approveCommission = async (commissionId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verrouiller la commission
    const commResult = await client.query(
      `SELECT * FROM ambassador_commissions
       WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [commissionId]
    );

    if (commResult.rows.length === 0) {
      throw new AppError('Commission introuvable', 404, 'COMMISSION_NOT_FOUND');
    }

    const commission = commResult.rows[0];

    if (commission.status !== 'pending') {
      throw new AppError(
        `La commission est déjà en statut "${commission.status}"`,
        409,
        'COMMISSION_INVALID_STATUS'
      );
    }

    // Approuver et créditer le solde
    await client.query(
      `UPDATE ambassador_commissions
       SET status = 'approved', updated_at = now()
       WHERE id = $1`,
      [commissionId]
    );

    const updatedProfile = await client.query(
      `UPDATE ambassador_profiles
       SET available_balance = available_balance + $1,
           total_earnings    = total_earnings + $1,
           updated_at        = now()
       WHERE id = $2
       RETURNING *`,
      [commission.amount, commission.ambassador_id]
    );

    // Mettre à jour total_referrals si c'est le premier abonnement de ce filleul
    if (commission.type === 'subscription') {
      const qualifiedCount = await client.query(
        `SELECT COUNT(*) AS cnt FROM referrals
         WHERE ambassador_id = $1 AND status IN ('subscribed', 'qualified')`,
        [commission.ambassador_id]
      );
      await client.query(
        `UPDATE ambassador_profiles
         SET total_referrals = $1, updated_at = now()
         WHERE id = $2`,
        [parseInt(qualifiedCount.rows[0].cnt, 10), commission.ambassador_id]
      );

      // Mise à jour parrainage → qualified
      await client.query(
        `UPDATE referrals SET status = 'qualified', updated_at = now()
         WHERE ambassador_id = $1 AND referred_user_id = $2`,
        [commission.ambassador_id, commission.referred_user_id]
      );
    }

    await client.query('COMMIT');

    return {
      commission_id: commissionId,
      amount:        commission.amount,
      new_balance:   updatedProfile.rows[0].available_balance,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Lister les commissions d'un ambassadeur (paginé)
 * @param {string} userId
 * @param {object} options - { page, limit, status, month }
 * @returns {Promise<object>}
 */
const listMyCommissions = async (userId, options = {}) => {
  const profile = await getMyProfile(userId);
  if (!profile) {
    throw new AppError('Profil ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }

  const page   = parseInt(options.page, 10)  || 1;
  const limit  = parseInt(options.limit, 10) || 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE c.ambassador_id = $1 AND c.deleted_at IS NULL';
  const params = [profile.id];
  let idx = 2;

  if (options.status) {
    where += ` AND c.status = $${idx++}`;
    params.push(options.status);
  }
  if (options.month) {
    where += ` AND c.period_month = $${idx++}`;
    params.push(options.month);
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM ambassador_commissions c ${where}`,
    params
  );

  const dataResult = await query(
    `SELECT c.*,
            p.display_name AS referred_display_name
     FROM ambassador_commissions c
     LEFT JOIN profiles p ON p.user_id = c.referred_user_id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    commissions: dataResult.rows,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

/**
 * Résumé des commissions par statut
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getCommissionSummary = async (userId) => {
  const profile = await getMyProfile(userId);
  if (!profile) {
    throw new AppError('Profil ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }

  const { rows } = await query(
    `SELECT status,
            COUNT(*)         AS count,
            COALESCE(SUM(amount), 0) AS total
     FROM ambassador_commissions
     WHERE ambassador_id = $1 AND deleted_at IS NULL
     GROUP BY status`,
    [profile.id]
  );

  const summary = { pending: {count:0,total:0}, approved: {count:0,total:0}, paid: {count:0,total:0}, cancelled: {count:0,total:0} };
  for (const row of rows) {
    summary[row.status] = {
      count: parseInt(row.count, 10),
      total: parseInt(row.total, 10),
    };
  }

  return {
    ...summary,
    available_balance: profile.available_balance,
    total_earnings:    profile.total_earnings,
  };
};

// =========================================================================
// 5. Retraits Mobile Money
// =========================================================================

/**
 * Demander un retrait
 * @param {string} userId
 * @param {object} data - { amount, phone_number, operator }
 * @returns {Promise<object>}
 */
const requestWithdrawal = async (userId, data) => {
  const { amount, phone_number, operator } = data;
  const withdrawalAmount = parseInt(amount, 10);

  if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Le montant minimum de retrait est ${MIN_WITHDRAWAL_AMOUNT.toLocaleString('fr-FR')} FCFA`,
      400,
      'WITHDRAWAL_AMOUNT_TOO_LOW'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Récupérer et verrouiller le profil ambassadeur
    const profileResult = await client.query(
      `SELECT * FROM ambassador_profiles
       WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
       FOR UPDATE`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      throw new AppError('Profil ambassadeur introuvable ou inactif', 404, 'AMBASSADOR_NOT_FOUND');
    }

    const profile = profileResult.rows[0];

    // Vérifier le solde disponible
    if (profile.available_balance < withdrawalAmount) {
      throw new AppError(
        `Solde insuffisant. Solde disponible : ${profile.available_balance.toLocaleString('fr-FR')} FCFA`,
        400,
        'INSUFFICIENT_BALANCE'
      );
    }

    // Vérifier le plafond mensuel UEMOA
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyWithdrawals = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM ambassador_withdrawals
       WHERE ambassador_id  = $1
         AND status         IN ('pending', 'processing', 'completed')
         AND TO_CHAR(requested_at, 'YYYY-MM') = $2
         AND deleted_at IS NULL`,
      [profile.id, currentMonth]
    );

    const monthlyTotal = parseInt(monthlyWithdrawals.rows[0].total, 10);
    if (monthlyTotal + withdrawalAmount > MAX_MONTHLY_WITHDRAWAL) {
      throw new AppError(
        `Plafond mensuel UEMOA atteint (${MAX_MONTHLY_WITHDRAWAL.toLocaleString('fr-FR')} FCFA/mois). Déjà retiré ce mois : ${monthlyTotal.toLocaleString('fr-FR')} FCFA`,
        400,
        'MONTHLY_LIMIT_EXCEEDED'
      );
    }

    // Débiter le solde
    await client.query(
      `UPDATE ambassador_profiles
       SET available_balance = available_balance - $1, updated_at = now()
       WHERE id = $2`,
      [withdrawalAmount, profile.id]
    );

    // Créer la demande de retrait
    const { rows } = await client.query(
      `INSERT INTO ambassador_withdrawals
         (ambassador_id, amount, method, phone_number, operator, status)
       VALUES ($1, $2, 'mobile_money', $3, $4, 'pending')
       RETURNING *`,
      [profile.id, withdrawalAmount, phone_number, operator || 'other']
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Lister les retraits d'un ambassadeur
 * @param {string} userId
 * @param {object} options - { page, limit, status }
 * @returns {Promise<object>}
 */
const listMyWithdrawals = async (userId, options = {}) => {
  const profile = await getMyProfile(userId);
  if (!profile) {
    throw new AppError('Profil ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }

  const page   = parseInt(options.page, 10)  || 1;
  const limit  = parseInt(options.limit, 10) || 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE w.ambassador_id = $1 AND w.deleted_at IS NULL';
  const params = [profile.id];
  let idx = 2;

  if (options.status) {
    where += ` AND w.status = $${idx++}`;
    params.push(options.status);
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM ambassador_withdrawals w ${where}`,
    params
  );

  const dataResult = await query(
    `SELECT * FROM ambassador_withdrawals w
     ${where}
     ORDER BY w.requested_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    withdrawals: dataResult.rows,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

// =========================================================================
// 6. Routes Admin
// =========================================================================

/**
 * Lister tous les ambassadeurs (admin)
 * @param {object} options - { page, limit, level, status }
 * @returns {Promise<object>}
 */
const adminListAmbassadors = async (options = {}) => {
  const page   = parseInt(options.page, 10)  || 1;
  const limit  = parseInt(options.limit, 10) || 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE ap.deleted_at IS NULL';
  const params = [];
  let idx = 1;

  if (options.level) {
    where += ` AND ap.level = $${idx++}`;
    params.push(options.level);
  }
  if (options.status) {
    where += ` AND ap.status = $${idx++}`;
    params.push(options.status);
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM ambassador_profiles ap ${where}`,
    params
  );

  const dataResult = await query(
    `SELECT ap.*,
            p.display_name, p.avatar_url, u.email
     FROM ambassador_profiles ap
     JOIN profiles p ON p.user_id = ap.user_id
     JOIN users   u ON u.id       = ap.user_id
     ${where}
     ORDER BY ap.total_earnings DESC, ap.joined_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    ambassadors: dataResult.rows,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

/**
 * Changer le niveau d'un ambassadeur (admin)
 * @param {string} ambassadorId
 * @param {string} level - 'standard' | 'certified'
 * @returns {Promise<object>}
 */
const adminSetLevel = async (ambassadorId, level) => {
  const validLevels = ['standard', 'certified'];
  if (!validLevels.includes(level)) {
    throw new AppError(`Niveau invalide. Valeurs acceptées : ${validLevels.join(', ')}`, 400, 'INVALID_LEVEL');
  }

  const { rows } = await query(
    `UPDATE ambassador_profiles
     SET level        = $1,
         certified_at = CASE WHEN $1 = 'certified' THEN now() ELSE certified_at END,
         updated_at   = now()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [level, ambassadorId]
  );

  if (!rows[0]) {
    throw new AppError('Ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }
  return rows[0];
};

/**
 * Changer le statut d'un ambassadeur (admin)
 * @param {string} ambassadorId
 * @param {string} status - 'active' | 'suspended' | 'pending_review'
 * @returns {Promise<object>}
 */
const adminSetStatus = async (ambassadorId, status) => {
  const validStatuses = ['active', 'suspended', 'pending_review'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}`, 400, 'INVALID_STATUS');
  }

  const { rows } = await query(
    `UPDATE ambassador_profiles
     SET status = $1, updated_at = now()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [status, ambassadorId]
  );

  if (!rows[0]) {
    throw new AppError('Ambassadeur introuvable', 404, 'AMBASSADOR_NOT_FOUND');
  }
  return rows[0];
};

/**
 * Traiter un retrait (admin : compléter ou rejeter)
 * @param {string} withdrawalId
 * @param {object} data - { status: 'completed'|'failed'|'cancelled', reference?, admin_notes? }
 * @returns {Promise<object>}
 */
const adminProcessWithdrawal = async (withdrawalId, data) => {
  const { status, reference, admin_notes } = data;
  const validStatuses = ['processing', 'completed', 'failed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    throw new AppError(`Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}`, 400, 'INVALID_STATUS');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const withdrawalResult = await client.query(
      `SELECT * FROM ambassador_withdrawals
       WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [withdrawalId]
    );

    if (withdrawalResult.rows.length === 0) {
      throw new AppError('Demande de retrait introuvable', 404, 'WITHDRAWAL_NOT_FOUND');
    }

    const withdrawal = withdrawalResult.rows[0];

    // Si échec ou annulation → recréditer le solde
    if ((status === 'failed' || status === 'cancelled') &&
        (withdrawal.status === 'pending' || withdrawal.status === 'processing')) {
      await client.query(
        `UPDATE ambassador_profiles
         SET available_balance = available_balance + $1, updated_at = now()
         WHERE id = $2`,
        [withdrawal.amount, withdrawal.ambassador_id]
      );
    }

    const { rows } = await client.query(
      `UPDATE ambassador_withdrawals
       SET status       = $1,
           reference    = COALESCE($2, reference),
           admin_notes  = COALESCE($3, admin_notes),
           processed_at = CASE WHEN $1 IN ('completed', 'failed', 'cancelled') THEN now() ELSE processed_at END,
           updated_at   = now()
       WHERE id = $4
       RETURNING *`,
      [status, reference || null, admin_notes || null, withdrawalId]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Lister toutes les commissions (admin) avec filtres
 * @param {object} options - { page, limit, status, month, ambassador_id }
 * @returns {Promise<object>}
 */
const adminListCommissions = async (options = {}) => {
  const page   = parseInt(options.page, 10)  || 1;
  const limit  = parseInt(options.limit, 10) || 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE c.deleted_at IS NULL';
  const params = [];
  let idx = 1;

  if (options.status) {
    where += ` AND c.status = $${idx++}`;
    params.push(options.status);
  }
  if (options.month) {
    where += ` AND c.period_month = $${idx++}`;
    params.push(options.month);
  }
  if (options.ambassador_id) {
    where += ` AND c.ambassador_id = $${idx++}`;
    params.push(options.ambassador_id);
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM ambassador_commissions c ${where}`,
    params
  );

  const dataResult = await query(
    `SELECT c.*,
            pa.display_name  AS ambassador_name,
            pr.display_name  AS referred_name
     FROM ambassador_commissions c
     JOIN ambassador_profiles ap ON ap.id = c.ambassador_id
     JOIN profiles pa ON pa.user_id = ap.user_id
     LEFT JOIN profiles pr ON pr.user_id = c.referred_user_id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    commissions: dataResult.rows,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

// =========================================================================
// Exports
// =========================================================================
module.exports = {
  // Profil
  joinProgram,
  getMyProfile,
  updateMyProfile,
  // Dashboard
  getDashboard,
  // Parrainages
  getReferralLink,
  listReferrals,
  recordReferral,          // Appelé par auth.service.js
  // Commissions
  createCommissionForSubscription, // Appelé par billing/subscription service
  approveCommission,
  listMyCommissions,
  getCommissionSummary,
  // Retraits
  requestWithdrawal,
  listMyWithdrawals,
  // Admin
  adminListAmbassadors,
  adminSetLevel,
  adminSetStatus,
  adminProcessWithdrawal,
  adminListCommissions,
};
