const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const TEST_EMAIL_PREFIX = 'test-jest-posts-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Posts' };
let token, postId;

describe('Module Posts', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const res = await request(app).post('/api/v1/auth/register').send(userA);
    token = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  describe('POST /api/v1/posts', () => {
    it('devrait créer une nouvelle publication', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'texte', content: 'Mon premier post Jest!' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.post.content).toBe('Mon premier post Jest!');
      postId = res.body.data.post.id;
    });
  });

  describe('GET /api/v1/posts', () => {
    it('devrait retourner le fil d\'actualité', async () => {
      const res = await request(app)
        .get('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.posts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/posts/:id', () => {
    it('devrait retourner un post spécifique', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.post.id).toBe(postId);
    });
  });

  describe('PATCH /api/v1/posts/:id', () => {
    it('devrait mettre à jour un post', async () => {
      const res = await request(app)
        .patch(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Contenu mis à jour' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.post.content).toBe('Contenu mis à jour');
    });
  });

  describe('DELETE /api/v1/posts/:id', () => {
    it('devrait supprimer un post', async () => {
      const res = await request(app)
        .delete(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/supprimé/);
      
      // Vérifier la suppression
      const getRes = await request(app).get(`/api/v1/posts/${postId}`).set('Authorization', `Bearer ${token}`);
      expect(getRes.statusCode).toBe(404);
    });
  });
});
