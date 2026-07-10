const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const TEST_EMAIL_PREFIX = 'test-jest-profiles-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Profile' };
let token;

describe('Module Profiles', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    // Créer un utilisateur et récupérer son token
    const res = await request(app).post('/api/v1/auth/register').send(userA);
    token = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    // Les profils sont supprimés en cascade
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  describe('GET /api/v1/profiles/me', () => {
    it('devrait retourner le profil de l\'utilisateur connecté', async () => {
      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.display_name).toBe(userA.display_name);
    });

    it('devrait refuser l\'accès sans token', async () => {
      const res = await request(app).get('/api/v1/profiles/me');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/profiles/me', () => {
    it('devrait mettre à jour le profil de l\'utilisateur', async () => {
      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: "Ceci est ma nouvelle bio", website: "https://shalom.dev" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.bio).toBe("Ceci est ma nouvelle bio");
      expect(res.body.data.profile.website).toBe("https://shalom.dev");
    });
  });
});
