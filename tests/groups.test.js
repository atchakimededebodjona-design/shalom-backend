const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-groups-';
let userA = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Groups' };
let userB = { email: `${TEST_EMAIL_PREFIX}bob@shalom.dev`, password: 'Password123!', display_name: 'Bob Groups' };
let token, tokenB, userIdB, groupId;

describe('Module Groups', () => {
  beforeAll(async () => {
    const resBefore = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const userIdsBefore = resBefore.rows.map(r => r.id);
    if (userIdsBefore.length > 0) {
      await pool.query('DELETE FROM group_members WHERE user_id = ANY($1)', [userIdsBefore]);
      await pool.query('DELETE FROM groups WHERE created_by = ANY($1)', [userIdsBefore]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIdsBefore]);
    }
    const { verifyRes: res } = await registerAndVerify(userA);
    token = res.body.data.tokens.access_token;

    const { verifyRes: resB } = await registerAndVerify(userB);
    tokenB = resB.body.data.tokens.access_token;
    userIdB = resB.body.data.user.id;
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

  describe('PATCH /api/v1/groups/:id/members/:userId/status — transitions', () => {
    let privateGroupId;

    beforeAll(async () => {
      // Groupe privé : rejoindre pose status='en_attente' (nécessaire pour tester approbation/rejet).
      const res = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Groupe Privé Statuts', visibility: 'prive' });
      privateGroupId = res.body.data.group.id;
    });

    it("place Bob en 'en_attente' quand il rejoint un groupe privé", async () => {
      const res = await request(app)
        .post(`/api/v1/groups/${privateGroupId}/members`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('en_attente');
    });

    it("rejette la transition vers 'en_attente' (aucune action métier valide) sans laisser de transaction ouverte", async () => {
      const res = await request(app)
        .patch(`/api/v1/groups/${privateGroupId}/members/${userIdB}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'en_attente' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');

      // La connexion doit avoir été correctement libérée : une requête normale
      // qui suit doit fonctionner (le pool ne doit pas être épuisé/bloqué).
      const membersRes = await request(app)
        .get(`/api/v1/groups/${privateGroupId}/members`)
        .set('Authorization', `Bearer ${token}`);
      expect(membersRes.statusCode).toBe(200);
    });

    it("rejette un statut totalement invalide au niveau de la validation (400)", async () => {
      const res = await request(app)
        .patch(`/api/v1/groups/${privateGroupId}/members/${userIdB}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'banni' });
      expect(res.statusCode).toBe(400);
    });

    it("approuve Bob ('actif') et incrémente members_count", async () => {
      const res = await request(app)
        .patch(`/api/v1/groups/${privateGroupId}/members/${userIdB}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'actif' });
      expect(res.statusCode).toBe(200);

      const groupRes = await request(app)
        .get(`/api/v1/groups/${privateGroupId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(groupRes.body.data.group.members_count).toBe(2);
    });

    it("refuse une seconde approbation (Bob n'est plus en_attente)", async () => {
      const res = await request(app)
        .patch(`/api/v1/groups/${privateGroupId}/members/${userIdB}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'actif' });
      expect(res.statusCode).toBe(403);
    });

    it("refuse ('refuse') une demande en attente d'un autre utilisateur", async () => {
      // Nouvel utilisateur qui rejoint puis se fait refuser.
      const userC = { email: `${TEST_EMAIL_PREFIX}carla@shalom.dev`, password: 'Password123!', display_name: 'Carla Groups' };
      const { verifyRes: resC } = await registerAndVerify(userC);
      const tokenC = resC.body.data.tokens.access_token;
      const userIdC = resC.body.data.user.id;

      await request(app)
        .post(`/api/v1/groups/${privateGroupId}/members`)
        .set('Authorization', `Bearer ${tokenC}`);

      const res = await request(app)
        .patch(`/api/v1/groups/${privateGroupId}/members/${userIdC}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'refuse' });
      expect(res.statusCode).toBe(200);

      const membersRes = await request(app)
        .get(`/api/v1/groups/${privateGroupId}/members`)
        .set('Authorization', `Bearer ${token}`);
      expect(membersRes.body.data.members.some(m => m.profile.user_id === userIdC)).toBe(false);
    });
  });

  describe('GET /api/v1/groups/:id/members — pas de fuite de profil', () => {
    it('ne renvoie jamais credits_balance, referred_by ni email dans le profil des membres', async () => {
      const res = await request(app)
        .get(`/api/v1/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.members.length).toBeGreaterThanOrEqual(1);
      for (const member of res.body.data.members) {
        expect(member.profile).not.toHaveProperty('credits_balance');
        expect(member.profile).not.toHaveProperty('referred_by');
        expect(member.profile).not.toHaveProperty('email');
      }
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
