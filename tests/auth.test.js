const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const TEST_EMAIL_PREFIX = 'test-jest-auth-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Auth' };

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
    it('devrait inscrire un nouvel utilisateur', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(userA);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe(userA.email);
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data.tokens).toHaveProperty('access_token');
    });

    it('devrait refuser une inscription avec un email existant', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(userA);

      expect(res.statusCode).toBe(409); // Conflict
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('devrait connecter l\'utilisateur', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userA.email, password: userA.password });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('tokens');
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
});
