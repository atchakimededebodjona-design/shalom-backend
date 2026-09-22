const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-likes-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Likes' };
let token, postId, commentId;

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

    const commentRes = await request(app)
      .post(`/api/v1/comments/post/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Commentaire à liker' });
    commentId = commentRes.body.data.comment.id;
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

    it('devrait rester cohérent (200) si le like a déjà été retiré', async () => {
      const res = await request(app)
        .delete('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: postId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('devrait rester cohérent (200) pour un unlike sur une cible inexistante', async () => {
      const res = await request(app)
        .delete('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: crypto.randomUUID() });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/likes — commentaire', () => {
    it('devrait liker un commentaire existant', async () => {
      const res = await request(app)
        .post('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'comment', likeable_id: commentId });

      expect(res.statusCode).toBe(201);
    });

    it('devrait retirer le like du commentaire', async () => {
      const res = await request(app)
        .delete('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'comment', likeable_id: commentId });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/likes — pas de like fantôme', () => {
    it("refuse (404) un likeable_id syntaxiquement valide mais inexistant, et ne crée aucune ligne", async () => {
      const fakeId = crypto.randomUUID();
      const res = await request(app)
        .post('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: fakeId });

      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('RESOURCE_NOT_FOUND');

      const rows = await pool.query('SELECT count(*) FROM likes WHERE likeable_id = $1', [fakeId]);
      expect(rows.rows[0].count).toBe('0');
    });

    it("refuse (404) un UUID valide et existant mais du mauvais type (id de commentaire liké comme 'post')", async () => {
      const res = await request(app)
        .post('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: commentId });

      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('RESOURCE_NOT_FOUND');

      const rows = await pool.query(
        `SELECT count(*) FROM likes WHERE likeable_id = $1 AND likeable_type = 'post'`,
        [commentId]
      );
      expect(rows.rows[0].count).toBe('0');
    });

    it('refuse (400) un likeable_id malformé (pas un UUID)', async () => {
      const res = await request(app)
        .post('/api/v1/likes')
        .set('Authorization', `Bearer ${token}`)
        .send({ likeable_type: 'post', likeable_id: 'pas-un-uuid' });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Concurrence — deux likes simultanés sur la même cible', () => {
    it("ne crée qu'un seul like malgré deux requêtes concurrentes", async () => {
      const concurrentPostRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'texte', content: 'Post concurrence likes' });
      const concurrentPostId = concurrentPostRes.body.data.post.id;

      const [resA, resB] = await Promise.all([
        request(app).post('/api/v1/likes').set('Authorization', `Bearer ${token}`).send({ likeable_type: 'post', likeable_id: concurrentPostId }),
        request(app).post('/api/v1/likes').set('Authorization', `Bearer ${token}`).send({ likeable_type: 'post', likeable_id: concurrentPostId }),
      ]);

      const statusCodes = [resA.statusCode, resB.statusCode].sort();
      expect(statusCodes).toEqual([201, 409]); // l'une crée, l'autre trouve déjà un like (ON CONFLICT)

      const rows = await pool.query(
        `SELECT count(*) FROM likes WHERE likeable_id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)`,
        [concurrentPostId, userA.email]
      );
      expect(rows.rows[0].count).toBe('1');
    });
  });
});
