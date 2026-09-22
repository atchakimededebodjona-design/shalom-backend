const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-comments-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Comments' };
let token, postId, commentId;

describe('Module Comments', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const { verifyRes: res } = await registerAndVerify(userA);
    token = res.body.data.tokens.access_token;

    // Créer un post pour commenter
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'texte', content: 'Post pour les tests de commentaires' });
    postId = postRes.body.data.post.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  describe('POST /api/v1/comments/post/:postId', () => {
    it('devrait ajouter un commentaire à un post', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/post/${postId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Super commentaire!' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comment.content).toBe('Super commentaire!');
      commentId = res.body.data.comment.id;
    });
  });

  describe('GET /api/v1/comments/post/:postId', () => {
    it('devrait lister les commentaires d\'un post', async () => {
      const res = await request(app)
        .get(`/api/v1/comments/post/${postId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.comments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Confidentialité du profil auteur', () => {
    it("n'expose jamais credits_balance, referred_by ni email dans author_profile", async () => {
      const res = await request(app)
        .get(`/api/v1/comments/post/${postId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.comments.length).toBeGreaterThanOrEqual(1);
      for (const comment of res.body.data.comments) {
        expect(comment.author_profile).not.toHaveProperty('credits_balance');
        expect(comment.author_profile).not.toHaveProperty('referred_by');
        expect(comment.author_profile).not.toHaveProperty('email');
      }
    });
  });

  describe('DELETE /api/v1/comments/:id', () => {
    it('devrait supprimer un commentaire', async () => {
      const res = await request(app)
        .delete(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
    });
  });
});
