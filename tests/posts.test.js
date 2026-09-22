const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-posts-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Posts' };
let token, postId;

describe('Module Posts', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const { verifyRes: res } = await registerAndVerify(userA);
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

  describe('Séparation fil général / posts de groupe', () => {
    let groupId, groupPostId;

    it('crée un groupe et y publie un post', async () => {
      const groupRes = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Groupe Posts Test', description: 'Test', visibility: 'public' });
      expect(groupRes.statusCode).toBe(201);
      groupId = groupRes.body.data.group.id;

      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'texte', content: 'Post du groupe', group_id: groupId });
      expect(postRes.statusCode).toBe(201);
      groupPostId = postRes.body.data.post.id;
      expect(postRes.body.data.post.group_id).toBe(groupId);
    });

    it("n'apparaît PAS dans le fil général (sans group_id)", async () => {
      const res = await request(app).get('/api/v1/posts').set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      const ids = res.body.data.posts.map((p) => p.id);
      expect(ids).not.toContain(groupPostId);
    });

    it('apparaît bien dans le fil du groupe (?group_id=...)', async () => {
      const res = await request(app)
        .get(`/api/v1/posts?group_id=${groupId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      const ids = res.body.data.posts.map((p) => p.id);
      expect(ids).toContain(groupPostId);
    });

    afterAll(async () => {
      if (groupId) {
        await pool.query('DELETE FROM group_members WHERE group_id = $1', [groupId]);
        await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
      }
    });
  });

  describe('Confidentialité du profil auteur', () => {
    it("n'expose jamais credits_balance, referred_by ni email dans author_profile", async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      const profile = res.body.data.post.author_profile;
      expect(profile).not.toHaveProperty('credits_balance');
      expect(profile).not.toHaveProperty('referred_by');
      expect(profile).not.toHaveProperty('email');
      expect(profile).toHaveProperty('display_name');
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
