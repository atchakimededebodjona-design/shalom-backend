const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-conseillers-';
let admin = { email: `${TEST_EMAIL_PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Admin Conseillers' };
let member = { email: `${TEST_EMAIL_PREFIX}member@shalom.dev`, password: 'Password123!', display_name: 'Membre Conseiller' };
let tokenAdmin, memberUserId, conseillerId;

describe('Module Conseillers — validation UUID', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    process.env.ADMIN_EMAILS = admin.email;

    const { verifyRes: resAdmin } = await registerAndVerify(admin);
    tokenAdmin = resAdmin.body.data.tokens.access_token;

    const { verifyRes: resMember } = await registerAndVerify(member);
    memberUserId = resMember.body.data.user.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM conseillers WHERE user_id = $1', [memberUserId]);
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  it('crée un conseiller à partir d\'un membre existant', async () => {
    const res = await request(app)
      .post('/api/v1/conseillers')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ user_id: memberUserId, specialite: 'Mentorat' });

    expect(res.statusCode).toBe(201);
    conseillerId = res.body.data.id;
  });

  it('GET /:id avec un UUID invalide renvoie 400 (pas 500)', async () => {
    const res = await request(app)
      .get('/api/v1/conseillers/pas-un-uuid')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('GET /:id avec un UUID valide mais inexistant renvoie 404', async () => {
    const res = await request(app)
      .get('/api/v1/conseillers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.statusCode).toBe(404);
  });

  it('GET /:id avec un UUID valide et existant renvoie 200', async () => {
    const res = await request(app)
      .get(`/api/v1/conseillers/${conseillerId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(conseillerId);
  });

  it('DELETE /:id avec un UUID invalide renvoie 400 (pas 500)', async () => {
    const res = await request(app)
      .delete('/api/v1/conseillers/pas-un-uuid')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('refuse l\'accès à un utilisateur non-admin (403)', async () => {
    const { verifyRes } = await registerAndVerify({
      email: `${TEST_EMAIL_PREFIX}normal@shalom.dev`,
      password: 'Password123!',
      display_name: 'Utilisateur Normal',
    });
    const tokenNormal = verifyRes.body.data.tokens.access_token;

    const res = await request(app)
      .get(`/api/v1/conseillers/${conseillerId}`)
      .set('Authorization', `Bearer ${tokenNormal}`);
    expect(res.statusCode).toBe(403);
  });

  it('refuse l\'accès sans authentification (401)', async () => {
    const res = await request(app).get(`/api/v1/conseillers/${conseillerId}`);
    expect(res.statusCode).toBe(401);
  });
});
