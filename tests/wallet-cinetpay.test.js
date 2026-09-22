// tests/wallet-cinetpay.test.js
// Phase 4C — intégration CinetPay réelle (Checkout API).
//
// ⚠️ SANDBOX RÉEL : NON EXÉCUTÉ. Aucun credential CinetPay n'est disponible
// dans cet environnement, et la documentation officielle indique elle-même
// que les sandboxes CinetPay sont temporairement indisponibles au moment de
// la rédaction. Les appels réseau vers l'API CinetPay (initialisation et
// vérification) sont donc simulés (mock de `global.fetch`) avec des réponses
// dont la STRUCTURE est confirmée par la documentation officielle
// (https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation et
// .../checkout/verification) — jamais des valeurs inventées sans source.
//
// Ce fichier ne teste donc PAS "CinetPay fonctionne", mais "SHALOM se
// comporte correctement face à chaque réponse CinetPay documentée, y
// compris les pannes réseau" — exactement ce qui est vérifiable sans accès
// à un vrai compte marchand.

// wallet.service.js lit CINETPAY_API_KEY/SITE_ID/SECRET_KEY en constantes de
// module (comme PROVIDER_SECRETS) : elles doivent être présentes AVANT le
// premier require de l'app, pas dans un beforeAll (trop tard, le module est
// déjà chargé et les constantes déjà figées).
process.env.CINETPAY_API_KEY = 'test-api-key';
process.env.CINETPAY_SITE_ID = 'test-site-id';
process.env.CINETPAY_SECRET_KEY = 'test-secret-key-cinetpay';

const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const PREFIX = 'test-jest-cinetpay-';
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'CinetPay Tester' };

const CINETPAY_INIT_URL = 'https://api-checkout.cinetpay.com/v2/payment';
const CINETPAY_CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';

const HMAC_FIELDS = [
  'cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount', 'cpm_currency',
  'signature', 'payment_method', 'cel_phone_num', 'cpm_phone_prefixe',
  'cpm_language', 'cpm_version', 'cpm_payment_config', 'cpm_page_action',
  'cpm_custom', 'cpm_designation', 'cpm_error_message',
];

// Reproduit exactement l'algorithme documenté (X-TOKEN HMAC), avec la même
// clé secrète que celle injectée dans l'environnement de test — voir
// https://docs.cinetpay.com/api/1.0-en/checkout/hmac
const signCinetpayNotification = (fields) => {
  const data = HMAC_FIELDS.map((f) => (fields[f] !== undefined ? String(fields[f]) : '')).join('');
  return crypto.createHmac('sha256', process.env.CINETPAY_SECRET_KEY).update(data).digest('hex');
};

const buildNotificationBody = (transId, overrides = {}) => ({
  cpm_site_id: process.env.CINETPAY_SITE_ID,
  cpm_trans_id: transId,
  cpm_trans_date: '20260101120000',
  cpm_amount: '',
  cpm_currency: '',
  signature: '',
  payment_method: '',
  cel_phone_num: '',
  cpm_phone_prefixe: '',
  cpm_language: 'fr',
  cpm_version: 'V4',
  cpm_payment_config: 'SINGLE',
  cpm_page_action: 'PAYMENT',
  cpm_custom: '',
  cpm_designation: '',
  cpm_error_message: 'PAYMENT_OK',
  ...overrides,
});

const sendCinetpayNotification = async (body) => {
  const xToken = signCinetpayNotification(body);
  return request(app)
    .post('/api/v1/wallet/webhook/cinetpay')
    .set('Content-Type', 'application/json')
    .set('x-token', xToken)
    .send(body);
};

// Réponses au FORMAT documenté (structure confirmée par la doc officielle,
// valeurs choisies pour les besoins du test).
const mockInitResponse = (overrides = {}) => ({
  ok: true,
  status: 201,
  json: async () => ({
    code: '201',
    message: 'CREATED',
    description: 'Transaction created with success',
    data: { payment_token: 'TEST-PAYMENT-TOKEN', payment_url: 'https://checkout.cinetpay.com/payment/TEST-PAYMENT-TOKEN' },
    ...overrides,
  }),
});

const mockCheckResponse = (status, amount, currency = 'XOF', overrides = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    code: status === 'ACCEPTED' ? '00' : '627',
    message: status === 'ACCEPTED' ? 'SUCCES' : 'TRANSACTION_CANCEL',
    data: { amount, currency, status, payment_method: 'MOBILE_MONEY', operator_id: 'TEST' },
    api_response_id: 'TEST-API-RESPONSE',
    ...overrides,
  }),
});

let token, userId;
let fetchSpy;

const mockFetchRouting = (initResponse, checkResponseByTransId) => {
  fetchSpy.mockImplementation(async (url) => {
    if (url === CINETPAY_INIT_URL) return initResponse;
    if (url === CINETPAY_CHECK_URL) {
      // checkResponseByTransId peut être une réponse unique ou une fonction
      // (transactionId non connu ici — on route par ordre d'appel simple).
      return typeof checkResponseByTransId === 'function' ? checkResponseByTransId() : checkResponseByTransId;
    }
    throw new Error(`URL CinetPay non mockée dans ce test : ${url}`);
  });
};

describe('Wallet — CinetPay (Phase 4C, réponses simulées)', () => {
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
    it('POST /wallet/topup appelle réellement l\'API CinetPay et renvoie payment_url/payment_token', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const res = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 10000, provider: 'cinetpay' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.payment.payment_url).toContain('cinetpay.com');
      expect(res.body.data.payment.payment_token).toBe('TEST-PAYMENT-TOKEN');
      expect(res.body.data.payment.stub).toBe(false);

      expect(fetchSpy).toHaveBeenCalledWith(CINETPAY_INIT_URL, expect.objectContaining({ method: 'POST' }));
      const initCallBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(initCallBody.transaction_id).toBe(res.body.data.payment.reference);
      expect(initCallBody.apikey).toBe('test-api-key');
      expect(initCallBody.site_id).toBe('test-site-id');

      const row = await pool.query('SELECT provider_tx_id, status FROM wallet_topup_requests WHERE reference = $1', [res.body.data.payment.reference]);
      expect(row.rows[0].provider_tx_id).toBe(res.body.data.payment.reference);
      expect(row.rows[0].status).toBe('pending');
    });

    it("marque la demande 'failed' si CinetPay est injoignable, et renvoie une erreur explicite", async () => {
      fetchSpy.mockImplementation(async () => { throw new Error('network down'); });

      const res = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000, provider: 'cinetpay' });

      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe('CINETPAY_UNREACHABLE');

      const row = await pool.query(
        `SELECT status, provider_tx_id FROM wallet_topup_requests WHERE user_id = $1 AND amount = 5000 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      expect(row.rows[0].status).toBe('failed');
      expect(row.rows[0].provider_tx_id).toBeNull(); // distinguable d'un paiement réellement décliné
    });

    it('marque la demande "failed" si CinetPay répond en erreur HTTP (5xx)', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: 'Internal Server Error' }) });

      const res = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 6000, provider: 'cinetpay' });

      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe('CINETPAY_HTTP_ERROR');
    });

    it('gère une réponse JSON invalide sans planter', async () => {
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('invalid json'); } });

      const res = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 7000, provider: 'cinetpay' });

      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe('CINETPAY_INVALID_RESPONSE');
    });
  });

  describe('Notification — sécurité (X-TOKEN, référence)', () => {
    // beforeEach (pas beforeAll) : le beforeAll d'un describe imbriqué
    // s'exécute AVANT le beforeEach du describe englobant (qui installe
    // fetchSpy) — il faut donc que cette création de demande dépende elle
    // aussi d'un beforeEach pour s'exécuter APRÈS l'installation du mock.
    let reference;
    beforeEach(async () => {
      mockFetchRouting(mockInitResponse(), null);
      const res = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 15000, provider: 'cinetpay' });
      reference = res.body.data.payment.reference;
    });

    it('rejette une notification sans cpm_trans_id', async () => {
      const res = await request(app).post('/api/v1/wallet/webhook/cinetpay').send({});
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBeUndefined();
    });

    it('rejette une notification avec un X-TOKEN invalide (aucun appel à l\'API de vérification)', async () => {
      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 15000));
      const body = buildNotificationBody(reference, { cpm_amount: '15000', cpm_currency: 'XOF' });
      const res = await request(app)
        .post('/api/v1/wallet/webhook/cinetpay')
        .set('x-token', 'un-token-invalide')
        .send(body);

      expect(res.statusCode).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalledWith(CINETPAY_CHECK_URL, expect.anything());

      const row = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(row.rows[0].status).toBe('pending');
    });

    it('rejette une notification avec une référence inconnue (aucun appel à l\'API de vérification)', async () => {
      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 15000));
      const body = buildNotificationBody('WLT-REFERENCE-INCONNUE');
      const res = await sendCinetpayNotification(body);

      expect(res.statusCode).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalledWith(CINETPAY_CHECK_URL, expect.anything());
    });
  });

  describe('Vérification serveur obligatoire — jamais de confiance dans la notification seule', () => {
    it('un statut ACCEPTED confirmé par CinetPay (même montant/devise) crédite le wallet', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 20000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 20000, 'XOF'));
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendCinetpayNotification(buildNotificationBody(reference));
      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(false);

      expect(fetchSpy).toHaveBeenCalledWith(CINETPAY_CHECK_URL, expect.objectContaining({ method: 'POST' }));
      const checkBody = JSON.parse(fetchSpy.mock.calls.find((c) => c[0] === CINETPAY_CHECK_URL)[1].body);
      expect(checkBody.transaction_id).toBe(reference);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0]?.balance ?? '0') + 20000);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('completed');
    });

    it("un montant CONFIRMÉ PAR CINETPAY différent du montant demandé ne crédite pas (ex: 100000 au lieu de 10000)", async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 10000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 100000, 'XOF'));
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      await sendCinetpayNotification(buildNotificationBody(reference));

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0].balance).toBe(before.rows[0].balance);

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending'); // ni créditée, ni fermée : litige à traiter
    });

    it('un montant confirmé inférieur au montant demandé (9000 au lieu de 10000) ne crédite pas non plus', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 10000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 9000, 'XOF'));
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      await sendCinetpayNotification(buildNotificationBody(reference));

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0].balance).toBe(before.rows[0].balance);
    });

    it('une devise confirmée différente (USD au lieu de XOF) ne crédite pas', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 12000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 12000, 'USD'));
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      await sendCinetpayNotification(buildNotificationBody(reference));

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0].balance).toBe(before.rows[0].balance);
    });

    it('un statut REFUSED marque la demande "failed" sans créditer', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 8000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('REFUSED', 8000));
      await sendCinetpayNotification(buildNotificationBody(reference));

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('failed');
    });

    it('un statut PENDING ne crédite pas et laisse la demande "pending" (ni succès ni échec définitif)', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 9000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('PENDING', 9000));
      await sendCinetpayNotification(buildNotificationBody(reference));

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending');
    });

    it("un statut UNKNOWN est traité comme un échec (pas de crédit par défaut)", async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 4000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('UNKNOWN', 4000));
      await sendCinetpayNotification(buildNotificationBody(reference));

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('failed');
    });

    it('une panne réseau au moment de la vérification ne crédite jamais (fail-safe, pas fail-open)', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 11000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      fetchSpy.mockImplementation(async (url) => {
        if (url === CINETPAY_INIT_URL) return mockInitResponse();
        throw new Error('timeout');
      });

      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      const res = await sendCinetpayNotification(buildNotificationBody(reference));
      expect(res.statusCode).toBe(200); // toujours 200 côté provider, jamais de crash

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(after.rows[0]?.balance ?? '0').toBe(before.rows[0]?.balance ?? '0');

      const topup = await pool.query('SELECT status FROM wallet_topup_requests WHERE reference = $1', [reference]);
      expect(topup.rows[0].status).toBe('pending'); // pas fermée : une notification ultérieure pourra réessayer
    });
  });

  describe('Idempotence et concurrence', () => {
    it('10 notifications identiques ne créditent qu\'une seule fois, et n\'appellent l\'API de vérification qu\'une seule fois après succès', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 3000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 3000));
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        await sendCinetpayNotification(buildNotificationBody(reference));
      }

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0]?.balance ?? '0') + 3000);

      const checkCalls = fetchSpy.mock.calls.filter((c) => c[0] === CINETPAY_CHECK_URL);
      expect(checkCalls.length).toBe(1); // idempotence locale : pas de ré-appel CinetPay après le 1er succès
    });

    it('deux notifications simultanées pour la même recharge ne créditent qu\'une seule fois', async () => {
      mockFetchRouting(mockInitResponse(), null);
      const initRes = await request(app).post('/api/v1/wallet/topup').set('Authorization', `Bearer ${token}`)
        .send({ amount: 13000, provider: 'cinetpay' });
      const reference = initRes.body.data.payment.reference;

      mockFetchRouting(null, mockCheckResponse('ACCEPTED', 13000));
      const before = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);

      const body = buildNotificationBody(reference);
      await Promise.all([sendCinetpayNotification(body), sendCinetpayNotification(body)]);

      const after = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      expect(parseFloat(after.rows[0].balance)).toBe(parseFloat(before.rows[0].balance) + 13000);
    });
  });
});
