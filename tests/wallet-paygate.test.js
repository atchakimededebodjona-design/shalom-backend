// tests/wallet-paygate.test.js
// Intégration PayGate Global (FLOOZ/T-Money, Togo) — remplace CinetPay pour
// les nouveaux rechargements.
//
// ⚠️ AUCUN APPEL RÉSEAU RÉEL. Aucun credential PayGate n'est disponible dans
// cet environnement. Les appels vers l'API PayGate (initiation /api/v1/pay,
// vérification /api/v1/status et /api/v2/status) sont simulés (mock de
// `global.fetch`) avec des réponses dont la STRUCTURE reproduit le guide
// d'intégration officiel PayGate Global (endpoints, champs, codes de statut)
// tel que fourni pour cette phase — jamais des valeurs inventées sans source.
//
// Ce fichier ne teste donc pas "PayGate fonctionne", mais "SHALOM se comporte
// correctement face à chaque réponse PayGate documentée, y compris les
// pannes réseau" — exactement comme tests/wallet-cinetpay.test.js.

// wallet.service.js lit PAYGATE_AUTH_TOKEN en constante de module : elle doit
// être présente AVANT le premier require de l'app (trop tard dans un beforeAll).
process.env.PAYGATE_AUTH_TOKEN = 'test-auth-token-paygate';

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const walletService = require('../src/modules/wallet/wallet.service');
const { registerAndVerify } = require('./helpers');

const PREFIX = 'test-jest-paygate-';
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'PayGate Tester' };

const PAYGATE_PAY_URL = 'https://paygateglobal.com/api/v1/pay';
const PAYGATE_STATUS_URL = 'https://paygateglobal.com/api/v1/status';
const PAYGATE_STATUS_BY_IDENTIFIER_URL = 'https://paygateglobal.com/api/v2/status';

// --- Réponses simulées, au FORMAT documenté par le guide d'intégration ---

const mockPayResponse = (status, txReference, overrides = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({ status, tx_reference: txReference, ...overrides }),
});

const mockStatusResponse = (status, identifier, txReference, overrides = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    tx_reference: txReference,
    identifier,
    payment_reference: `PAY-${txReference}`,
    status,
    datetime: '2026-01-01 12:00:00',
    payment_method: 'FLOOZ',
    ...overrides,
  }),
});

let token, userId;
let fetchSpy;
let txCounter = 0;
const nextTxReference = () => `PGTX-${Date.now()}-${(txCounter += 1)}`;

const mockFetchRouting = ({ pay, status, statusByIdentifier } = {}) => {
  fetchSpy.mockImplementation(async (url) => {
    if (url === PAYGATE_PAY_URL) return typeof pay === 'function' ? pay() : pay;
    if (url === PAYGATE_STATUS_URL) return typeof status === 'function' ? status() : status;
    if (url === PAYGATE_STATUS_BY_IDENTIFIER_URL) return typeof statusByIdentifier === 'function' ? statusByIdentifier() : statusByIdentifier;
    throw new Error(`URL PayGate non mockée dans ce test : ${url}`);
  });
};

const initiateTopup = (amount, network = 'FLOOZ', phone = '90010203') =>
  request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
    .send({ amount, provider: 'paygate', phone_number: phone, network });

const sendPaygateWebhook = (body) =>
  request(app).post('/api/v1/wallet/webhook/paygate').set('Content-Type', 'application/json').send(body);

describe('Wallet — PayGate Global (réponses simulées)', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    const { verifyRes } = await registerAndVerify(user);
    token = verifyRes.body.data.tokens.access_token;
    userId = verifyRes.body.data.user.id;
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM wallet_topup_requests WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM provider_transactions WHERE user_id = $1`, [userId]);
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  });

  describe('Initiation', () => {
    it('POST /wallet/topup (FLOOZ) appelle réellement /api/v1/pay et stocke tx_reference', async () => {
      const txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });

      const res = await initiateTopup(10000, 'FLOOZ', '90010203');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payment.provider_tx_id).toBe(txRef);
      expect(res.body.data.payment.payment_url).toBeNull();
      expect(res.body.data.payment.stub).toBe(false);

      const payCallBody = JSON.parse(fetchSpy.mock.calls.find((c) => c[0] === PAYGATE_PAY_URL)[1].body);
      expect(payCallBody.network).toBe('FLOOZ');
      expect(payCallBody.phone_number).toBe('90010203');
      expect(payCallBody.identifier).toBe(res.body.data.payment.reference);
      expect(payCallBody.auth_token).toBe('test-auth-token-paygate');

      const row = await pool.query('SELECT status, provider_tx_id FROM wallet_topup_requests WHERE reference = $1', [res.body.data.payment.reference]);
      expect(row.rows[0].status).toBe('pending');
      expect(row.rows[0].provider_tx_id).toBe(txRef);
    });

    it('POST /wallet/topup (TMONEY) appelle /api/v1/pay avec network=TMONEY', async () => {
      const txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });

      const res = await initiateTopup(12000, 'TMONEY', '91020304');
      expect(res.statusCode).toBe(200);

      const payCallBody = JSON.parse(fetchSpy.mock.calls.find((c) => c[0] === PAYGATE_PAY_URL)[1].body);
      expect(payCallBody.network).toBe('TMONEY');
    });

    it('statut d\'initiation 2 (jeton invalide) : rejet explicite, aucun crédit possible', async () => {
      mockFetchRouting({ pay: mockPayResponse(2, null) });
      const res = await initiateTopup(5000);
      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe('PAYGATE_AUTH_INVALID');

      const row = await pool.query(
        `SELECT status FROM wallet_topup_requests WHERE user_id = $1 AND amount = 5000 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      expect(row.rows[0].status).toBe('failed');
    });

    it('statut d\'initiation 4 (paramètres invalides) : rejet explicite', async () => {
      mockFetchRouting({ pay: mockPayResponse(4, null) });
      const res = await initiateTopup(6000);
      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe('PAYGATE_INVALID_PARAMS');
    });

    it('statut d\'initiation 6 (doublon) : rejet explicite', async () => {
      mockFetchRouting({ pay: mockPayResponse(6, null) });
      const res = await initiateTopup(7000);
      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe('PAYGATE_DUPLICATE');
    });

    it('refuse l\'initiation sans numéro de téléphone (validation)', async () => {
      const res = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000, provider: 'paygate', network: 'FLOOZ' });
      expect(res.statusCode).toBe(400);
    });

    it('refuse un network hors FLOOZ/TMONEY (validation)', async () => {
      const res = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000, provider: 'paygate', phone_number: '90010203', network: 'ORANGE_MONEY' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Webhook — sécurité (identifier, montant, vérification serveur obligatoire)', () => {
    let reference, txRef;
    beforeEach(async () => {
      txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });
      const res = await initiateTopup(15000);
      reference = res.body.data.payment.reference;
    });

    it('ignore un webhook incomplet (sans tx_reference/identifier/amount)', async () => {
      const res = await sendPaygateWebhook({});
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBeUndefined();
    });

    it('rejette un webhook avec un identifier inconnu (aucun appel à /api/v1/status)', async () => {
      mockFetchRouting({ status: mockStatusResponse(0, 'REF-INCONNUE', 'TX-INCONNU') });
      const res = await sendPaygateWebhook({ tx_reference: 'TX-INCONNU', identifier: 'REF-INCONNUE', amount: 15000 });
      expect(res.statusCode).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalledWith(PAYGATE_STATUS_URL, expect.anything());
    });

    it('rejette un webhook avec un montant différent du montant demandé (aucun crédit, aucun appel API)', async () => {
      mockFetchRouting({ status: mockStatusResponse(0, reference, txRef) });
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 999999 });
      expect(res.statusCode).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalledWith(PAYGATE_STATUS_URL, expect.anything());

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0]?.balance ?? '0').toBe(before.rows[0]?.balance ?? '0');
      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });

    it('un status=0 confirmé par /api/v1/status (identifier cohérent) crédite le wallet', async () => {
      mockFetchRouting({ status: mockStatusResponse(0, reference, txRef) });
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      const res = await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(false);

      const statusCallBody = JSON.parse(fetchSpy.mock.calls.find((c) => c[0] === PAYGATE_STATUS_URL)[1].body);
      expect(statusCallBody.tx_reference).toBe(txRef);
      expect(statusCallBody.auth_token).toBe('test-auth-token-paygate');

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0]?.balance ?? '0') + 15000);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('completed');
    });

    it('un identifier renvoyé par PayGate différent de la référence SHALOM ne crédite pas', async () => {
      mockFetchRouting({ status: mockStatusResponse(0, 'AUTRE-REFERENCE', txRef) });
      await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });

    it('status=2 (en cours) ne crédite pas et laisse la demande "pending"', async () => {
      mockFetchRouting({ status: mockStatusResponse(2, reference, txRef) });
      await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });

    it('status=4 (expiré) marque la demande "failed" sans créditer', async () => {
      mockFetchRouting({ status: mockStatusResponse(4, reference, txRef) });
      await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('failed');
    });

    it('status=6 (annulé) marque la demande "failed" sans créditer', async () => {
      mockFetchRouting({ status: mockStatusResponse(6, reference, txRef) });
      await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('failed');
    });

    it('une panne réseau lors de la vérification ne crédite jamais (fail-safe)', async () => {
      mockFetchRouting({ status: () => { throw new Error('timeout'); } });
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      const res = await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });
      expect(res.statusCode).toBe(200); // toujours 200 côté provider

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0]?.balance ?? '0').toBe(before.rows[0]?.balance ?? '0');
      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending'); // pas fermée : une notification/réconciliation ultérieure pourra réessayer
    });

    it('une réponse HTTP 500 de PayGate à la vérification ne crédite pas', async () => {
      mockFetchRouting({ status: { ok: false, status: 500, json: async () => ({ message: 'error' }) } });
      const res = await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });
      expect(res.statusCode).toBe(200);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });

    it('une réponse JSON invalide/incomplète (statut absent) ne crédite pas', async () => {
      mockFetchRouting({ status: { ok: true, status: 200, json: async () => ({ identifier: reference }) } });
      const res = await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 15000 });
      expect(res.statusCode).toBe(200);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });
  });

  describe('Idempotence et concurrence', () => {
    it('10 notifications identiques ne créditent qu\'une seule fois et n\'appellent /api/v1/status qu\'une seule fois après succès', async () => {
      const txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });
      const initRes = await initiateTopup(3000);
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting({ status: mockStatusResponse(0, reference, txRef) });
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 3000 });
      }

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0]?.balance ?? '0') + 3000);

      const statusCalls = fetchSpy.mock.calls.filter((c) => c[0] === PAYGATE_STATUS_URL);
      expect(statusCalls.length).toBe(1);
    });

    it('deux notifications simultanées pour la même recharge ne créditent qu\'une seule fois', async () => {
      const txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });
      const initRes = await initiateTopup(13000);
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting({ status: mockStatusResponse(0, reference, txRef) });
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      const body = { tx_reference: txRef, identifier: reference, amount: 13000 };
      await Promise.all([sendPaygateWebhook(body), sendPaygateWebhook(body)]);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0].balance) + 13000);
    });
  });

  describe('Réconciliation (webhook perdu — vérification par identifier, /api/v2/status)', () => {
    it('retrouve et crédite une recharge dont le webhook n\'est jamais arrivé', async () => {
      const txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });
      const initRes = await initiateTopup(20000);
      const reference = initRes.body.data.payment.reference;

      // Aucun webhook envoyé : on simule directement la réconciliation "pull".
      mockFetchRouting({ statusByIdentifier: mockStatusResponse(0, reference, txRef) });
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      const result = await walletService.reconcilePaygateTopup(reference);
      expect(result.rejected).toBeUndefined();
      expect(result.duplicate).toBe(false);

      const byIdentifierCallBody = JSON.parse(fetchSpy.mock.calls.find((c) => c[0] === PAYGATE_STATUS_BY_IDENTIFIER_URL)[1].body);
      expect(byIdentifierCallBody.identifier).toBe(reference);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0]?.balance ?? '0') + 20000);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('completed');
    });

    it('une réconciliation ne crédite pas deux fois si le webhook finit par arriver ensuite', async () => {
      const txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });
      const initRes = await initiateTopup(9000);
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting({ statusByIdentifier: mockStatusResponse(0, reference, txRef) });
      await walletService.reconcilePaygateTopup(reference);

      // Le "vrai" webhook arrive après coup, pour la même transaction.
      mockFetchRouting({ status: mockStatusResponse(0, reference, txRef) });
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendPaygateWebhook({ tx_reference: txRef, identifier: reference, amount: 9000 });
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(true);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0].balance).toBe(before.rows[0].balance); // aucun second crédit
    });

    it('une réconciliation avec identifier PayGate incohérent ne crédite pas', async () => {
      const txRef = nextTxReference();
      mockFetchRouting({ pay: mockPayResponse(0, txRef) });
      const initRes = await initiateTopup(4000);
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting({ statusByIdentifier: mockStatusResponse(0, 'AUTRE-REFERENCE', txRef) });
      const result = await walletService.reconcilePaygateTopup(reference);
      expect(result.rejected).toBe(true);
      expect(result.reason).toBe('PAYGATE_IDENTIFIER_MISMATCH');

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });
  });
});
