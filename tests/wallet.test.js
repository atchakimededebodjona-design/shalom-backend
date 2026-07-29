// tests/wallet.test.js
// Tests d'intégration HTTP du module Portefeuille (supertest), au même format
// que les autres suites du backend. Couvre : crédit, débit, solde insuffisant,
// idempotence des webhooks providers et annulation (reversal).
//
// NB (cf. mémoire projet) : les tests tournent sur la même base Supabase que le
// dev. On isole donc par préfixe et on nettoie en beforeAll/afterAll.

const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const PREFIX = 'test-jest-wallet-';
const user = {
  email: `${PREFIX}user@shalom.dev`,
  password: 'Password123!',
  display_name: 'Wallet Tester',
};

const WEBHOOK_TX = `${PREFIX}cinetpay-0001`;

let token;
let userId;
let incomeTxId;

const auth = () => ({ Authorization: `Bearer ${token}` });

// Le webhook vérifie une signature HMAC sur le corps BRUT : on doit donc
// signer exactement la chaîne JSON qu'on envoie (et pas re-sérialiser l'objet
// côté serveur, qui pourrait différer).
const signCinetpay = (bodyObj) => {
  const raw = JSON.stringify(bodyObj);
  const signature = crypto
    .createHmac('sha256', process.env.CINETPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
  return { raw, signature };
};

const cleanup = async () => {
  // provider_transactions n'est pas rattaché en cascade dure à l'utilisateur
  // (user_id ON DELETE SET NULL) : on purge par préfixe d'abord.
  await pool.query('DELETE FROM provider_transactions WHERE provider_tx_id LIKE $1', [`${PREFIX}%`]);
  // wallets / wallet_transactions / wallet_categories partent en cascade avec l'utilisateur.
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
};

describe('Module Wallet (Portefeuille)', () => {
  beforeAll(async () => {
    await cleanup();
    const { verifyRes: res } = await registerAndVerify(user);
    token = res.body.data.tokens.access_token;
    userId = res.body.data.user.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Portefeuille vide', () => {
    it('renvoie un solde 0 sans aucun mouvement', async () => {
      const res = await request(app).get('/api/v1/wallet').set(auth());
      expect(res.statusCode).toBe(200);
      expect(Number(res.body.data.wallet.balance)).toBe(0);
      expect(res.body.data.wallet.currency).toBe('XOF');
      expect(res.body.data.transactions).toEqual([]);
    });

    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/wallet');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Catégories', () => {
    it('liste les catégories système par défaut', async () => {
      const res = await request(app).get('/api/v1/wallet/categories').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.categories.some((c) => c.is_system === true)).toBe(true);
    });

    it('crée une catégorie personnalisée (is_system=false)', async () => {
      const res = await request(app).post('/api/v1/wallet/categories').set(auth())
        .send({ name: 'Transport', type: 'expense', icon: '🚌', color: '#3b82f6' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.category.is_system).toBe(false);
      expect(res.body.data.category.name).toBe('Transport');
    });

    it('refuse un type de catégorie invalide (400)', async () => {
      const res = await request(app).post('/api/v1/wallet/categories').set(auth())
        .send({ name: 'X', type: 'bad' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Crédit / Débit manuels', () => {
    it('enregistre un revenu (crédit) et met le solde à 100000', async () => {
      const res = await request(app).post('/api/v1/wallet/income').set(auth())
        .send({ amount: 100000, description: 'Salaire' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.transaction.type).toBe('credit');
      expect(res.body.data.transaction.source).toBe('manual');
      expect(Number(res.body.data.balance)).toBe(100000);
      incomeTxId = res.body.data.transaction.id;
    });

    it('enregistre une dépense (débit) et décrémente le solde à 70000', async () => {
      const res = await request(app).post('/api/v1/wallet/expense').set(auth())
        .send({ amount: 30000, description: 'Courses' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.transaction.type).toBe('debit');
      expect(Number(res.body.data.balance)).toBe(70000);
    });

    it('refuse une dépense supérieure au solde (400 INSUFFICIENT_BALANCE)', async () => {
      const res = await request(app).post('/api/v1/wallet/expense').set(auth())
        .send({ amount: 10000000 });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
    });

    it('refuse un montant négatif (400)', async () => {
      const res = await request(app).post('/api/v1/wallet/income').set(auth()).send({ amount: -5 });
      expect(res.statusCode).toBe(400);
    });

    it('liste les mouvements filtrés par type=credit', async () => {
      const res = await request(app).get('/api/v1/wallet/transactions?type=credit').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.transactions.every((t) => t.type === 'credit')).toBe(true);
    });
  });

  describe('Webhook provider — idempotence', () => {
    // Fonction (pas une constante) : userId n'est peuplé qu'après beforeAll,
    // donc évalué à chaque appel plutôt qu'au chargement du describe.
    const payload = () => ({ user_id: userId, provider_tx_id: WEBHOOK_TX, amount: 50000, direction: 'credit', source: 'topup' });

    it('rejette une requête sans signature valide (aucun crédit)', async () => {
      const { raw } = signCinetpay(payload());
      const res = await request(app).post('/api/v1/wallet/webhook/cinetpay')
        .set('Content-Type', 'application/json')
        .send(raw); // pas de header x-provider-signature
      expect(res.statusCode).toBe(200); // toujours 200 côté provider
      expect(res.body.received).toBe(true);
      expect(res.body.duplicate).toBeUndefined(); // jamais traité

      const wallet = await request(app).get('/api/v1/wallet').set(auth());
      expect(Number(wallet.body.data.wallet.balance)).toBe(70000); // inchangé
    });

    it('crédite le portefeuille au 1er appel signé (duplicate=false)', async () => {
      const { raw, signature } = signCinetpay(payload());
      const res = await request(app).post('/api/v1/wallet/webhook/cinetpay')
        .set('Content-Type', 'application/json')
        .set('x-provider-signature', signature)
        .send(raw);
      expect(res.statusCode).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.duplicate).toBe(false);
    });

    it('est idempotent au 2e appel identique (duplicate=true)', async () => {
      const { raw, signature } = signCinetpay(payload());
      const res = await request(app).post('/api/v1/wallet/webhook/cinetpay')
        .set('Content-Type', 'application/json')
        .set('x-provider-signature', signature)
        .send(raw);
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(true);
    });

    it("n'a crédité qu'une seule fois : solde = 70000 + 50000 = 120000", async () => {
      const res = await request(app).get('/api/v1/wallet').set(auth());
      expect(Number(res.body.data.wallet.balance)).toBe(120000);
    });

    it('répond 200 même pour un provider inconnu (pas de retry en boucle)', async () => {
      const res = await request(app).post('/api/v1/wallet/webhook/inconnu')
        .send({ user_id: userId, provider_tx_id: `${PREFIX}x`, amount: 1000, direction: 'credit' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Annulation (reversal)', () => {
    it('annule le revenu initial via un mouvement inverse (débit) → solde 20000', async () => {
      const res = await request(app).post(`/api/v1/wallet/transactions/${incomeTxId}/reverse`).set(auth())
        .send({ reason: 'Erreur de saisie' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.reversal.type).toBe('debit');
      expect(res.body.data.reversal.source).toBe('reversal');
      expect(res.body.data.reversal.reverses_transaction_id).toBe(incomeTxId);
      expect(Number(res.body.data.balance)).toBe(20000); // 120000 - 100000
    });

    it('refuse de ré-annuler la même transaction (409 ALREADY_REVERSED)', async () => {
      const res = await request(app).post(`/api/v1/wallet/transactions/${incomeTxId}/reverse`).set(auth());
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('ALREADY_REVERSED');
    });

    it('renvoie 404 pour une transaction inexistante', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/transactions/00000000-0000-0000-0000-000000000000/reverse')
        .set(auth());
      expect(res.statusCode).toBe(404);
    });

    it('renvoie 400 pour un id non-UUID', async () => {
      const res = await request(app).post('/api/v1/wallet/transactions/pas-un-uuid/reverse').set(auth());
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Rechargement (topup — provider en stub)', () => {
    it('renvoie une URL de paiement factice', async () => {
      const res = await request(app).post('/api/v1/wallet/topup').set(auth())
        .send({ amount: 100000, provider: 'fedapay' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payment.payment_url).toContain('fedapay');
      expect(res.body.data.payment.stub).toBe(true);
    });

    it('refuse un provider non supporté (400)', async () => {
      const res = await request(app).post('/api/v1/wallet/topup').set(auth())
        .send({ amount: 1000, provider: 'paypal' });
      expect(res.statusCode).toBe(400);
    });
  });
});
