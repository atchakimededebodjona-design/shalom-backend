const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-messages-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Messages' };
let userB = { email: `${TEST_EMAIL_PREFIX}bob@shalom.dev`, password: 'Password123!', display_name: 'Bob Messages' };
let tokenA, tokenB, userIdB, conversationId;

describe('Module Messages', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const { verifyRes: resA } = await registerAndVerify(userA);
    tokenA = resA.body.data.tokens.access_token;

    const { verifyRes: resB } = await registerAndVerify(userB);
    tokenB = resB.body.data.tokens.access_token;
    userIdB = resB.body.data.user.id;
  });

  afterAll(async () => {
    const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIds = res.rows.map(r => r.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM messages WHERE sender_id = ANY($1)', [userIds]);
      await pool.query('DELETE FROM conversation_participants WHERE user_id = ANY($1)', [userIds]);
      // Note: Delete orphaned conversations might be needed, but skipping for simplicity
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
  });

  describe('POST /api/v1/conversations', () => {
    it('devrait créer une conversation entre Alice et Bob', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ participant_ids: [userIdB], is_group: false });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_new).toBe(true);
      conversationId = res.body.data.conversation_id;
    });

    it('devrait retourner la même conversation si recréée', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ participant_ids: [userIdB], is_group: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.conversation_id).toBe(conversationId);
      expect(res.body.data.is_new).toBe(false);
    });
  });

  describe('POST /api/v1/conversations/:id/messages', () => {
    it('devrait envoyer un message', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Salut Bob !' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.message.content).toBe('Salut Bob !');
    });
  });

  describe('GET /api/v1/conversations', () => {
    it('devrait lister les conversations de Bob', async () => {
      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.conversations.length).toBeGreaterThanOrEqual(1);
      const bobConvo = res.body.data.conversations[0];
      expect(bobConvo.unread_count).toBe(1);
    });
  });

  describe('GET /api/v1/conversations/:id/messages', () => {
    it('devrait retourner les messages de la conversation', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/v1/conversations/:id/read', () => {
    it('devrait marquer les messages comme lus pour Bob', async () => {
      const res = await request(app)
        .patch(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);

      // Vérifier que unread_count est à 0
      const listRes = await request(app).get('/api/v1/conversations').set('Authorization', `Bearer ${tokenB}`);
      const bobConvo = listRes.body.data.conversations.find(c => c.id === conversationId);
      expect(bobConvo.unread_count).toBe(0);
    });
  });
});
