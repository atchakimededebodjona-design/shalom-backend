const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

// Préfixe propre à cette suite (couvert par le nettoyage global test-jest-).
const PREFIX = 'test-jest-camaj-';
const admin = { email: `${PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Admin Camaj' };
const normal = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'User Camaj' };

let tokenAdmin, tokenUser;
// Les demandes CAMAJ ne sont pas rattachées à un utilisateur : on suit les IDs
// créés pour les supprimer nous-mêmes (le nettoyage global ne cible que les users).
const createdIds = [];

describe('Module Camaj', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);

    // Injection dynamique de l'email admin pour cette suite.
    process.env.ADMIN_EMAILS = admin.email;

    const { verifyRes: resAdmin } = await registerAndVerify(admin);
    tokenAdmin = resAdmin.body.data.tokens.access_token;

    const { verifyRes: resUser } = await registerAndVerify(normal);
    tokenUser = resUser.body.data.tokens.access_token;
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await pool.query('DELETE FROM camaj_submissions WHERE id = ANY($1)', [createdIds]);
    }
    const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    const userIds = res.rows.map((r) => r.id);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
  });

  describe('POST /api/v1/camaj/submissions (public)', () => {
    it('devrait enregistrer une demande de type "don"', async () => {
      const res = await request(app)
        .post('/api/v1/camaj/submissions')
        .send({
          type: 'don',
          data: {
            nom: 'Testeur Don',
            email: `${PREFIX}don@shalom.dev`,
            indicatif: '+228',
            whatsapp: '90000001',
            montant: '5000',
            dedicace: 'Formation & Leadership',
          },
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      createdIds.push(res.body.data.id);
    });

    it('devrait accepter le prénom en substitut du nom (type "mentorat")', async () => {
      const res = await request(app)
        .post('/api/v1/camaj/submissions')
        .send({ type: 'mentorat', data: { prenom: 'Ama', whatsapp: '90000002', domaine: 'Entrepreneuriat' } });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.id).toBeDefined();
      createdIds.push(res.body.data.id);
    });

    it('devrait refuser un type invalide (400)', async () => {
      const res = await request(app)
        .post('/api/v1/camaj/submissions')
        .send({ type: 'pirate', data: { nom: 'X', email: 'x@y.co' } });
      expect(res.statusCode).toBe(400);
    });

    it('devrait exiger un nom (400)', async () => {
      const res = await request(app)
        .post('/api/v1/camaj/submissions')
        .send({ type: 'don', data: { email: 'x@y.co' } });
      expect(res.statusCode).toBe(400);
    });

    it('devrait exiger un moyen de contact — WhatsApp ou e-mail (400)', async () => {
      const res = await request(app)
        .post('/api/v1/camaj/submissions')
        .send({ type: 'don', data: { nom: 'Sans Contact' } });
      expect(res.statusCode).toBe(400);
    });

    it('devrait rejeter un corps sans "data" (400)', async () => {
      const res = await request(app).post('/api/v1/camaj/submissions').send({ type: 'don' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/camaj/submissions (admin)', () => {
    it('devrait refuser sans token (401)', async () => {
      const res = await request(app).get('/api/v1/camaj/submissions');
      expect(res.statusCode).toBe(401);
    });

    it('devrait refuser à un utilisateur non-admin (403)', async () => {
      const res = await request(app)
        .get('/api/v1/camaj/submissions')
        .set('Authorization', `Bearer ${tokenUser}`);
      expect(res.statusCode).toBe(403);
    });

    it('devrait lister les demandes pour un admin', async () => {
      const res = await request(app)
        .get('/api/v1/camaj/submissions?limit=5')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.submissions)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    });

    it('devrait filtrer par type', async () => {
      const res = await request(app)
        .get('/api/v1/camaj/submissions?type=don')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.submissions.every((s) => s.type === 'don')).toBe(true);
    });
  });

  describe('GET /api/v1/camaj/submissions/stats (admin)', () => {
    it('devrait refuser à un non-admin (403)', async () => {
      const res = await request(app)
        .get('/api/v1/camaj/submissions/stats')
        .set('Authorization', `Bearer ${tokenUser}`);
      expect(res.statusCode).toBe(403);
    });

    it('devrait retourner des compteurs pour un admin', async () => {
      const res = await request(app)
        .get('/api/v1/camaj/submissions/stats')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.statusCode).toBe(200);
      expect(typeof res.body.data.total).toBe('number');
      expect(res.body.data.parType).toBeDefined();
      expect(res.body.data.parStatut).toBeDefined();
    });
  });

  describe('PATCH /api/v1/camaj/submissions/:id (admin)', () => {
    it('devrait changer le statut d\'une demande en "traite"', async () => {
      const res = await request(app)
        .patch(`/api/v1/camaj/submissions/${createdIds[0]}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ status: 'traite' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('traite');
    });

    it('devrait refuser un statut invalide (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/camaj/submissions/${createdIds[0]}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ status: 'nimportequoi' });
      expect(res.statusCode).toBe(400);
    });

    it('devrait retourner 404 pour un id inexistant', async () => {
      const res = await request(app)
        .patch('/api/v1/camaj/submissions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ status: 'traite' });
      expect(res.statusCode).toBe(404);
    });

    it('devrait retourner 400 pour un id non-UUID', async () => {
      const res = await request(app)
        .patch('/api/v1/camaj/submissions/pas-un-uuid')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ status: 'traite' });
      expect(res.statusCode).toBe(400);
    });

    it('devrait refuser à un non-admin (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/camaj/submissions/${createdIds[0]}`)
        .set('Authorization', `Bearer ${tokenUser}`)
        .send({ status: 'traite' });
      expect(res.statusCode).toBe(403);
    });
  });
});
