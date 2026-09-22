// src/modules/subscriptions/subscriptions.service.js
// Cycle de vie des abonnements SHALOM (subscriptions).
//
// Modèle repris tel que documenté dans 011_subscriptions_ambassador_module.sql :
// chaque (ré)abonnement INSERT une nouvelle ligne (journal, jamais de mise à
// jour destructive d'une période déjà écrite) ; le statut d'accès réel est
// toujours dérivé à la volée (status='active' AND expires_at>now()), jamais
// mis à jour par un job — l'expiration est donc implicite.
//
// IMPORTANT — ce qui N'EST PAS couvert ici (documenté, pas inventé) :
// aucun tarif réel n'existe nulle part dans le projet pour les plans
// mensuel/trimestriel/semestriel/annuel (recherche exhaustive : aucune
// occurrence de prix). Il n'existe donc pas de paiement en ligne automatisé
// pour l'instant (l'intégration provider — CinetPay/FedaPay — reste au stade
// de stub dans le module wallet, hors périmètre de ce chantier). L'activation
// ci-dessous est donc déclenchée par confirmation MANUELLE d'un paiement réel
// par un administrateur (mobile money, virement...), avec `payment_reference`
// comme preuve d'idempotence — même principe que `provider_transactions` pour
// le wallet. C'est un mécanisme réel (pas un contournement du gate), conçu
// pour être remplacé par un webhook automatique le jour où un provider de
// paiement est réellement branché, sans changer ce service.

const { pool, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');
const ambassadorService = require('../ambassador/ambassador.service');

const TRIAL_DAYS = 7;

// 'legacy' est réservé à la rétrocompatibilité posée par la migration 011
// (comptes déjà existants au moment de son exécution) — jamais assignable via
// une activation.
const PLAN_DURATION_DAYS = {
  mensuel: 30,
  trimestriel: 90,
  semestriel: 180,
  annuel: 365,
};
const PAID_PLANS = Object.keys(PLAN_DURATION_DAYS);

/**
 * Abonnement actif courant d'un utilisateur (ou null).
 * @param {string} userId
 * @param {import('pg').PoolClient|{query:Function}} [db] - connexion à utiliser (transaction ou pool par défaut)
 */
const getActiveSubscription = async (userId, db = { query }) => {
  const result = await db.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1 AND status = 'active' AND expires_at > now()
     ORDER BY expires_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Statut d'accès complet d'un utilisateur : abonnement actif, sinon essai
 * gratuit en cours, sinon aucun accès. Source de vérité unique, réutilisée
 * par le middleware requireActiveSubscription et par GET /subscriptions/status.
 * @param {string} userId
 * @returns {Promise<{access:boolean, reason:'active_subscription'|'trial'|'expired', subscription:object|null, trial_ends_at:string|null, days_remaining:number|null}>}
 */
const getSubscriptionStatus = async (userId) => {
  const subscription = await getActiveSubscription(userId);
  if (subscription) {
    return { access: true, reason: 'active_subscription', subscription, trial_ends_at: null, days_remaining: null };
  }

  const userRes = await query('SELECT created_at FROM users WHERE id = $1', [userId]);
  const createdAt = userRes.rows[0]?.created_at;
  if (createdAt) {
    const trialEndsAt = new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    if (trialEndsAt > now) {
      const daysRemaining = Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000));
      return { access: true, reason: 'trial', subscription: null, trial_ends_at: trialEndsAt.toISOString(), days_remaining: daysRemaining };
    }
  }

  return { access: false, reason: 'expired', subscription: null, trial_ends_at: null, days_remaining: null };
};

/**
 * Déclenche la commission ambassadeur associée à une NOUVELLE activation
 * d'abonnement (jamais appelé pour une activation idempotente : la
 * protection anti-double-commission de premier niveau est donc de ne
 * l'appeler qu'une fois par ligne `subscriptions` réellement insérée ; le
 * second niveau est l'index unique sur ambassador_commissions.subscription_id,
 * migration 033, pour couvrir une commission déjà créée par un appel antérieur).
 *
 * Le type d'événement ('subscription' = premier abonnement du filleul,
 * 'renewal' = abonnement suivant) est déterminé par le statut réel du
 * parrainage plutôt qu'inventé : tant que `referrals.status` vaut
 * 'registered', c'est la toute première conversion payante de ce filleul.
 *
 * Effet secondaire best-effort, exécuté APRÈS le COMMIT de l'abonnement :
 * une erreur ici ne doit jamais priver l'utilisateur de l'accès qu'il vient
 * de payer (même principe que le webhook wallet, qui journalise puis
 * réconcilie en deux temps plutôt qu'en une seule transaction géante).
 * @param {string} userId
 * @param {object} subscription - ligne `subscriptions` nouvellement créée
 */
const triggerAmbassadorCommission = async (userId, subscription) => {
  try {
    const referralResult = await query(
      `SELECT status FROM referrals WHERE referred_user_id = $1`,
      [userId]
    );
    if (referralResult.rows.length === 0) return; // Pas de parrain → rien à faire

    const eventType = referralResult.rows[0].status === 'registered' ? 'subscription' : 'renewal';
    await ambassadorService.createCommissionForSubscription(
      userId,
      subscription.id,
      subscription.amount,
      eventType
    );
  } catch (error) {
    console.error(
      `Erreur lors du calcul de la commission ambassadeur pour l'abonnement ${subscription.id} (abonnement non affecté) :`,
      error
    );
  }
};

/**
 * Active (ou renouvelle) l'abonnement d'un utilisateur suite à la
 * confirmation d'un paiement réel. Idempotent sur `payment_reference` : un
 * second appel avec la même référence renvoie la ligne déjà créée au lieu
 * d'en créer une seconde (équivalent d'un webhook reçu deux fois).
 *
 * Renouvellement : si un abonnement actif existe déjà, la nouvelle période
 * démarre à la fin de l'actuelle (aucun jour payé perdu) au lieu de redémarrer
 * à `now()`.
 *
 * @param {{ userId: string, plan: string, amount: number, paymentReference: string }} params
 * @returns {Promise<{subscription: object, idempotent: boolean}>}
 */
const activateSubscription = async ({ userId, plan, amount, paymentReference }) => {
  if (!PAID_PLANS.includes(plan)) {
    throw new AppError(`Plan invalide. Valeurs acceptées : ${PAID_PLANS.join(', ')}`, 400, 'INVALID_PLAN');
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError('Le montant doit être un entier positif (FCFA)', 400, 'INVALID_AMOUNT');
  }
  if (!paymentReference || typeof paymentReference !== 'string' || !paymentReference.trim()) {
    throw new AppError('La référence de paiement est requise', 400, 'MISSING_PAYMENT_REFERENCE');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userCheck = await client.query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (userCheck.rowCount === 0) {
      throw new AppError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
    }

    // Idempotence : cette référence de paiement a-t-elle déjà été traitée ?
    const existing = await client.query(
      'SELECT * FROM subscriptions WHERE payment_reference = $1',
      [paymentReference.trim()]
    );
    if (existing.rowCount > 0) {
      await client.query('COMMIT');
      return { subscription: existing.rows[0], idempotent: true };
    }

    // Verrouille l'abonnement actif courant (s'il existe) pour éviter une
    // activation concurrente qui calculerait la même base de départ deux fois.
    const currentResult = await client.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND expires_at > now()
       ORDER BY expires_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );
    const current = currentResult.rows[0] || null;
    const startedAt = current ? new Date(current.expires_at) : new Date();
    const expiresAt = new Date(startedAt.getTime() + PLAN_DURATION_DAYS[plan] * 24 * 60 * 60 * 1000);

    const inserted = await client.query(
      `INSERT INTO subscriptions (user_id, plan, amount, started_at, expires_at, status, payment_reference)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       RETURNING *`,
      [userId, plan, amount, startedAt.toISOString(), expiresAt.toISOString(), paymentReference.trim()]
    );

    await client.query('COMMIT');

    const subscription = inserted.rows[0];
    await triggerAmbassadorCommission(userId, subscription);

    return { subscription, idempotent: false };
  } catch (error) {
    await client.query('ROLLBACK');
    // Filet de sécurité si deux requêtes concurrentes passent le contrôle
    // d'idempotence en même temps : la contrainte UNIQUE sur payment_reference
    // (migration 032) refuse le doublon au niveau base — on le traite alors
    // comme le cas idempotent plutôt que de renvoyer une erreur 500.
    if (error.code === '23505') {
      const existing = await query('SELECT * FROM subscriptions WHERE payment_reference = $1', [paymentReference.trim()]);
      if (existing.rows[0]) {
        return { subscription: existing.rows[0], idempotent: true };
      }
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Annule l'abonnement actif d'un utilisateur (effet immédiat : l'accès est
 * révoqué dès l'annulation, pas seulement à `expires_at` — cf. limitation
 * documentée dans le rapport : aucune règle produit "annulation en fin de
 * période" n'est définie ailleurs dans le projet).
 * @param {string} userId
 */
const cancelSubscription = async (userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND expires_at > now()
       ORDER BY expires_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );
    if (currentResult.rowCount === 0) {
      throw new AppError('Aucun abonnement actif à annuler', 404, 'NO_ACTIVE_SUBSCRIPTION');
    }

    const updated = await client.query(
      `UPDATE subscriptions SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [currentResult.rows[0].id]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  TRIAL_DAYS,
  PAID_PLANS,
  PLAN_DURATION_DAYS,
  getActiveSubscription,
  getSubscriptionStatus,
  activateSubscription,
  cancelSubscription,
};
