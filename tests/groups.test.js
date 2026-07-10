const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const TEST_EMAIL_PREFIX = 'test-jest-groups-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Groups' };
let token, groupId;

describe('Module Groups', () => {
  beforeAll(async () => {
    const resBefore = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIdsBefore = resBefore.rows.map(r => r.id);
    if (userIdsBefore.length > 0) {
      await pool.query('DELETE FROM group_members WHERE user_id = ANY($1)', [userIdsBefore]);
      await pool.query('DELETE FROM groups WHERE created_by = ANY($1)', [userIdsBefore]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIdsBefore]);
    }
    const res = await request(app).post('/api/v1/auth/register').send(userA);
    token = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIds = res.rows.map(r => r.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM group_members WHERE user_id = ANY($1)', [userIds]);
      await pool.query('DELETE FROM groups WHERE created_by = ANY($1)', [userIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
  });

  describe('POST /api/v1/groups', () => {
    it('devrait créer un groupe', async () => {
      const res = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Groupe de Test', description: 'Description', visibility: 'public' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.group.name).toBe('Groupe de Test');
      groupId = res.body.data.group.id;
    });
  });

  describe('GET /api/v1/groups', () => {
    it('devrait lister les groupes', async () => {
      const res = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.groups.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/groups/:id', () => {
    it('devrait retourner les détails du groupe', async () => {
      const res = await request(app)
        .get(`/api/v1/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.group.id).toBe(groupId);
    });
  });

  describe('PATCH /api/v1/groups/:id', () => {
    it('devrait mettre à jour le groupe', async () => {
      const res = await request(app)
        .patch(`/api/v1/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nouveau nom' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.group.name).toBe('Nouveau nom');
    });
  });

  describe('DELETE /api/v1/groups/:id', () => {
    it('devrait supprimer le groupe', async () => {
      const res = await request(app)
        .delete(`/api/v1/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
