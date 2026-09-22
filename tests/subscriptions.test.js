const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-subs-';
const admin = { email: `${TEST_EMAIL_PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Admin Subs' };

// Pousse users.created_at dans le passé pour simuler un essai gratuit expiré
// (7 jours) sans attendre — même technique que les autres suites qui
// manipulent directement la DB pour simuler un état (ex: ambassador.test.js).
const expireTrial = async (userId) => {
  await pool.query(`UPDATE users SET created_at = now() - interval '10 days' WHERE id = $1`, [userId]);
};

describe('Module Subscriptions', () => {
  let tokenAdmin;

  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    process.env.ADMIN_EMAILS = admin.email;
    const { verifyRes } = await registerAndVerify(admin);
    tokenAdmin = verifyRes.body.data.tokens.access_token;
  });

  afterAll(async () => {
    const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIds = res.rows.map((r) => r.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM subscriptions WHERE user_id = ANY($1)', [userIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
  });

  describe('GET /api/v1/subscriptions/status', () => {
    it('nouvel utilisateur : accès via essai gratuit (7 jours)', async () => {
      const { verifyRes } = await registerAndVerify({
        email: `${TEST_EMAIL_PREFIX}trial@shalom.dev`, password: 'Password123!', display_name: 'Trial User',
      });
      const token = verifyRes.body.data.tokens.access_token;

      const res = await request(app).get('/api/v1/subscriptions/status').set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.access).toBe(true);
      expect(res.body.data.reason).toBe('trial');
      expect(res.body.data.days_remaining).toBeGreaterThanOrEqual(6);
    });

    it('essai expiré, sans abonnement : accès refusé', async () => {
      const { verifyRes } = await registerAndVerify({
        email: `${TEST_EMAIL_PREFIX}expired@shalom.dev`, password: 'Password123!', display_name: 'Expired User',
      });
      const token = verifyRes.body.data.tokens.access_token;
      const userId = verifyRes.body.data.user.id;
      await expireTrial(userId);

      const res = await request(app).get('/api/v1/subscriptions/status').set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.access).toBe(false);
      expect(res.body.data.reason).toBe('expired');
    });

    it('refuse sans authentification (401)', async () => {
      const res = await request(app).get('/api/v1/subscriptions/status');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/subscriptions/plans', () => {
    it('liste les plans sans inventer de tarif', async () => {
      const { verifyRes } = await registerAndVerify({
        email: `${TEST_EMAIL_PREFIX}plans@shalom.dev`, password: 'Password123!', display_name: 'Plans User',
      });
      const token = verifyRes.body.data.tokens.access_token;

      const res = await request(app).get('/api/v1/subscriptions/plans').set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.plans).toEqual([
        { plan: 'mensuel', duration_days: 30 },
        { plan: 'trimestriel', duration_days: 90 },
        { plan: 'semestriel', duration_days: 180 },
        { plan: 'annuel', duration_days: 365 },
      ]);
      for (const p of res.body.data.plans) {
        expect(p).not.toHaveProperty('amount');
        expect(p).not.toHaveProperty('price');
      }
    });
  });

  describe('POST /api/v1/subscriptions/admin/activate', () => {
    let userId, token;

    beforeAll(async () => {
      const { verifyRes } = await registerAndVerify({
        email: `${TEST_EMAIL_PREFIX}payer@shalom.dev`, password: 'Password123!', display_name: 'Payer User',
      });
      token = verifyRes.body.data.tokens.access_token;
      userId = verifyRes.body.data.user.id;
      await expireTrial(userId); // isole l'effet de l'abonnement de l'essai gratuit
    });

    it("refuse l'accès à un non-admin (403)", async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: userId, plan: 'mensuel', amount: 2000, payment_reference: 'REF-FORBIDDEN' });
      expect(res.statusCode).toBe(403);
    });

    it('refuse sans authentification (401)', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .send({ user_id: userId, plan: 'mensuel', amount: 2000, payment_reference: 'REF-NOAUTH' });
      expect(res.statusCode).toBe(401);
    });

    it('refuse un plan invalide (400)', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: userId, plan: 'hebdomadaire', amount: 2000, payment_reference: 'REF-BADPLAN' });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('refuse un montant non positif (400)', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: userId, plan: 'mensuel', amount: 0, payment_reference: 'REF-BADAMOUNT' });
      expect(res.statusCode).toBe(400);
    });

    it('active un abonnement après confirmation admin (201)', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: userId, plan: 'mensuel', amount: 2000, payment_reference: 'REF-ACTIVATE-1' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.subscription.status).toBe('active');
      expect(res.body.data.subscription.plan).toBe('mensuel');

      const statusRes = await request(app).get('/api/v1/subscriptions/status').set('Authorization', `Bearer ${token}`);
      expect(statusRes.body.data.reason).toBe('active_subscription');
    });

    it('donne accès aux modules protégés après activation (posts, comments, likes, groups, wallet, billing)', async () => {
      const auth = { Authorization: `Bearer ${token}` };
      const endpoints = [
        ['get', '/api/v1/posts'],
        ['get', '/api/v1/groups'],
        ['get', '/api/v1/wallet'],
        ['get', '/api/v1/billing/businesses/me'],
      ];
      for (const [method, path] of endpoints) {
        const res = await request(app)[method](path).set(auth);
        expect([200, 404]).toContain(res.statusCode); // 404 = pas d'entreprise billing créée, mais PAS 402
        expect(res.statusCode).not.toBe(402);
      }

      // comments/likes exigent des IDs réels : on vérifie juste l'absence de 402
      // en tentant une lecture sans dépendance (liste globale n'existe pas pour
      // comments — on vérifie via un post factice inexistant, l'important est
      // le code renvoyé n'est pas 402).
      const commentsRes = await request(app).get('/api/v1/comments/post/00000000-0000-0000-0000-000000000000').set(auth);
      expect(commentsRes.statusCode).not.toBe(402);
    });

    it("est idempotent : la même payment_reference ne crée pas un second abonnement (200, pas 201)", async () => {
      const before = await pool.query('SELECT count(*) FROM subscriptions WHERE payment_reference = $1', ['REF-ACTIVATE-1']);
      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: userId, plan: 'mensuel', amount: 2000, payment_reference: 'REF-ACTIVATE-1' });

      expect(res.statusCode).toBe(200);
      const after = await pool.query('SELECT count(*) FROM subscriptions WHERE payment_reference = $1', ['REF-ACTIVATE-1']);
      expect(after.rows[0].count).toBe(before.rows[0].count);
    });

    it('renouvellement : une nouvelle référence prolonge à partir de la fin de la période en cours (pas de jour perdu)', async () => {
      const currentRes = await pool.query(
        `SELECT expires_at FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY expires_at DESC LIMIT 1`,
        [userId]
      );
      const previousExpiry = new Date(currentRes.rows[0].expires_at);

      const res = await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: userId, plan: 'mensuel', amount: 2000, payment_reference: 'REF-RENEWAL-1' });

      expect(res.statusCode).toBe(201);
      const newStartedAt = new Date(res.body.data.subscription.started_at);
      // La nouvelle période démarre exactement à l'expiration de la précédente.
      expect(Math.abs(newStartedAt.getTime() - previousExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe('PATCH /api/v1/subscriptions/admin/:userId/cancel', () => {
    let userId, token;

    beforeAll(async () => {
      const { verifyRes } = await registerAndVerify({
        email: `${TEST_EMAIL_PREFIX}cancel@shalom.dev`, password: 'Password123!', display_name: 'Cancel User',
      });
      token = verifyRes.body.data.tokens.access_token;
      userId = verifyRes.body.data.user.id;
      await expireTrial(userId);

      await request(app)
        .post('/api/v1/subscriptions/admin/activate')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ user_id: userId, plan: 'mensuel', amount: 2000, payment_reference: 'REF-TO-CANCEL' });
    });

    it("refuse l'annulation à un non-admin (403)", async () => {
      const res = await request(app)
        .patch(`/api/v1/subscriptions/admin/${userId}/cancel`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(403);
    });

    it('annule un abonnement actif (200) puis révoque immédiatement l\'accès', async () => {
      const res = await request(app)
        .patch(`/api/v1/subscriptions/admin/${userId}/cancel`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.subscription.status).toBe('cancelled');

      const statusRes = await request(app).get('/api/v1/subscriptions/status').set('Authorization', `Bearer ${token}`);
      expect(statusRes.body.data.access).toBe(false);
      expect(statusRes.body.data.reason).toBe('expired');

      const groupsRes = await request(app).get('/api/v1/groups').set('Authorization', `Bearer ${token}`);
      expect(groupsRes.statusCode).toBe(402);
      expect(groupsRes.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('refuse une seconde annulation (404 — aucun abonnement actif)', async () => {
      const res = await request(app)
        .patch(`/api/v1/subscriptions/admin/${userId}/cancel`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('NO_ACTIVE_SUBSCRIPTION');
    });
  });
});
