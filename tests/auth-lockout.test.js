// tests/auth-lockout.test.js
// Vérifie le verrouillage de compte après échecs répétés (indépendant du
// rate limiting par IP — voir authLimiter dans auth.routes.js).
//
// Dans un fichier séparé de auth.test.js : authLimiter (10 req/15min) est
// partagé entre /register, /login et /refresh pour TOUT le fichier (chaque
// fichier de test obtient sa propre instance d'app via l'isolation de modules
// de Jest, donc son propre budget de 10 requêtes).

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-lockout-';
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'Lockout Tester' };

const cleanup = async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
};

describe('Module Auth — verrouillage de compte', () => {
  beforeAll(async () => {
    await cleanup();
    await request(app).post('/api/v1/auth/register').send(user);
  });

  afterAll(async () => {
    await cleanup();
  });

  it('verrouille le compte après 5 échecs de mot de passe, sans révéler de code distinct', async () => {
    let lastRes;
    for (let i = 0; i < 5; i++) {
      lastRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'WrongPassword123!' });
      expect(lastRes.statusCode).toBe(401);
      expect(lastRes.body.code).toBe('INVALID_CREDENTIALS');
    }

    // 6e tentative, même avec le BON mot de passe : doit rester bloquée,
    // avec le même message/code générique que les échecs précédents (pas de
    // "compte verrouillé" distinct, pour ne pas révéler l'état de verrouillage).
    const blockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });
    expect(blockedRes.statusCode).toBe(401);
    expect(blockedRes.body.code).toBe('INVALID_CREDENTIALS');
    expect(blockedRes.body.data).toBeUndefined();

    const row = await pool.query('SELECT failed_login_attempts, locked_until FROM users WHERE email = $1', [user.email]);
    expect(row.rows[0].failed_login_attempts).toBe(5);
    expect(new Date(row.rows[0].locked_until).getTime()).toBeGreaterThan(Date.now());
  });
});
