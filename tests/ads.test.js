// tests/ads.test.js
// Tests d'intégration HTTP du module Publicités (espace publicitaire du dashboard).
// Objectif principal : garantir que le CONTENU est géré UNIQUEMENT par les
// administrateurs — toute écriture par un non-admin doit renvoyer 403.
//
// NB : la table `ads` préexiste en base (partagée). On ne teste ici que la lecture
// (annonces actives) et l'enforcement admin, sans créer de données (le chemin admin
// « heureux » est vérifié via l'interface d'administration).

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-ads-';
const user = {
  email: `${PREFIX}user@shalom.dev`,
  password: 'Password123!',
  display_name: 'Ads Tester',
};
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

let token;
const auth = () => ({ Authorization: `Bearer ${token}` });

const cleanup = async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
};

describe('Module Publicités (espace publicitaire)', () => {
  beforeAll(async () => {
    await cleanup();
    const res = await request(app).post('/api/v1/auth/register').send(user);
    token = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Lecture (tout utilisateur connecté)', () => {
    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/ads');
      expect(res.statusCode).toBe(401);
    });

    it('liste les annonces actives (tableau)', async () => {
      const res = await request(app).get('/api/v1/ads').set(auth());
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.ads)).toBe(true);
      // Toutes les annonces renvoyées par le bandeau doivent être actives.
      expect(res.body.data.ads.every((a) => a.is_active === true)).toBe(true);
    });
  });

  describe('Écriture réservée aux administrateurs', () => {
    it('refuse la création à un non-admin (403 FORBIDDEN_ADMIN_ONLY)', async () => {
      const res = await request(app).post('/api/v1/ads').set(auth())
        .send({ title: 'Pub interdite', image_url: 'http://example.com/a.jpg' });
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ADMIN_ONLY');
    });

    it('refuse la vue de gestion à un non-admin (403)', async () => {
      const res = await request(app).get('/api/v1/ads/manage').set(auth());
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ADMIN_ONLY');
    });

    it('refuse la modification à un non-admin (403)', async () => {
      const res = await request(app).patch(`/api/v1/ads/${NIL_UUID}`).set(auth())
        .send({ title: 'X' });
      expect(res.statusCode).toBe(403);
    });

    it('refuse la suppression à un non-admin (403)', async () => {
      const res = await request(app).delete(`/api/v1/ads/${NIL_UUID}`).set(auth());
      expect(res.statusCode).toBe(403);
    });
  });
});
