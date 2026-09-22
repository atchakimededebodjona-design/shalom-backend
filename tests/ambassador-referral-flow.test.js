// tests/ambassador-referral-flow.test.js
// Parcours de bout en bout : inscription avec code de parrainage → referral
// → activation d'abonnement → commission → approbation → solde ambassadeur.
// Couvre le branchement fonctionnel Phase 3 (recordReferral et
// createCommissionForSubscription réellement appelées par le flux réel,
// plus l'idempotence et la concurrence sur les commissions).

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-refflow-';
const admin = { email: `${TEST_EMAIL_PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Admin RefFlow' };
const ambassadorUser = { email: `${TEST_EMAIL_PREFIX}ambassador@shalom.dev`, password: 'Password123!', display_name: 'Ambassador RefFlow' };

let tokenAdmin, tokenAmbassador, ambassadorUserId, referralCode;

const expireTrial = async (userId) => {
  await pool.query(`UPDATE users SET created_at = now() - interval '10 days' WHERE id = $1`, [userId]);
};

describe('Programme Ambassadeur — parcours référencement complet', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    process.env.ADMIN_EMAILS = admin.email;

    const { verifyRes: adminRes } = await registerAndVerify(admin);
    tokenAdmin = adminRes.body.data.tokens.access_token;

    const { verifyRes: ambRes } = await registerAndVerify(ambassadorUser);
    tokenAmbassador = ambRes.body.data.tokens.access_token;
    ambassadorUserId = ambRes.body.data.user.id;

    const profileRes = await request(app).get('/api/v1/ambassador/profile').set('Authorization', `Bearer ${tokenAmbassador}`);
    referralCode = profileRes.body.data.ambassador.referral_code;
  });

  afterAll(async () => {
    const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIds = res.rows.map((r) => r.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM ambassador_commissions WHERE ambassador_id IN (SELECT id FROM ambassador_profiles WHERE user_id = ANY($1))', [userIds]);
      await pool.query('DELETE FROM referrals WHERE referred_user_id = ANY($1) OR ambassador_id IN (SELECT id FROM ambassador_profiles WHERE user_id = ANY($1))', [userIds]);
      await pool.query('DELETE FROM subscriptions WHERE user_id = ANY($1)', [userIds]);
      await pool.query('DELETE FROM ambassador_profiles WHERE user_id = ANY($1)', [userIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
  });

  describe('Inscription — code de parrainage', () => {
    it('inscription SANS code : fonctionne normalement, aucune ligne referrals créée', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: `${TEST_EMAIL_PREFIX}nocode@shalom.dev`, password: 'Password123!', display_name: 'No Code',
      });
      expect(res.statusCode).toBe(201);

      const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [`${TEST_EMAIL_PREFIX}nocode@shalom.dev`]);
      const check = await pool.query('SELECT * FROM referrals WHERE referred_user_id = $1', [rows[0].id]);
      expect(check.rows.length).toBe(0);
    });

    it('inscription avec un code INEXISTANT : rejetée (400), aucun utilisateur créé', async () => {
      const email = `${TEST_EMAIL_PREFIX}badcode@shalom.dev`;
      const res = await request(app).post('/api/v1/auth/register').send({
        email, password: 'Password123!', display_name: 'Bad Code', referral_code: 'SHLM-000000',
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_REFERRAL_CODE');

      const check = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      expect(check.rows.length).toBe(0); // pas d'état incohérent : aucun compte créé
    });

    it('inscription avec un code VALIDE : compte créé, ligne referrals correcte', async () => {
      const email = `${TEST_EMAIL_PREFIX}referred1@shalom.dev`;
      const res = await request(app).post('/api/v1/auth/register').send({
        email, password: 'Password123!', display_name: 'Referred One', referral_code: referralCode,
      });
      expect(res.statusCode).toBe(201);

      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      const referredUserId = userRes.rows[0].id;

      const referralRow = await pool.query('SELECT * FROM referrals WHERE referred_user_id = $1', [referredUserId]);
      expect(referralRow.rows.length).toBe(1);
      expect(referralRow.rows[0].status).toBe('registered');
      expect(referralRow.rows[0].source).toBe('code');

      const profileRow = await pool.query('SELECT referred_by FROM profiles WHERE user_id = $1', [referredUserId]);
      expect(profileRow.rows[0].referred_by).toBe(ambassadorUserId);
    });

    it("un ambassadeur ne peut pas se parrainer lui-même (recordReferral, testé directement)", async () => {
      const ambassadorService = require('../src/modules/ambassador/ambassador.service');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await ambassadorService.recordReferral(ambassadorUserId, referralCode, client);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      const check = await pool.query('SELECT * FROM referrals WHERE referred_user_id = $1', [ambassadorUserId]);
      expect(check.rows.length).toBe(0);
    });

    it("le même utilisateur ne peut pas être enregistré deux fois comme filleul (doublon)", async () => {
      const ambassadorService = require('../src/modules/ambassador/ambassador.service');
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [`${TEST_EMAIL_PREFIX}referred1@shalom.dev`]);
      const referredUserId = userRes.rows[0].id;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await ambassadorService.recordReferral(referredUserId, referralCode, client);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      const check = await pool.query('SELECT count(*) FROM referrals WHERE referred_user_id = $1', [referredUserId]);
      expect(check.rows[0].count).toBe('1');
    });

    it('deux inscriptions concurrentes avec le MÊME code créent deux referrals distincts (un par filleul)', async () => {
      // Emails en minuscules : registerSchema applique normalizeEmail(), qui
      // mettrait en minuscules toute majuscule avant écriture en base.
      const emailA = `${TEST_EMAIL_PREFIX}concurrenta@shalom.dev`;
      const emailB = `${TEST_EMAIL_PREFIX}concurrentb@shalom.dev`;

      const [resA, resB] = await Promise.all([
        request(app).post('/api/v1/auth/register').send({ email: emailA, password: 'Password123!', display_name: 'Concurrent A', referral_code: referralCode }),
        request(app).post('/api/v1/auth/register').send({ email: emailB, password: 'Password123!', display_name: 'Concurrent B', referral_code: referralCode }),
      ]);
      expect(resA.statusCode).toBe(201);
      expect(resB.statusCode).toBe(201);

      const users = await pool.query('SELECT id FROM users WHERE email = ANY($1)', [[emailA, emailB]]);
      const referrals = await pool.query(
        'SELECT * FROM referrals WHERE referred_user_id = ANY($1)',
        [users.rows.map((r) => r.id)]
      );
      expect(referrals.rows.length).toBe(2);
    });
  });

  describe('Abonnement filleul → commission ambassadeur', () => {
    let referredUserId;

    beforeAll(async () => {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [`${TEST_EMAIL_PREFIX}referred1@shalom.dev`]);
      referredUserId = userRes.rows[0].id;
      await expireTrial(referredUserId);
    });

    it("aucune commission tant que le filleul n'est pas abonné (referral sans abonnement)", async () => {
      const check = await pool.query('SELECT count(*) FROM ambassador_commissions WHERE referred_user_id = $1', [referredUserId]);
      expect(check.rows[0].count).toBe('0');
    });

    it("l'activation de l'abonnement du filleul crée une commission 'subscription' au taux standard (10%)", async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: referredUserId, plan: 'mensuel', amount: 2000, payment_reference: 'REFFLOW-SUB-1' });
      expect(res.statusCode).toBe(201);

      const comm = await pool.query('SELECT * FROM ambassador_commissions WHERE referred_user_id = $1', [referredUserId]);
      expect(comm.rows.length).toBe(1);
      expect(comm.rows[0].type).toBe('subscription');
      expect(parseInt(comm.rows[0].amount, 10)).toBe(200); // 10% de 2000, arrondi supérieur
      expect(comm.rows[0].status).toBe('pending');

      const referral = await pool.query('SELECT status FROM referrals WHERE referred_user_id = $1', [referredUserId]);
      expect(referral.rows[0].status).toBe('subscribed');
    });

    it("répéter la MÊME activation (payment_reference identique) ne crée pas de seconde commission", async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: referredUserId, plan: 'mensuel', amount: 2000, payment_reference: 'REFFLOW-SUB-1' });
      expect(res.statusCode).toBe(200); // idempotent, pas 201

      const comm = await pool.query('SELECT count(*) FROM ambassador_commissions WHERE referred_user_id = $1', [referredUserId]);
      expect(comm.rows[0].count).toBe('1');
    });

    it("un renouvellement (nouvelle payment_reference) crée une commission 'renewal' au taux réduit (8%)", async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: referredUserId, plan: 'mensuel', amount: 2000, payment_reference: 'REFFLOW-SUB-2' });
      expect(res.statusCode).toBe(201);

      const comm = await pool.query(
        `SELECT type, amount FROM ambassador_commissions WHERE referred_user_id = $1 ORDER BY created_at`,
        [referredUserId]
      );
      expect(comm.rows.length).toBe(2);
      expect(comm.rows[1].type).toBe('renewal');
      expect(parseInt(comm.rows[1].amount, 10)).toBe(160); // 8% de 2000, arrondi supérieur
    });

    it('deux activations concurrentes de la MÊME référence ne créent qu\'un abonnement et qu\'une commission', async () => {
      const email = `${TEST_EMAIL_PREFIX}concurrentpay@shalom.dev`;
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email, password: 'Password123!', display_name: 'Concurrent Pay', referral_code: referralCode,
      });
      expect(regRes.statusCode).toBe(201);
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      const concurrentUserId = userRes.rows[0].id;
      await expireTrial(concurrentUserId);

      const activate = () => request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: concurrentUserId, plan: 'mensuel', amount: 3000, payment_reference: 'REFFLOW-CONCURRENT-1' });

      const [resA, resB] = await Promise.all([activate(), activate()]);
      const statusCodes = [resA.statusCode, resB.statusCode].sort();
      expect(statusCodes).toEqual([200, 201]);

      const subs = await pool.query('SELECT count(*) FROM subscriptions WHERE user_id = $1', [concurrentUserId]);
      expect(subs.rows[0].count).toBe('1');

      const comms = await pool.query('SELECT count(*) FROM ambassador_commissions WHERE referred_user_id = $1', [concurrentUserId]);
      expect(comms.rows[0].count).toBe('1');
    });

    it("l'abonnement d'un utilisateur SANS parrain ne crée aucune commission", async () => {
      const email = `${TEST_EMAIL_PREFIX}noparrain@shalom.dev`;
      const { verifyRes } = await registerAndVerify({ email, password: 'Password123!', display_name: 'No Parrain' });
      const noReferralUserId = verifyRes.body.data.user.id;
      await expireTrial(noReferralUserId);

      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: noReferralUserId, plan: 'mensuel', amount: 2000, payment_reference: 'REFFLOW-NOREF-1' });
      expect(res.statusCode).toBe(201);

      const comm = await pool.query('SELECT count(*) FROM ambassador_commissions WHERE referred_user_id = $1', [noReferralUserId]);
      expect(comm.rows[0].count).toBe('0');
    });
  });

  describe('Approbation de commission → solde ambassadeur', () => {
    let commissionId, commissionAmount, balanceBefore;

    beforeAll(async () => {
      const comm = await pool.query(
        `SELECT c.id, c.amount, ap.available_balance
         FROM ambassador_commissions c
         JOIN ambassador_profiles ap ON ap.id = c.ambassador_id
         WHERE c.status = 'pending' AND ap.user_id = $1
         ORDER BY c.created_at LIMIT 1`,
        [ambassadorUserId]
      );
      commissionId = comm.rows[0].id;
      commissionAmount = parseInt(comm.rows[0].amount, 10);
      balanceBefore = parseInt(comm.rows[0].available_balance, 10);
    });

    it('la commission est en attente (pending) avant approbation', async () => {
      const res = await pool.query('SELECT status FROM ambassador_commissions WHERE id = $1', [commissionId]);
      expect(res.rows[0].status).toBe('pending');
    });

    it("approuve la commission : crédite le solde ambassadeur du montant exact", async () => {
      const res = await request(app)
        .patch(`/api/v1/ambassador/admin/commissions/${commissionId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.statusCode).toBe(200);

      const profile = await pool.query('SELECT available_balance FROM ambassador_profiles WHERE user_id = $1', [ambassadorUserId]);
      expect(parseInt(profile.rows[0].available_balance, 10)).toBe(balanceBefore + commissionAmount);
    });

    it('une seconde approbation de la même commission est refusée (pas de double crédit)', async () => {
      const balanceAfterFirst = await pool.query('SELECT available_balance FROM ambassador_profiles WHERE user_id = $1', [ambassadorUserId]);

      const res = await request(app)
        .patch(`/api/v1/ambassador/admin/commissions/${commissionId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('COMMISSION_INVALID_STATUS');

      const balanceAfterSecond = await pool.query('SELECT available_balance FROM ambassador_profiles WHERE user_id = $1', [ambassadorUserId]);
      expect(balanceAfterSecond.rows[0].available_balance).toBe(balanceAfterFirst.rows[0].available_balance);
    });
  });
});
