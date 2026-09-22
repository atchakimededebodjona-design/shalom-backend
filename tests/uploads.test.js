const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-uploads-';
let user = { email: `${TEST_EMAIL_PREFIX}alice@shalom.dev`, password: 'Password123!', display_name: 'Alice Uploads' };
let token, userId;

const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

describe('Module Uploads — propriété et quota', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    const { verifyRes } = await registerAndVerify(user);
    token = verifyRes.body.data.tokens.access_token;
    userId = verifyRes.body.data.user.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM uploads WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  it('refuse un upload sans authentification (401)', async () => {
    const res = await request(app).post('/api/v1/uploads').attach('file', validPngBuffer, 'a.png');
    expect(res.statusCode).toBe(401);
  });

  it('accepte un upload valide et l\'associe au compte (usage mis à jour)', async () => {
    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', validPngBuffer, 'a.png');

    expect(res.statusCode).toBe(201);
    expect(res.body.data.url).toMatch(/\.png$/);

    const usageRes = await request(app)
      .get('/api/v1/uploads/usage')
      .set('Authorization', `Bearer ${token}`);
    expect(usageRes.statusCode).toBe(200);
    expect(usageRes.body.data.used_bytes).toBe(validPngBuffer.length);
    expect(usageRes.body.data.quota_bytes).toBeGreaterThan(0);
    expect(usageRes.body.data.remaining_bytes).toBe(usageRes.body.data.quota_bytes - validPngBuffer.length);
  });

  it('refuse un nouvel upload une fois le quota atteint (413)', async () => {
    // Simule un compte déjà proche du quota par défaut (500 Mo), sans écrire
    // réellement de fichier volumineux sur disque.
    const usageRes = await request(app)
      .get('/api/v1/uploads/usage')
      .set('Authorization', `Bearer ${token}`);
    const quotaBytes = usageRes.body.data.quota_bytes;

    // Pousse l'usage cumulé au-delà du quota (l'upload précédent a déjà
    // consommé quelques octets, donc utiliser quotaBytes tel quel suffit à
    // dépasser la limite dès la prochaine vérification).
    await pool.query(
      `INSERT INTO uploads (user_id, filename, mime, size) VALUES ($1, 'fake.png', 'image/png', $2)`,
      [userId, quotaBytes]
    );

    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', validPngBuffer, 'b.png');

    expect(res.statusCode).toBe(413);
    expect(res.body.code).toBe('UPLOAD_QUOTA_EXCEEDED');
  });
});
