const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getLastTestVerificationCode } = require('../src/utils/email');

const TEST_EMAIL_PREFIX = 'test-jest-auth-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Auth' };
let token;

describe('Module Auth', () => {
  beforeAll(async () => {
    // Nettoyage en cas d'exécution précédente échouée
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  afterAll(async () => {
    // Nettoyage final
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  describe('POST /api/v1/auth/register', () => {
    it('devrait initier une inscription et exiger une vérification (pas de tokens émis)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(userA);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe(userA.email);
      expect(res.body.data.requires_verification).toBe(true);
      expect(res.body.data).not.toHaveProperty('tokens');
    });

    it('devrait refuser une inscription avec un email existant', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(userA);

      expect(res.statusCode).toBe(409); // Conflict
      expect(res.body.success).toBe(false);
    });
  });

  describe('Connexion tant que l\'email n\'est pas vérifié', () => {
    it('refuse la connexion (403 EMAIL_NOT_VERIFIED) même avec le bon mot de passe', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: userA.password });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('refuse un code incorrect', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ email: userA.email, code: '000000' });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_CODE');
    });

    it('accepte le bon code, vérifie l\'email et connecte automatiquement', async () => {
      const code = getLastTestVerificationCode(userA.email);
      expect(code).toMatch(/^\d{6}$/);

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ email: userA.email, code });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('access_token');
      token = res.body.data.tokens.access_token;
    });

    it('refuse de re-vérifier un email déjà vérifié', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ email: userA.email, code: '123456' });

      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('ALREADY_VERIFIED');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('devrait connecter l\'utilisateur une fois vérifié', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: userA.password });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('access_token');
      expect(res.body.data.tokens).toHaveProperty('refresh_token');
    });

    it('devrait refuser une connexion avec mot de passe incorrect', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: 'WrongPassword123!' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/auth/password', () => {
    it('refuse sans authentification (401)', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/password')
        .send({ current_password: userA.password, new_password: 'Nouveau123!' });
      expect(res.statusCode).toBe(401);
    });

    it('refuse si le mot de passe actuel est incorrect', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: 'FauxMotDePasse1', new_password: 'Nouveau123!' });
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('refuse un nouveau mot de passe qui ne respecte pas la politique', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: userA.password, new_password: 'faible' });
      expect(res.statusCode).toBe(400);
    });

    it('change le mot de passe avec les bons identifiants', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: userA.password, new_password: 'Nouveau123!' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("l'ancien mot de passe ne fonctionne plus", async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: userA.password });
      expect(res.statusCode).toBe(401);
    });

    it('le nouveau mot de passe fonctionne', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: 'Nouveau123!' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    const userB = { email: `${TEST_EMAIL_PREFIX}bob@shalom.dev`, password: 'Password123!', display_name: 'Bob Auth' };

    afterAll(async () => {
      await pool.query('DELETE FROM users WHERE email = $1', [userB.email]);
    });

    it('renvoie un nouveau code utilisable et répond de façon générique pour un email inconnu', async () => {
      await request(app).post('/api/v1/auth/register').send(userB);
      const firstCode = getLastTestVerificationCode(userB.email);

      const resUnknown = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: `${TEST_EMAIL_PREFIX}inconnu@shalom.dev` });
      expect(resUnknown.statusCode).toBe(200); // même réponse générique, pas d'énumération

      const resResend = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: userB.email });
      expect(resResend.statusCode).toBe(200);

      const newCode = getLastTestVerificationCode(userB.email);
      expect(newCode).toMatch(/^\d{6}$/);

      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ email: userB.email, code: newCode });
      expect(verifyRes.statusCode).toBe(200);
    });
  });
});
