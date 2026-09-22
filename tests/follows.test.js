const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-follows-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Follows' };
let userB = { email: `${TEST_EMAIL_PREFIX}bob@shalom.dev`, password: 'Password123!', display_name: 'Bob Follows' };
let tokenA, tokenB, userIdB;

describe('Module Follows', () => {
  beforeAll(async () => {
    const resBefore = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIdsBefore = resBefore.rows.map(r => r.id);
    if (userIdsBefore.length > 0) {
      await pool.query(`DELETE FROM notifications WHERE user_id = ANY($1) OR actor_id = ANY($1)`, [userIdsBefore]);
      await pool.query(`DELETE FROM follows WHERE follower_id = ANY($1) OR followed_id = ANY($1)`, [userIdsBefore]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIdsBefore]);
    }
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
      await pool.query(`DELETE FROM notifications WHERE user_id = ANY($1) OR actor_id = ANY($1)`, [userIds]);
      await pool.query(`DELETE FROM follows WHERE follower_id = ANY($1) OR followed_id = ANY($1)`, [userIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
  });

  describe('POST /api/v1/follows', () => {
    it('devrait suivre un utilisateur', async () => {
      const res = await request(app)
        .post('/api/v1/follows')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ followed_id: userIdB });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/follows/user/:userId/follow-status', () => {
    it('devrait retourner le statut de suivi', async () => {
      const res = await request(app)
        .get(`/api/v1/follows/user/${userIdB}/follow-status`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isFollowing).toBe(true);
    });
  });

  describe('GET /api/v1/follows/user/:userId/followers — confidentialité du profil', () => {
    it("n'expose jamais credits_balance, referred_by ni email des followers", async () => {
      const res = await request(app)
        .get(`/api/v1/follows/user/${userIdB}/followers`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.followers.length).toBeGreaterThanOrEqual(1);
      for (const follower of res.body.data.followers) {
        expect(follower.profile).not.toHaveProperty('credits_balance');
        expect(follower.profile).not.toHaveProperty('referred_by');
        expect(follower.profile).not.toHaveProperty('email');
      }
    });
  });

  describe('DELETE /api/v1/follows/:followedId', () => {
    it('devrait se désabonner', async () => {
      const res = await request(app)
        .delete(`/api/v1/follows/${userIdB}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
