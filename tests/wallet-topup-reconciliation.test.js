// tests/wallet-topup-reconciliation.test.js
// Phase 4B — vérifie qu'un webhook ne peut créditer un wallet que s'il
// correspond exactement à une demande de recharge réellement initiée
// (wallet_topup_requests) : bon utilisateur, bon montant, bonne devise,
// référence connue, statut pending.
//
// Utilise le provider fedapay (chemin générique, encore un STUB) : cette
// suite teste la logique de réconciliation de processProviderWebhook,
// indépendante du provider. cinetpay est désormais une intégration réelle
// avec son propre mécanisme (X-TOKEN + vérification serveur obligatoire),
// testée séparément dans tests/wallet-cinetpay.test.js (Phase 4C).

const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const PREFIX = 'test-jest-topuprecon-';
const admin = { email: `${PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Admin TopupRecon' };
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'User TopupRecon' };
const otherUser = { email: `${PREFIX}other@shalom.dev`, password: 'Password123!', display_name: 'Other TopupRecon' };

let tokenAdmin, token, userId, tokenOther, otherUserId;

const auth = (t) => ({ Authorization: `Bearer ${t}` });

const sign = (raw) => crypto.createHmac('sha256', process.env.FEDAPAY_WEBHOOK_SECRET).update(raw).digest('hex');

const sendWebhook = async (bodyObj) => {
  const raw = JSON.stringify(bodyObj);
  return request(app)
    .post('/api/v1/wallet/webhook/fedapay')
    .set('Content-Type', 'application/json')
    .set('x-provider-signature', sign(raw))
    .send(raw);
};

const cleanup = async () => {
  await pool.query('DELETE FROM provider_transactions WHERE provider_tx_id LIKE $1', [`${PREFIX}%`]);
  await pool.query(
    `DELETE FROM wallet_topup_requests WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [`${PREFIX}%`]
  );
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
};

describe('Wallet — réconciliation des recharges (Phase 4B)', () => {
  beforeAll(async () => {
    await cleanup();
    process.env.ADMIN_EMAILS = admin.email;

    const { verifyRes: adminRes } = await registerAndVerify(admin);
    tokenAdmin = adminRes.body.data.tokens.access_token;

    const { verifyRes: userRes } = await registerAndVerify(user);
    token = userRes.body.data.tokens.access_token;
    userId = userRes.body.data.user.id;

    const { verifyRes: otherRes } = await registerAndVerify(otherUser);
    tokenOther = otherRes.body.data.tokens.access_token;
    otherUserId = otherRes.body.data.user.id;
  });

  afterAll(cleanup);

  describe('Initiation — création de la demande pending', () => {
    it("POST /wallet/topup crée une ligne wallet_topup_requests 'pending' avec le montant/devise demandés", async () => {
      const res = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 25000, provider: 'fedapay' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payment.reference).toMatch(/^WLT-/);

      const row = await pool.query('SELECT * FROM wallet_topup_requests WHERE reference = $1', [res.body.data.payment.reference]);
      expect(row.rows[0].status).toBe('pending');
      expect(parseFloat(row.rows[0].amount)).toBe(25000);
      expect(row.rows[0].currency).toBe('XOF');
      expect(row.rows[0].user_id).toBe(userId);
    });
  });

  describe('Montant', () => {
    let reference;
    beforeAll(async () => {
      const res = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 10000, provider: 'fedapay' });
      reference = res.body.data.payment.reference;
    });

    it('un montant différent du montant attendu ne crédite PAS', async () => {
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}amt-wrong`, amount: 100000, direction: 'credit', reference });
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(false); // reçu et rejeté, pas un doublon d'un webhook déjà traité

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0]?.balance ?? '0').toBe(before.rows[0]?.balance ?? '0');

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending'); // toujours en attente, pas consommée
    });

    it('le montant exact attendu crédite correctement', async () => {
      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}amt-right`, amount: 10000, direction: 'credit', reference });
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(false);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('completed');
    });
  });

  describe('Devise', () => {
    it('une devise différente de celle attendue ne crédite PAS', async () => {
      const initRes = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 5000, provider: 'fedapay' });
      const reference = initRes.body.data.payment.reference;

      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}cur-wrong`, amount: 5000, currency: 'USD', direction: 'credit', reference });
      expect(res.statusCode).toBe(200);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0].balance).toBe(before.rows[0].balance);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });
  });

  describe('Utilisateur', () => {
    it("un webhook portant l'ID d'un AUTRE utilisateur que celui de la demande ne crédite personne", async () => {
      const initRes = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 8000, provider: 'fedapay' });
      const reference = initRes.body.data.payment.reference;

      const res = await sendWebhook({ user_id: otherUserId, provider_tx_id: `${PREFIX}user-wrong`, amount: 8000, direction: 'credit', reference });
      expect(res.statusCode).toBe(200);

      const otherWallet = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [otherUserId]);
      expect(otherWallet.rows.length).toBe(0); // aucun wallet créé pour l'autre utilisateur

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });

    it('le bon utilisateur peut toujours compléter sa propre demande ensuite', async () => {
      const row = await pool.query(
        `SELECT reference FROM wallet_topup_requests WHERE user_id = $1 AND amount = 8000 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      const reference = row.rows[0].reference;
      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}user-right`, amount: 8000, direction: 'credit', reference });
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(false);
    });
  });

  describe('Référence', () => {
    it('un webhook sans référence ne crédite pas (impossible de vérifier quoi que ce soit)', async () => {
      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}noref`, amount: 1000, direction: 'credit' });
      expect(res.statusCode).toBe(200);

      const wallet = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const balanceBefore = wallet.rows[0].balance;

      // Rejouer avec la même absence de référence : toujours aucun crédit.
      const res2 = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}noref2`, amount: 1000, direction: 'credit' });
      expect(res2.statusCode).toBe(200);
      const walletAfter = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(walletAfter.rows[0].balance).toBe(balanceBefore);
    });

    it('une référence inconnue ne crédite pas', async () => {
      const wallet = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}badref`, amount: 1000, direction: 'credit', reference: 'WLT-INEXISTANTE' });
      expect(res.statusCode).toBe(200);
      const walletAfter = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(walletAfter.rows[0].balance).toBe(wallet.rows[0].balance);
    });
  });

  describe('Paiement échoué (status != success)', () => {
    it("un webhook signalant un échec de paiement marque la demande 'failed' sans créditer", async () => {
      const initRes = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 12000, provider: 'fedapay' });
      const reference = initRes.body.data.payment.reference;

      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}failed`, amount: 12000, direction: 'credit', reference, status: 'failed' });
      expect(res.statusCode).toBe(200);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0].balance).toBe(before.rows[0].balance);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('failed');
    });

    it("une demande déjà 'failed' ne peut plus être ranimée par un webhook de succès tardif", async () => {
      const row = await pool.query(
        `SELECT reference FROM wallet_topup_requests WHERE user_id = $1 AND amount = 12000 AND status = 'failed' LIMIT 1`,
        [userId]
      );
      const reference = row.rows[0].reference;
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      const res = await sendWebhook({ user_id: userId, provider_tx_id: `${PREFIX}toolate`, amount: 12000, direction: 'credit', reference });
      expect(res.statusCode).toBe(200);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0].balance).toBe(before.rows[0].balance);
    });
  });

  describe('Idempotence — répétitions multiples', () => {
    it('10 webhooks identiques (même provider_tx_id) ne créditent qu\'une seule fois', async () => {
      const initRes = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 3000, provider: 'fedapay' });
      const reference = initRes.body.data.payment.reference;
      const body = { user_id: userId, provider_tx_id: `${PREFIX}repeat10`, amount: 3000, direction: 'credit', reference };

      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await sendWebhook(body);
      }
      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0].balance) + 3000);
    });
  });

  describe('Concurrence — webhooks simultanés', () => {
    it('deux webhooks simultanés pour la même recharge ne créditent qu\'une seule fois', async () => {
      const initRes = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 7000, provider: 'fedapay' });
      const reference = initRes.body.data.payment.reference;
      const body = { user_id: userId, provider_tx_id: `${PREFIX}concurrent`, amount: 7000, direction: 'credit', reference };

      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      await Promise.all([sendWebhook(body), sendWebhook(body)]);
      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0].balance) + 7000);
    });
  });

  describe('États — pending / completed / failed / cancelled', () => {
    it("les 4 statuts existent et sont accessibles via l'observabilité admin", async () => {
      // pending : une demande jamais réconciliée.
      const pendingRes = await request(app).post('/api/v1/wallet/topup').set(auth(token)).send({ amount: 1500, provider: 'fedapay' });

      // cancelled : mis à jour directement (aucune route utilisateur d'annulation
      // n'est demandée dans cette phase — seule la représentation du statut l'est).
      await pool.query(`UPDATE wallet_topup_requests SET status = 'cancelled' WHERE reference = $1`, [pendingRes.body.data.payment.reference]);

      const adminPending = await request(app).get('/api/v1/wallet/admin/topups?status=pending').set(auth(tokenAdmin));
      const adminCompleted = await request(app).get('/api/v1/wallet/admin/topups?status=completed').set(auth(tokenAdmin));
      const adminFailed = await request(app).get('/api/v1/wallet/admin/topups?status=failed').set(auth(tokenAdmin));
      const adminCancelled = await request(app).get('/api/v1/wallet/admin/topups?status=cancelled').set(auth(tokenAdmin));

      expect(adminPending.statusCode).toBe(200);
      expect(adminCompleted.body.data.topups.length).toBeGreaterThanOrEqual(1);
      expect(adminFailed.body.data.topups.length).toBeGreaterThanOrEqual(1);
      expect(adminCancelled.body.data.topups.some((t) => t.reference === pendingRes.body.data.payment.reference)).toBe(true);
    });

    it("refuse l'accès à l'observabilité admin pour un non-admin (403)", async () => {
      const res = await request(app).get('/api/v1/wallet/admin/topups').set(auth(token));
      expect(res.statusCode).toBe(403);
    });

    it("refuse l'accès sans authentification (401)", async () => {
      const res = await request(app).get('/api/v1/wallet/admin/topups');
      expect(res.statusCode).toBe(401);
    });
  });
});
