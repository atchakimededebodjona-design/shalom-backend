const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-likes-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Likes' };
let token, postId;

describe('Module Likes', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const { verifyRes: res } = await registerAndVerify(userA);
    token = res.body.data.tokens.access_token;

    // Créer un post pour le liker
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'texte', content: 'Post à liker' });
    postId = postRes.body.data.post.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  describe('POST /api/v1/likes', () => {
    it('devrait liker un post', async () => {
      const res = await request(app)
        .post('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: postId });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('devrait refuser un double like', async () => {
      const res = await request(app)
        .post('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: postId });

      expect(res.statusCode).toBe(409); // Conflict
    });
  });

  describe('DELETE /api/v1/likes', () => {
    it('devrait retirer le like', async () => {
      const res = await request(app)
        .delete('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: postId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
