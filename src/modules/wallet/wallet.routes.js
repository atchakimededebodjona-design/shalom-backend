// src/modules/wallet/wallet.routes.js
// Routes du module Portefeuille (Outils Shalom).
//
// ⚠️ Ordre important : la route publique /webhook/:provider est déclarée AVANT
// router.use(authenticate) — un provider n'envoie pas de JWT. Toutes les autres
// routes sont protégées et cloisonnées à l'utilisateur connecté.

const { Router } = require('express');
const controller = require('./wallet.controller');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');
const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');
const {
  listTransactionsValidator,
  incomeValidator,
  expenseValidator,
  topupValidator,
  reverseValidator,
  createCategoryValidator,
  updateCategoryValidator,
  idParamValidator,
  adminListTopupsValidator,
} = require('./wallet.validator');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Portefeuille — solde, mouvements crédit/débit, catégories, rechargements, webhooks providers (FCFA / XOF)
 */

// =========================================================================
//  Route PUBLIQUE — webhook provider (AVANT authenticate)
// =========================================================================

/**
 * @swagger
 * /api/v1/wallet/webhook/{provider}:
 *   post:
 *     summary: Callback d'un provider de paiement (CinetPay/PayGate/FedaPay)
 *     description: >
 *       Endpoint public appelé par le provider. Aucune authentification JWT.
 *       Traitement idempotent (contrainte UNIQUE provider + provider_tx_id).
 *       Répond TOUJOURS 200, même en cas d'erreur interne, pour éviter les
 *       retries en boucle (les erreurs sont journalisées côté serveur).
 *
 *       **cinetpay** (intégration réelle) : la notification transmet
 *       `cpm_trans_id` (= la référence SHALOM) et un header `x-token`
 *       (HMAC-SHA256 sur les champs cpm_* documentés par CinetPay). Le
 *       statut réel n'est JAMAIS déduit de cette notification : SHALOM
 *       interroge systématiquement l'API de vérification CinetPay avant tout
 *       crédit (la notification elle-même ne contient pas de statut fiable,
 *       par choix de sécurité de CinetPay).
 *
 *       **paygate** (intégration réelle) : la notification transmet
 *       `tx_reference`, `identifier` (= la référence SHALOM), `amount`,
 *       `datetime`, `payment_method`, `phone_number`. Le guide d'intégration
 *       PayGate Global ne documente AUCUNE signature de webhook — SHALOM ne
 *       fait donc JAMAIS confiance à cette notification seule : le statut est
 *       systématiquement reconfirmé auprès de PayGate (`/api/v1/status`) via
 *       `tx_reference` avant tout crédit, avec vérification croisée de
 *       `identifier` et du montant (limitation documentée : PayGate ne
 *       renvoie pas de montant à la vérification, donc le montant du webhook
 *       est comparé au montant attendu par SHALOM, pas confirmé par PayGate
 *       lui-même).
 *
 *       **fedapay** : reste un chemin générique STUB (signature HMAC
 *       `x-provider-signature` sur le corps brut) — non intégré.
 *     tags: [Wallet]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [cinetpay, paygate, fedapay] }
 *       - in: header
 *         name: x-token
 *         schema: { type: string }
 *         description: "cinetpay uniquement : HMAC-SHA256 des champs cpm_* (clé = CINETPAY_SECRET_KEY)"
 *       - in: header
 *         name: x-provider-signature
 *         schema: { type: string }
 *         description: "fedapay uniquement (STUB) : signature HMAC du corps brut"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Payload brut du provider (format propre à chaque provider)
 *     responses:
 *       200: { description: Événement reçu (received=true, duplicate=bool) }
 */
router.post('/webhook/:provider', controller.handleWebhook);

// =========================================================================
//  À partir d'ici : authentification requise
// =========================================================================
router.use(authenticate);

/**
 * @swagger
 * /api/v1/wallet/admin/topups:
 *   get:
 *     summary: "[Admin] Lister les demandes de recharge, tous utilisateurs confondus (diagnostic pending/completed/failed/cancelled)"
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, completed, failed, cancelled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Liste paginée des demandes de recharge }
 *       403: { description: Accès réservé aux administrateurs }
 */
// Déclarée AVANT requireActiveSubscription (comme les routes admin de
// shalom-tv.routes.js) : un admin diagnostiquant des paiements n'a pas à
// avoir lui-même un abonnement actif.
router.get('/admin/topups', requireAdmin, adminListTopupsValidator, controller.adminListTopups);

router.use(requireActiveSubscription);

/**
 * @swagger
 * /api/v1/wallet:
 *   get:
 *     summary: Résumé du portefeuille (solde + historique paginé)
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Solde, devise, statut et transactions paginées }
 *       401: { description: Non authentifié }
 */
router.get('/', controller.getWallet);

/**
 * @swagger
 * /api/v1/wallet/transactions:
 *   get:
 *     summary: Lister les mouvements (filtres ?type= ?source= ?category_id= ?from= ?to=, paginé)
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [credit, debit] }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [manual, topup, withdrawal, subscription, credit_purchase, invoice, commission, refund, reversal, adjustment] }
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Liste paginée des mouvements }
 */
router.get('/transactions', listTransactionsValidator, controller.listTransactions);

/**
 * @swagger
 * /api/v1/wallet/income:
 *   post:
 *     summary: Enregistrer un revenu manuel (crédite le portefeuille)
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, example: 50000 }
 *               category_id: { type: string, format: uuid }
 *               description: { type: string, example: 'Salaire juillet' }
 *               reference_type: { type: string }
 *               reference_id: { type: string, format: uuid }
 *     responses:
 *       201: { description: Revenu enregistré (transaction + nouveau solde) }
 *       400: { description: Validation }
 */
router.post('/income', incomeValidator, controller.createIncome);

/**
 * @swagger
 * /api/v1/wallet/expense:
 *   post:
 *     summary: Enregistrer une dépense manuelle (débite le portefeuille)
 *     description: Échoue avec 400 INSUFFICIENT_BALANCE si le solde est insuffisant.
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, example: 15000 }
 *               category_id: { type: string, format: uuid }
 *               description: { type: string, example: 'Courses' }
 *               reference_type: { type: string }
 *               reference_id: { type: string, format: uuid }
 *     responses:
 *       201: { description: Dépense enregistrée (transaction + nouveau solde) }
 *       400: { description: Validation ou solde insuffisant }
 */
router.post('/expense', expenseValidator, controller.createExpense);

/**
 * @swagger
 * /api/v1/wallet/topup:
 *   post:
 *     summary: Initier un rechargement réel via un provider (CinetPay/PayGate/FedaPay)
 *     description: >
 *       Renvoie une URL de paiement (cinetpay) ou déclenche un push USSD
 *       (paygate — payment_url reste null, l'utilisateur confirme sur son
 *       téléphone). Le crédit effectif n'a lieu qu'à la confirmation
 *       asynchrone du provider (webhook). ⚠️ fedapay reste en STUB.
 *
 *       **paygate** : `phone_number` et `network` (FLOOZ ou TMONEY) sont
 *       requis. Le numéro est celui saisi par l'utilisateur à cet instant —
 *       SHALOM ne conserve pas de numéro mobile money par compte.
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, provider]
 *             properties:
 *               amount: { type: number, example: 100000 }
 *               provider: { type: string, enum: [cinetpay, paygate, fedapay] }
 *               phone_number: { type: string, example: '90010203', description: 'Requis pour paygate uniquement' }
 *               network: { type: string, enum: [FLOOZ, TMONEY], description: 'Requis pour paygate uniquement' }
 *     responses:
 *       200: { description: Rechargement initié (payment_url + provider_tx_id) }
 *       400: { description: Validation }
 */
router.post('/topup', topupValidator, controller.initiateTopup);

/**
 * @swagger
 * /api/v1/wallet/transactions/{id}/reverse:
 *   post:
 *     summary: Annuler une transaction (crée un mouvement inverse traçable)
 *     description: L'originale passe en status='reversed' ; rien n'est supprimé.
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: 'Erreur de saisie' }
 *     responses:
 *       200: { description: Transaction annulée (mouvement inverse + nouveau solde) }
 *       404: { description: Transaction introuvable }
 *       409: { description: Déjà annulée ou non annulable }
 */
router.post('/transactions/:id/reverse', reverseValidator, controller.reverseTransaction);

/**
 * @swagger
 * /api/v1/wallet/categories:
 *   get:
 *     summary: Lister les catégories (système + personnelles ; filtre ?type=income|expense)
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Liste des catégories } }
 *   post:
 *     summary: Créer une catégorie personnalisée
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string, example: 'Transport' }
 *               type: { type: string, enum: [income, expense] }
 *               icon: { type: string, example: '🚌' }
 *               color: { type: string, example: '#3b82f6' }
 *     responses:
 *       201: { description: Catégorie créée }
 *       400: { description: Validation }
 */
router.get('/categories', controller.listCategories);
router.post('/categories', createCategoryValidator, controller.createCategory);

/**
 * @swagger
 * /api/v1/wallet/categories/{id}:
 *   patch:
 *     summary: Mettre à jour une catégorie personnalisée (catégories système non modifiables)
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Catégorie mise à jour }
 *       404: { description: Introuvable ou non modifiable }
 *   delete:
 *     summary: Supprimer (soft delete) une catégorie personnalisée
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Catégorie supprimée }
 *       404: { description: Introuvable ou non supprimable }
 */
router.patch('/categories/:id', updateCategoryValidator, controller.updateCategory);
router.delete('/categories/:id', idParamValidator, controller.deleteCategory);

module.exports = router;
