const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const TEST_EMAIL_PREFIX = 'test-jest-repnot-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice RepNot' };
let userB = { email: `${TEST_EMAIL_PREFIX}bob@shalom.dev`, password: 'Password123!', display_name: 'Bob RepNot' };
let admin = { email: `test-jest-repnot-admin@shalom.dev`, password: 'Password123!', display_name: 'Admin RepNot' };

let tokenA, tokenB, tokenAdmin, userIdA, postId, reportId;

describe('Module Reports & Notifications', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    
    // Inject admin email dynamically for this suite
    process.env.ADMIN_EMAILS = admin.email;

    const resA = await request(app).post('/api/v1/auth/register').send(userA);
    tokenA = resA.body.data.tokens.access_token;
    userIdA = resA.body.data.user.id;

    const resB = await request(app).post('/api/v1/auth/register').send(userB);
    tokenB = resB.body.data.tokens.access_token;

    const resAdmin = await request(app).post('/api/v1/auth/register').send(admin);
    tokenAdmin = resAdmin.body.data.tokens.access_token;
  });

  afterAll(async () => {
    const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIds = res.rows.map(r => r.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM notifications WHERE user_id = ANY($1) OR actor_id = ANY($1)', [userIds]);
      await pool.query('DELETE FROM reports WHERE reporter_id = ANY($1)', [userIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
  });

  describe('Création et interaction (Déclencheurs de notifications)', () => {
    it('devrait créer un post par Alice', async () => {
      const res = await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${tokenA}`).send({ type: 'texte', content: 'Post à signaler' });
      postId = res.body.data.post.id;
    });

    it('devrait générer des notifications quand Bob interagit', async () => {
      await request(app).post('/api/v1/follows').set('Authorization', `Bearer ${tokenB}`).send({ followed_id: userIdA });
      await request(app).post('/api/v1/likes').set('Authorization', `Bearer ${tokenB}`).send({ likeable_type: 'post', likeable_id: postId });
      await request(app).post(`/api/v1/comments/post/${postId}`).set('Authorization', `Bearer ${tokenB}`).send({ content: 'Super post!' });
    });
  });

  describe('Module Notifications', () => {
    it('devrait retourner le compteur de notifications non lues pour Alice', async () => {
      const res = await request(app).get('/api/v1/notifications/unread-count').set('Authorization', `Bearer ${tokenA}`);
      expect(res.body.data.unread_count).toBe(3);
    });

    it('devrait lister les notifications d\'Alice', async () => {
      const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${tokenA}`);
      expect(res.body.data.notifications.length).toBe(3);
    });

    it('devrait marquer toutes les notifications comme lues', async () => {
      await request(app).patch('/api/v1/notifications/read-all').set('Authorization', `Bearer ${tokenA}`);
      const res = await request(app).get('/api/v1/notifications/unread-count').set('Authorization', `Bearer ${tokenA}`);
      expect(res.body.data.unread_count).toBe(0);
    });
  });

  describe('Module Reports', () => {
    it('devrait créer un signalement par Bob', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ target_type: 'post', target_id: postId, reason: 'spam' });

      expect(res.statusCode).toBe(201);
      reportId = res.body.data.report.id;
    });

    it('devrait bloquer un signalement en doublon', async () => {
      const res = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${tokenB}`).send({ target_type: 'post', target_id: postId, reason: 'spam' });
      expect(res.statusCode).toBe(409);
    });

    it('devrait refuser l\'accès aux signalements pour un non-admin', async () => {
      const res = await request(app).get('/api/v1/reports').set('Authorization', `Bearer ${tokenB}`);
      expect(res.statusCode).toBe(403);
    });

    it('devrait permettre à l\'admin de lister et traiter le signalement', async () => {
      // Lister
      const listRes = await request(app).get('/api/v1/reports?status=en_attente').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(listRes.statusCode).toBe(200);

      // Traiter
      const patchRes = await request(app)
        .patch(`/api/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ status: 'traite', apply_action: true });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.body.data.report.status).toBe('traite');

      // Vérifier que le post est bien masqué
      const postRes = await pool.query('SELECT status FROM posts WHERE id = $1', [postId]);
      expect(postRes.rows[0].status).toBe('masque');
    });
  });
});
