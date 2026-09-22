// src/modules/wallet/wallet.service.js
// Logique métier du module Portefeuille (Shalom Tools).
//
// Deux natures de mouvements cohabitent dans les mêmes tables :
//   - suivi personnel : revenus/dépenses manuels catégorisés ;
//   - transactions réelles plateforme : rechargements CinetPay/PayGate/FedaPay,
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

// Secret HMAC générique — utilisé UNIQUEMENT par le chemin STUB (FedaPay,
// non encore intégré). CinetPay a son propre mécanisme réel documenté
// (X-TOKEN, cf. computeCinetpayXToken plus bas), distinct de ce stub générique.
const PROVIDER_SECRETS = {
  fedapay: process.env.FEDAPAY_WEBHOOK_SECRET,
};

const SUPPORTED_PROVIDERS = ['cinetpay', 'fedapay', 'paygate'];

// Valeur générique attendue dans le webhook pour signaler un paiement réussi
// (⚠️ STUB : le nom du champ et la valeur réels dépendent du provider — cf.
// normalizeProviderPayload dans wallet.controller.js).
const PAYMENT_STATUS_SUCCESS = 'success';

// =========================================================================
//  CinetPay — intégration réelle (Checkout API), Phase 4C
//
//  Documentation officielle consultée (via recherche — accès direct à
//  docs.cinetpay.com indisponible depuis cet environnement, résultats
//  recoupés sur plusieurs requêtes indépendantes, cohérents entre eux) :
//    - Initialisation : https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation
//    - Notification    : https://docs.cinetpay.com/api/1.0-fr/checkout/notification
//    - Vérification    : https://docs.cinetpay.com/api/1.0-fr/checkout/verification
//    - X-TOKEN HMAC     : https://docs.cinetpay.com/api/1.0-en/checkout/hmac
//
//  Fait documenté central (cité dans la doc officielle) : CinetPay ne
//  transmet PAS le statut réel dans la notification, précisément pour des
//  raisons de sécurité — un appel serveur à l'API de vérification est
//  OBLIGATOIRE avant de considérer un paiement comme réussi. C'est la
//  garantie centrale de cette intégration (cf. reconcileCinetpayNotification).
// =========================================================================

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY;
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID;
// Clé secrète marchande — sert à calculer/vérifier le X-TOKEN HMAC de la
// notification (mécanisme distinct de l'apikey, cf. doc HMAC ci-dessus).
const CINETPAY_SECRET_KEY = process.env.CINETPAY_SECRET_KEY;

const CINETPAY_INIT_URL = 'https://api-checkout.cinetpay.com/v2/payment';
const CINETPAY_CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';
const CINETPAY_HTTP_TIMEOUT_MS = 15000;

// Ordre de concaténation documenté pour le calcul du X-TOKEN (HMAC-SHA256,
// clé = CINETPAY_SECRET_KEY) — cf. doc HMAC ci-dessus.
const CINETPAY_HMAC_FIELDS = [
  'cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount', 'cpm_currency',
  'signature', 'payment_method', 'cel_phone_num', 'cpm_phone_prefixe',
  'cpm_language', 'cpm_version', 'cpm_payment_config', 'cpm_page_action',
  'cpm_custom', 'cpm_designation', 'cpm_error_message',
];

/**
 * Calcule le X-TOKEN attendu pour un corps de notification CinetPay.
 * @param {object} body - req.body de la notification (champs cpm_*)
 * @returns {string|null} hex HMAC-SHA256, ou null si le secret n'est pas configuré
 */
const computeCinetpayXToken = (body) => {
  if (!CINETPAY_SECRET_KEY) return null;
  const data = CINETPAY_HMAC_FIELDS.map((field) => (body[field] !== undefined && body[field] !== null ? String(body[field]) : '')).join('');
  return crypto.createHmac('sha256', CINETPAY_SECRET_KEY).update(data).digest('hex');
};

/**
 * Vérifie le X-TOKEN d'une notification CinetPay. Fail-closed : sans
 * CINETPAY_SECRET_KEY configurée, ou en cas de désaccord, la notification
 * est rejetée — même politique que verifyWebhookSignature pour les autres
 * providers (un webhook est une route publique).
 * @param {object} body
 * @param {string} xToken - header x-token reçu
 * @returns {boolean}
 */
const verifyCinetpayXToken = (body, xToken) => {
  const expected = computeCinetpayXToken(body);
  if (!expected) {
    console.error('[wallet][cinetpay] ❌ CINETPAY_SECRET_KEY absente — notification REJETÉE.');
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(xToken || ''));
  } catch (_) {
    return false;
  }
};

/**
 * Appelle l'API CinetPay avec gestion explicite des erreurs réseau/HTTP —
 * jamais d'exception non contrôlée : les appelants reçoivent soit une
 * réponse exploitable, soit une AppError explicite (jamais un crédit "par
 * défaut" en cas d'échec de la vérification).
 * @param {string} url
 * @param {object} body
 * @returns {Promise<object>} le corps JSON de la réponse CinetPay
 */
const callCinetpayApi = async (url, body) => {
  let response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CINETPAY_HTTP_TIMEOUT_MS);
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (networkError) {
    throw new AppError(
      `Impossible de contacter CinetPay (${networkError.name === 'AbortError' ? 'timeout' : networkError.message})`,
      502,
      'CINETPAY_UNREACHABLE'
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new AppError('Réponse CinetPay invalide (JSON illisible)', 502, 'CINETPAY_INVALID_RESPONSE');
  }

  if (!response.ok) {
    throw new AppError(
      `CinetPay a répondu ${response.status} (${data?.message || 'erreur inconnue'})`,
      502,
      'CINETPAY_HTTP_ERROR'
    );
  }
  return data;
};

/**
 * Initie un paiement réel via l'API Checkout CinetPay.
 *
 * Point clé (Étape 6) : `transaction_id` est choisi PAR SHALOM (pas assigné
 * par CinetPay — leur réponse d'initialisation ne renvoie que
 * payment_token/payment_url, jamais un identifiant différent). On y place
 * directement `wallet_topup_requests.reference` : CinetPay renvoie cette
 * même valeur tel quel dans `cpm_trans_id` à la notification, ce qui donne
 * un lien déterministe CinetPay ↔ SHALOM sans avoir besoin d'un champ
 * "custom"/metadata séparé.
 *
 * @param {{reference: string, amount: number, currency: string, userId: string}} p
 * @returns {Promise<{payment_url: string, payment_token: string, provider_tx_id: string}>}
 */
const initiateCinetpayPayment = async ({ reference, amount, currency }) => {
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new AppError('Intégration CinetPay non configurée (CINETPAY_API_KEY / CINETPAY_SITE_ID manquants)', 500, 'CINETPAY_NOT_CONFIGURED');
  }

  const data = await callCinetpayApi(CINETPAY_INIT_URL, {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: reference,
    amount,
    currency,
    description: 'Rechargement portefeuille SHALOM',
    notify_url: `${process.env.PUBLIC_URL}/api/v1/wallet/webhook/cinetpay`,
    return_url: `${process.env.FRONTEND_URL}/wallet/topup/return`,
    channels: 'ALL',
  });

  if (!data?.data?.payment_url || !data?.data?.payment_token) {
    throw new AppError(`CinetPay n'a pas renvoyé d'URL de paiement (${data?.message || 'réponse incomplète'})`, 502, 'CINETPAY_INVALID_RESPONSE');
  }

  return {
    payment_url: data.data.payment_url,
    payment_token: data.data.payment_token,
    provider_tx_id: reference, // = transaction_id envoyé, CinetPay ne renvoie pas d'ID distinct
  };
};

/**
 * Interroge l'API de vérification CinetPay pour connaître le statut RÉEL
 * d'une transaction — jamais déduit de la notification seule (cf. en-tête
 * de section : c'est le point central de sécurité de cette intégration).
 * @param {string} transactionId
 * @returns {Promise<{status: string, amount: number, currency: string, raw: object}>}
 */
const verifyCinetpayTransaction = async (transactionId) => {
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new AppError('Intégration CinetPay non configurée (CINETPAY_API_KEY / CINETPAY_SITE_ID manquants)', 500, 'CINETPAY_NOT_CONFIGURED');
  }

  const data = await callCinetpayApi(CINETPAY_CHECK_URL, {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: transactionId,
  });

  if (!data?.data?.status) {
    throw new AppError(`Réponse de vérification CinetPay incomplète (${data?.message || 'statut absent'})`, 502, 'CINETPAY_INVALID_RESPONSE');
  }

  return {
    status: data.data.status, // ACCEPTED | REFUSED | PENDING | INITIATED | EXPIRED | UNKNOWN
    amount: Number(data.data.amount),
    currency: data.data.currency,
    raw: data,
  };
};

// Statuts CinetPay documentés (endpoint de vérification) → statut de
// paiement générique déjà utilisé par processProviderWebhook. PENDING et
// INITIATED ne sont ni un succès ni un échec définitif : on n'agit pas
// encore (la notification pourra revenir plus tard avec un statut final).
const CINETPAY_STATUS_MAP = {
  ACCEPTED: PAYMENT_STATUS_SUCCESS,
  REFUSED: 'failed',
  EXPIRED: 'failed',
  UNKNOWN: 'failed',
  PENDING: 'pending',
  INITIATED: 'pending',
};

/**
 * Réconcilie une notification CinetPay reçue sur /webhook/cinetpay.
 *
 * Ordre des opérations (Étape 8/9) :
 *   1. Retrouver la demande de recharge par référence (= cpm_trans_id) —
 *      si introuvable, on s'arrête là (aucun appel CinetPay inutile).
 *   2. Vérifier le paiement auprès de CinetPay (jamais confiance au webhook seul).
 *   3. Ne créditer que si CinetPay confirme ACCEPTED, avec le montant/devise
 *      qu'IL renvoie (jamais ceux du webhook) — la correspondance avec le
 *      montant/devise ATTENDUS (wallet_topup_requests) reste vérifiée par
 *      processProviderWebhook, inchangé depuis la Phase 4B.
 *
 * @param {string} cpmTransId - cpm_trans_id reçu dans la notification
 * @returns {Promise<{duplicate:boolean, rejected?:boolean, reason?:string, transaction?:object, balance?:string}>}
 */
const reconcileCinetpayNotification = async (cpmTransId) => {
  const topupRes = await query('SELECT * FROM wallet_topup_requests WHERE reference = $1', [cpmTransId]);
  const topupRequest = topupRes.rows[0];
  if (!topupRequest) {
    return { duplicate: false, rejected: true, reason: 'REFERENCE_NOT_FOUND' };
  }

  // Idempotence locale AVANT l'appel réseau : une notification déjà
  // traitée (ou une demande déjà close) n'a pas besoin de re-solliciter
  // l'API CinetPay — processProviderWebhook le déciderait de toute façon,
  // mais autant éviter l'appel externe inutile.
  if (topupRequest.status !== 'pending') {
    return {
      duplicate: topupRequest.status === 'completed',
      rejected: topupRequest.status !== 'completed',
      reason: topupRequest.status === 'completed' ? undefined : `TOPUP_ALREADY_${topupRequest.status.toUpperCase()}`,
    };
  }

  const verification = await verifyCinetpayTransaction(cpmTransId);
  const paymentStatus = CINETPAY_STATUS_MAP[verification.status] || 'failed';

  if (paymentStatus === 'pending') {
    // Ni succès ni échec définitif : on ne touche à rien, la notification
    // reviendra (CinetPay peut notifier plusieurs fois, cf. documentation).
    return { duplicate: false, rejected: true, reason: `CINETPAY_STATUS_${verification.status}` };
  }

  return processProviderWebhook({
    provider: 'cinetpay',
    provider_tx_id: cpmTransId,
    raw_payload: verification.raw,
    userId: topupRequest.user_id,
    amount: verification.amount,
    currency: verification.currency,
    direction: 'credit',
    internalReference: cpmTransId,
    paymentStatus,
    source: 'topup',
    description: 'Rechargement CinetPay',
  });
};

// =========================================================================
//  PayGate Global — intégration réelle (FLOOZ / T-Money, Togo)
//
//  Documentation utilisée : guide d'intégration officiel PayGate Global,
//  obtenu après activation d'un compte marchand (non public — pas d'URL de
//  documentation accessible sans compte). Endpoints, champs et codes de
//  statut ci-dessous reproduisent ce guide.
//
//  Fait documenté central, DIFFÉRENT de CinetPay : le guide PayGate Global ne
//  décrit AUCUN mécanisme de signature (HMAC ou autre) pour authentifier ses
//  notifications webhook. La sécurité de cette intégration repose donc
//  entièrement sur deux garanties, jamais sur la notification seule :
//    1. l'identifier reçu doit correspondre à une wallet_topup_requests
//       encore 'pending' (comme pour tous les providers, cf. processProviderWebhook) ;
//    2. le statut est TOUJOURS reconfirmé auprès de PayGate (/api/v1/status)
//       avant tout crédit — jamais déduit du webhook seul.
//  Limitation documentée à part (cf. verifyPaygateTransaction) : /api/v1/status
//  ne renvoie pas de montant, donc — contrairement à CinetPay — PayGate ne
//  peut pas confirmer le montant de façon indépendante du webhook.
// =========================================================================

const PAYGATE_AUTH_TOKEN = process.env.PAYGATE_AUTH_TOKEN;
const PAYGATE_BASE_URL = 'https://paygateglobal.com';
const PAYGATE_PAY_URL = `${PAYGATE_BASE_URL}/api/v1/pay`;
const PAYGATE_STATUS_URL = `${PAYGATE_BASE_URL}/api/v1/status`;
const PAYGATE_STATUS_BY_IDENTIFIER_URL = `${PAYGATE_BASE_URL}/api/v2/status`;
const PAYGATE_HTTP_TIMEOUT_MS = 15000;
const PAYGATE_NETWORKS = ['FLOOZ', 'TMONEY'];

// Codes de statut documentés pour la réponse d'initiation (/api/v1/pay) —
// DIFFÉRENTS des codes de l'endpoint de vérification malgré des valeurs
// numériques identiques (0/2/4/6) : 0 y signifie seulement "transaction
// enregistrée", jamais "payée" (cf. initiatePaygatePayment).
const PAYGATE_INIT_STATUS_REASON = {
  2: 'PAYGATE_AUTH_INVALID',
  4: 'PAYGATE_INVALID_PARAMS',
  6: 'PAYGATE_DUPLICATE',
};

/**
 * Appelle l'API PayGate Global avec gestion explicite des erreurs
 * réseau/HTTP — même politique que callCinetpayApi (jamais d'exception non
 * contrôlée, jamais de crédit "par défaut" en cas d'échec).
 */
const callPaygateApi = async (url, body) => {
  let response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAYGATE_HTTP_TIMEOUT_MS);
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (networkError) {
    throw new AppError(
      `Impossible de contacter PayGate (${networkError.name === 'AbortError' ? 'timeout' : networkError.message})`,
      502,
      'PAYGATE_UNREACHABLE'
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new AppError('Réponse PayGate invalide (JSON illisible)', 502, 'PAYGATE_INVALID_RESPONSE');
  }

  if (!response.ok) {
    throw new AppError(`PayGate a répondu ${response.status}`, 502, 'PAYGATE_HTTP_ERROR');
  }
  return data;
};

/**
 * Initie un paiement PayGate : push USSD FLOOZ/TMONEY vers phoneNumber.
 * Pas de flux "page hébergée" côté /api/v1/pay — l'utilisateur confirme
 * directement sur son téléphone, donc payment_url reste null.
 *
 * `identifier` = wallet_topup_requests.reference (jamais une référence
 * PayGate indépendante) : c'est ce qui permettra de retrouver la demande à
 * la notification ou lors d'une réconciliation par identifier.
 *
 * @param {{reference:string, amount:number, phoneNumber:string, network:string}} p
 * @returns {Promise<{provider_tx_id:string, payment_url:null}>}
 */
const initiatePaygatePayment = async ({ reference, amount, phoneNumber, network }) => {
  if (!PAYGATE_AUTH_TOKEN) {
    throw new AppError('Intégration PayGate non configurée (PAYGATE_AUTH_TOKEN manquant)', 500, 'PAYGATE_NOT_CONFIGURED');
  }
  if (!phoneNumber) {
    throw new AppError('Numéro de téléphone requis pour un paiement PayGate', 400, 'PAYGATE_PHONE_REQUIRED');
  }
  if (!PAYGATE_NETWORKS.includes(network)) {
    throw new AppError(`Réseau PayGate invalide (attendu : ${PAYGATE_NETWORKS.join(', ')})`, 400, 'PAYGATE_INVALID_NETWORK');
  }

  const data = await callPaygateApi(PAYGATE_PAY_URL, {
    auth_token: PAYGATE_AUTH_TOKEN,
    phone_number: phoneNumber,
    amount,
    description: 'Rechargement portefeuille SHALOM',
    identifier: reference,
    network,
  });

  const initStatus = Number(data?.status);
  if (initStatus !== 0) {
    const code = PAYGATE_INIT_STATUS_REASON[initStatus] || `PAYGATE_INIT_STATUS_${Number.isNaN(initStatus) ? 'UNKNOWN' : initStatus}`;
    throw new AppError(`PayGate a refusé l'initiation (${code})`, 502, code);
  }
  if (!data?.tx_reference) {
    throw new AppError("PayGate n'a pas renvoyé de tx_reference (réponse incomplète)", 502, 'PAYGATE_INVALID_RESPONSE');
  }

  return {
    provider_tx_id: String(data.tx_reference),
    payment_url: null,
  };
};

/**
 * Interroge l'API de vérification PayGate par tx_reference (référence
 * PayGate elle-même) — /api/v1/status.
 *
 * ⚠️ LIMITATION DOCUMENTÉE : cette réponse ne contient PAS de montant
 * (contrairement à CinetPay). PayGate ne peut donc pas confirmer le montant
 * de façon indépendante du webhook — cf. reconcilePaygateNotification.
 *
 * @param {string} txReference
 * @returns {Promise<{status:number, identifier:string, tx_reference:string, payment_reference:string, datetime:string, payment_method:string, raw:object}>}
 */
const verifyPaygateTransaction = async (txReference) => {
  if (!PAYGATE_AUTH_TOKEN) {
    throw new AppError('Intégration PayGate non configurée (PAYGATE_AUTH_TOKEN manquant)', 500, 'PAYGATE_NOT_CONFIGURED');
  }
  const data = await callPaygateApi(PAYGATE_STATUS_URL, {
    auth_token: PAYGATE_AUTH_TOKEN,
    tx_reference: txReference,
  });
  if (data?.status === undefined || data?.status === null) {
    throw new AppError('Réponse de vérification PayGate incomplète (statut absent)', 502, 'PAYGATE_INVALID_RESPONSE');
  }
  return {
    status: Number(data.status),
    identifier: data.identifier,
    tx_reference: data.tx_reference,
    payment_reference: data.payment_reference,
    datetime: data.datetime,
    payment_method: data.payment_method,
    raw: data,
  };
};

/**
 * Interroge l'API de vérification PayGate par identifier (référence
 * marchande = wallet_topup_requests.reference) — /api/v2/status. Utilisée
 * pour la réconciliation quand un tx_reference n'est pas disponible
 * (webhook jamais reçu) — cf. reconcilePaygateTopup.
 *
 * @param {string} identifier
 * @returns {Promise<{status:number, identifier:string, tx_reference:string, payment_reference:string, datetime:string, payment_method:string, raw:object}>}
 */
const verifyPaygateByIdentifier = async (identifier) => {
  if (!PAYGATE_AUTH_TOKEN) {
    throw new AppError('Intégration PayGate non configurée (PAYGATE_AUTH_TOKEN manquant)', 500, 'PAYGATE_NOT_CONFIGURED');
  }
  const data = await callPaygateApi(PAYGATE_STATUS_BY_IDENTIFIER_URL, {
    auth_token: PAYGATE_AUTH_TOKEN,
    identifier,
  });
  if (data?.status === undefined || data?.status === null) {
    throw new AppError('Réponse de vérification PayGate incomplète (statut absent)', 502, 'PAYGATE_INVALID_RESPONSE');
  }
  return {
    status: Number(data.status),
    identifier: data.identifier,
    tx_reference: data.tx_reference,
    payment_reference: data.payment_reference,
    datetime: data.datetime,
    payment_method: data.payment_method,
    raw: data,
  };
};

// Statuts PayGate documentés (endpoint de vérification) → statut de paiement
// générique déjà utilisé par processProviderWebhook. 2 (en cours) n'est ni un
// succès ni un échec définitif : on n'agit pas encore. 4 (expiré) et 6
// (annulé) sont tous deux mappés vers 'failed' — même choix que
// CINETPAY_STATUS_MAP (REFUSED/EXPIRED/UNKNOWN → 'failed') : processProviderWebhook
// ne connaît de toute façon qu'un seul statut terminal non-succès ('failed'),
// jamais 'cancelled' (cf. son code, non modifié ici). Documenté comme
// limitation : SHALOM ne distingue pas aujourd'hui "expiré" d'"annulé" dans
// le résultat d'une recharge, quel que soit le provider.
const PAYGATE_STATUS_MAP = {
  0: PAYMENT_STATUS_SUCCESS,
  2: 'pending',
  4: 'failed',
  6: 'failed',
};

/**
 * Réconcilie une notification webhook PayGate reçue sur /webhook/paygate.
 * Suit exactement les 6 étapes de sécurité requises (jamais de confiance
 * dans le webhook seul) :
 *   1. retrouver wallet_topup_requests par reference = identifier ;
 *   2. vérifier webhook.identifier === topup.reference (redondant par
 *      construction avec l'étape 1, vérifié explicitement quand même) ;
 *   3. vérifier webhook.amount === topup.amount (⚠️ seule vérification de
 *      montant possible, cf. verifyPaygateTransaction — LIMITATION) ;
 *   4. interroger PayGate (/api/v1/status) avec tx_reference ;
 *   5. n'accepter que status === 0 ;
 *   6. vérifier que l'identifier renvoyé par PayGate === topup.reference.
 *
 * @param {{tx_reference:string, identifier:string, amount:number}} p
 * @returns {Promise<{duplicate:boolean, rejected?:boolean, reason?:string, transaction?:object, balance?:string}>}
 */
const reconcilePaygateNotification = async ({ tx_reference: txReference, identifier, amount }) => {
  // Étape 1
  const topupRes = await query('SELECT * FROM wallet_topup_requests WHERE reference = $1', [identifier]);
  const topupRequest = topupRes.rows[0];
  if (!topupRequest) {
    return { duplicate: false, rejected: true, reason: 'REFERENCE_NOT_FOUND' };
  }

  // Idempotence locale AVANT tout appel réseau (même principe que CinetPay).
  if (topupRequest.status !== 'pending') {
    return {
      duplicate: topupRequest.status === 'completed',
      rejected: topupRequest.status !== 'completed',
      reason: topupRequest.status === 'completed' ? undefined : `TOPUP_ALREADY_${topupRequest.status.toUpperCase()}`,
    };
  }

  // Étape 2
  if (identifier !== topupRequest.reference) {
    return { duplicate: false, rejected: true, reason: 'IDENTIFIER_MISMATCH' };
  }

  // Étape 3 — LIMITATION DOCUMENTÉE : seule comparaison de montant possible
  // (aucune confirmation indépendante du montant par PayGate). Redoublée par
  // processProviderWebhook, qui refait cette même comparaison plus bas.
  if (Number(topupRequest.amount) !== Number(amount)) {
    return { duplicate: false, rejected: true, reason: 'AMOUNT_MISMATCH' };
  }

  // Étape 4
  const verification = await verifyPaygateTransaction(txReference);

  // Étape 6
  if (verification.identifier !== topupRequest.reference) {
    return { duplicate: false, rejected: true, reason: 'PAYGATE_IDENTIFIER_MISMATCH' };
  }

  // Étape 5 (via le mapping, qui n'accepte que status===0 comme succès)
  const paymentStatus = PAYGATE_STATUS_MAP[verification.status] ?? 'failed';
  if (paymentStatus === 'pending') {
    // status=2 : ni succès ni échec définitif, on ne touche à rien.
    return { duplicate: false, rejected: true, reason: `PAYGATE_STATUS_${verification.status}` };
  }

  return processProviderWebhook({
    provider: 'paygate',
    provider_tx_id: txReference,
    raw_payload: verification.raw,
    userId: topupRequest.user_id,
    amount, // = webhook.amount, déjà vérifié à l'étape 3 (limitation documentée ci-dessus)
    currency: topupRequest.currency, // PayGate ne renvoie pas de devise (FCFA implicite) : pas de vérification indépendante possible
    direction: 'credit',
    internalReference: identifier,
    paymentStatus,
    source: 'topup',
    description: 'Rechargement PayGate',
  });
};

/**
 * Réconciliation "pull" (webhook perdu, timeout, serveur indisponible au
 * moment de la notification...) : interroge PayGate par identifier plutôt
 * que d'attendre un webhook qui ne reviendra peut-être jamais. Réutilise les
 * mêmes garanties que reconcilePaygateNotification (idempotence, contrôle
 * d'identifiant) — pas de second crédit possible même si la vraie
 * notification arrive ensuite (provider_transactions reste unique sur
 * provider+provider_tx_id, wallet_topup_requests passe à 'completed' ici).
 *
 * ⚠️ LIMITATION : /api/v2/status ne renvoie pas non plus de montant. Ici,
 * contrairement au webhook, aucune valeur de montant indépendante n'est
 * disponible du tout : on crédite le montant ATTENDU (wallet_topup_requests.amount),
 * seul montant connu avec certitude dans ce chemin — pas une confirmation
 * indépendante du montant réellement payé.
 *
 * @param {string} reference - wallet_topup_requests.reference
 */
const reconcilePaygateTopup = async (reference) => {
  const topupRes = await query('SELECT * FROM wallet_topup_requests WHERE reference = $1', [reference]);
  const topupRequest = topupRes.rows[0];
  if (!topupRequest) {
    return { duplicate: false, rejected: true, reason: 'REFERENCE_NOT_FOUND' };
  }
  if (topupRequest.status !== 'pending') {
    return {
      duplicate: topupRequest.status === 'completed',
      rejected: topupRequest.status !== 'completed',
      reason: topupRequest.status === 'completed' ? undefined : `TOPUP_ALREADY_${topupRequest.status.toUpperCase()}`,
    };
  }

  const verification = await verifyPaygateByIdentifier(reference);
  if (verification.identifier !== topupRequest.reference) {
    return { duplicate: false, rejected: true, reason: 'PAYGATE_IDENTIFIER_MISMATCH' };
  }
  if (!verification.tx_reference) {
    return { duplicate: false, rejected: true, reason: 'PAYGATE_TX_REFERENCE_MISSING' };
  }

  const paymentStatus = PAYGATE_STATUS_MAP[verification.status] ?? 'failed';
  if (paymentStatus === 'pending') {
    return { duplicate: false, rejected: true, reason: `PAYGATE_STATUS_${verification.status}` };
  }

  return processProviderWebhook({
    provider: 'paygate',
    provider_tx_id: verification.tx_reference,
    raw_payload: verification.raw,
    userId: topupRequest.user_id,
    amount: topupRequest.amount, // limitation ci-dessus : montant attendu, non confirmé indépendamment
    currency: topupRequest.currency,
    direction: 'credit',
    internalReference: reference,
    paymentStatus,
    source: 'topup',
    description: 'Rechargement PayGate (réconciliation)',
  });
};

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
 * Phase 2, si `internalReference` est fourni (recharge initiée via
 *   initiateTopup/createTopupRequest) : verrouille la demande de recharge
 *   correspondante (wallet_topup_requests) DANS LA MÊME transaction que le
 *   crédit, et vérifie AVANT tout crédit que le webhook correspond bien à ce
 *   qui était réellement attendu — référence trouvée, demande encore
 *   'pending', même utilisateur, même montant, même devise. Tout écart est
 *   refusé (aucun crédit) et journalisé (`provider_transactions.status =
 *   'ignored'`), jamais crédité "au mieux". Sans `internalReference` (aucune
 *   demande à vérifier), le webhook est rejeté pour la même raison qu'une
 *   référence introuvable : on ne crédite jamais un montant dont on n'a
 *   aucune trace de demande préalable.
 * Puis : verrouille le portefeuille, applique le crédit/débit, et réconcilie
 *   (status='processed', wallet_transaction_id renseigné, ainsi que la
 *   demande de recharge le cas échéant).
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
 * @param {string} [p.currency='XOF']
 * @param {'credit'|'debit'} p.direction
 * @param {string|null} [p.internalReference] - référence wallet_topup_requests.reference attendue dans le payload
 * @param {string} [p.paymentStatus='success'] - statut du paiement signalé par le provider
 * @param {string} [p.source]
 * @param {string} [p.reference_type]
 * @param {string} [p.reference_id]
 * @param {string} [p.category_id]
 * @param {string} [p.description]
 * @returns {Promise<{duplicate: boolean, rejected?: boolean, reason?: string, transaction?: object, balance?: string, provider_transaction?: object}>}
 */
const processProviderWebhook = async ({
  provider,
  provider_tx_id,
  raw_payload,
  userId,
  amount,
  currency = 'XOF',
  direction,
  internalReference = null,
  paymentStatus = PAYMENT_STATUS_SUCCESS,
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

  // --- Phase 2 : réconciliation (verrou journal + demande de recharge + portefeuille + mouvement) ---
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

    const reject = async (providerTxStatus, reason) => {
      await client.query(`UPDATE provider_transactions SET status = $1 WHERE id = $2`, [providerTxStatus, providerRowId]);
      await client.query('COMMIT');
      return { duplicate: false, rejected: true, reason };
    };

    // --- Vérification de la demande de recharge attendue AVANT tout crédit ---
    // On ne crédite jamais "au mieux" : sans demande correspondante vérifiée,
    // on ne connaît ni le montant, ni la devise, ni l'utilisateur réellement
    // attendus — le webhook est alors indiscernable d'une tentative de fraude.
    let topupRequest = null;
    if (!internalReference) {
      return await reject('ignored', 'REFERENCE_MISSING');
    }

    const topupRes = await client.query(
      `SELECT * FROM wallet_topup_requests WHERE reference = $1 FOR UPDATE`,
      [internalReference]
    );
    topupRequest = topupRes.rows[0] || null;

    if (!topupRequest) {
      return await reject('ignored', 'REFERENCE_NOT_FOUND');
    }
    if (topupRequest.status === 'completed') {
      // Déjà réconciliée par un webhook antérieur (provider_tx_id différent
      // pour le même paiement, ex. retry provider) : idempotent, pas de second crédit.
      return await reject('processed', 'TOPUP_ALREADY_COMPLETED');
    }
    if (topupRequest.status !== 'pending') {
      // 'failed' ou 'cancelled' : demande définitivement close, on ne la ranime pas.
      return await reject('ignored', `TOPUP_ALREADY_${topupRequest.status.toUpperCase()}`);
    }
    if (topupRequest.user_id !== userId) {
      return await reject('ignored', 'USER_MISMATCH');
    }
    if (Number(topupRequest.amount) !== Number(amount)) {
      return await reject('ignored', 'AMOUNT_MISMATCH');
    }
    if (topupRequest.currency !== currency) {
      return await reject('ignored', 'CURRENCY_MISMATCH');
    }
    if (paymentStatus !== PAYMENT_STATUS_SUCCESS) {
      await client.query(
        `UPDATE wallet_topup_requests SET status = 'failed', updated_at = now() WHERE id = $1`,
        [topupRequest.id]
      );
      return await reject('failed', 'PAYMENT_FAILED');
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
      metadata: { provider, provider_tx_id, internal_reference: internalReference },
      // Un mouvement provider reflète un paiement déjà acté côté provider :
      // on n'oppose pas la vérif de solde applicative à un débit provider.
      allowNegative: direction === 'debit',
    });

    await client.query(
      `UPDATE provider_transactions
       SET wallet_transaction_id = $1, status = 'processed', wallet_topup_request_id = $2
       WHERE id = $3`,
      [result.transaction.id, topupRequest.id, providerRowId]
    );

    await client.query(
      `UPDATE wallet_topup_requests
       SET status = 'completed', wallet_id = $1, wallet_transaction_id = $2, updated_at = now()
       WHERE id = $3`,
      [wallet.id, result.transaction.id, topupRequest.id]
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
 * Génère une référence interne de recharge — l'ancre stable transmise au
 * provider (donnée personnalisée / metadata) et que son webhook devra nous
 * renvoyer pour qu'on retrouve CETTE demande précise.
 */
const generateTopupReference = () => `WLT-${crypto.randomUUID()}`;

/**
 * Crée une demande de recharge en attente ("pending"), AVANT tout appel au
 * provider. C'est cette ligne — pas le webhook — qui définit ce qui est
 * réellement attendu (montant, devise, utilisateur) : le webhook ne pourra
 * créditer que s'il correspond exactement à une demande pending existante
 * (cf. processProviderWebhook).
 *
 * @param {string} userId
 * @param {{amount: number, currency?: string, provider: string}} data
 * @returns {Promise<object>} la ligne wallet_topup_requests créée
 */
const createTopupRequest = async (userId, { amount, currency = 'XOF', provider }) => {
  const { rows } = await query(
    `INSERT INTO wallet_topup_requests (user_id, reference, provider, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [userId, generateTopupReference(), provider, amount, currency]
  );
  return rows[0];
};

/**
 * Initie un rechargement via un provider. Le crédit réel n'a lieu qu'à la
 * confirmation asynchrone du provider (webhook), et seulement si elle
 * correspond à la demande créée ici (référence, montant, devise, utilisateur).
 * On renvoie ici l'URL de paiement à ouvrir côté client.
 *
 * @param {string} userId
 * @param {object} data - { amount, provider, currency?, phoneNumber?, network? }
 *   phoneNumber/network : requis uniquement pour provider='paygate' (push
 *   USSD vers ce numéro) — sans équivalent pour cinetpay/fedapay (redirection).
 * @returns {Promise<object>} infos de paiement (URL de redirection, référence)
 */
const initiateTopup = async (userId, { amount, provider, currency = 'XOF', phoneNumber, network }) => {
  const topupRequest = await createTopupRequest(userId, { amount, currency, provider });

  // topupRequest.reference est transmise au provider (transaction_id pour
  // CinetPay, identifier pour PayGate) — c'est ce lien qui permet de
  // vérifier montant/devise/utilisateur avant tout crédit (cf.
  // reconcileCinetpayNotification / reconcilePaygateNotification).
  let payment;
  try {
    payment = await initiateProviderPayment({
      provider, amount, currency, userId, reference: topupRequest.reference, phoneNumber, network,
    });
  } catch (error) {
    // Étape 5 : ne jamais laisser une demande 'pending' sans pouvoir
    // comprendre qu'aucune transaction provider n'a été créée. provider_tx_id
    // reste NULL : un admin distingue ainsi cet échec d'initiation d'un
    // paiement réellement décliné par le provider (qui, lui, aurait un
    // provider_tx_id renseigné).
    await query(
      `UPDATE wallet_topup_requests SET status = 'failed', updated_at = now() WHERE id = $1`,
      [topupRequest.id]
    );
    throw error;
  }

  if (payment.provider_tx_id && !payment.stub) {
    await query(
      `UPDATE wallet_topup_requests SET provider_tx_id = $1, updated_at = now() WHERE id = $2`,
      [payment.provider_tx_id, topupRequest.id]
    );
  }

  return { ...payment, reference: topupRequest.reference, topup_request_id: topupRequest.id };
};

/**
 * Liste les demandes de recharge, tous utilisateurs confondus (admin,
 * observabilité — diagnostiquer pending/completed/failed/cancelled).
 * @param {{page?:number, limit?:number, status?:string}} options
 */
const adminListTopupRequests = async (options = {}) => {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 20;
  const offset = (page - 1) * limit;

  const params = [];
  let where = '1=1';
  if (options.status) {
    params.push(options.status);
    where += ` AND r.status = $${params.length}`;
  }

  const countResult = await query(`SELECT count(*)::int AS total FROM wallet_topup_requests r WHERE ${where}`, params);

  const dataResult = await query(
    `SELECT r.*, u.email AS user_email
     FROM wallet_topup_requests r
     JOIN users u ON u.id = r.user_id
     WHERE ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    topups: dataResult.rows,
    pagination: { page, limit, total: countResult.rows[0].total, total_pages: Math.ceil(countResult.rows[0].total / limit) },
  };
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
    // Fail-closed dans TOUS les environnements (dev inclus) : un webhook est une
    // route publique qui crédite un portefeuille sur la seule foi du payload —
    // sans secret configuré, un attaquant peut forger n'importe quel crédit.
    console.error(
      `[wallet] ❌ Secret webhook absent pour "${provider}" — requête REJETÉE. ` +
      `Configurez ${provider.toUpperCase()}_WEBHOOK_SECRET.`
    );
    return false;
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
 * ⚠️ STUB pour FedaPay uniquement : à remplacer par l'appel réel à son API
 * (création de la transaction, retour de l'URL de paiement et de l'identifiant
 * provider_tx_id réel). La valeur renvoyée pour fedapay est FACTICE.
 * cinetpay et paygate sont des intégrations réelles.
 *
 * @param {object} p - { provider, amount, currency, userId, reference, phoneNumber?, network? }
 * @returns {Promise<{provider, provider_tx_id, amount, currency, payment_url, stub}>}
 */
const initiateProviderPayment = async ({ provider, amount, currency = 'XOF', reference, phoneNumber, network }) => {
  if (provider === 'cinetpay') {
    // Intégration réelle (cf. section CinetPay en tête de fichier) — pas un stub.
    const result = await initiateCinetpayPayment({ reference, amount, currency });
    return { provider, ...result, currency, stub: false };
  }

  if (provider === 'paygate') {
    // Intégration réelle (cf. section PayGate Global en tête de fichier) — pas un stub.
    const result = await initiatePaygatePayment({ reference, amount, phoneNumber, network });
    return { provider, ...result, currency, stub: false };
  }

  // FedaPay : toujours un STUB, hors périmètre de cette phase.
  // TODO(fedapay): appeler l'API réelle et renvoyer l'URL de redirection + id réel.
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
  PAYMENT_STATUS_SUCCESS,
  // mouvements
  creditWallet,
  debitWallet,
  reverseTransaction,
  processProviderWebhook,
  // recharges (topup)
  createTopupRequest,
  initiateTopup,
  adminListTopupRequests,
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
  // CinetPay (intégration réelle)
  verifyCinetpayXToken,
  computeCinetpayXToken,
  reconcileCinetpayNotification,
  verifyCinetpayTransaction,
  // PayGate Global (intégration réelle)
  reconcilePaygateNotification,
  reconcilePaygateTopup,
  verifyPaygateTransaction,
  verifyPaygateByIdentifier,
};
