const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const TEST_EMAIL_PREFIX = 'test-jest-ads-';
const TEST_TITLE_PREFIX = 'TEST-JEST-ADS-';
let admin = { email: `${TEST_EMAIL_PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Admin Ads' };
let tokenAdmin;

// PNG valide minimal (signature réelle) — pour le cas "fichier accepté".
const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
// Contenu texte brut, mais renommé en .png : la signature réelle ne correspond à rien.
const fakePngBuffer = Buffer.from('<script>alert(1)</script>');
// Signature MP3 (ID3) réelle mais valide — pas une image : doit être rejeté (ads = images uniquement).
const audioBuffer = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00');

describe('Module Ads — upload sécurisé', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
    await pool.query('DELETE FROM ads WHERE title LIKE $1', [`${TEST_TITLE_PREFIX}%`]);

    process.env.ADMIN_EMAILS = admin.email;
    const { verifyRes } = await registerAndVerify(admin);
    tokenAdmin = verifyRes.body.data.tokens.access_token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM ads WHERE title LIKE $1', [`${TEST_TITLE_PREFIX}%`]);
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  });

  it('accepte une image valide (signature PNG réelle)', async () => {
    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('title', `${TEST_TITLE_PREFIX}valide`)
      .attach('image', validPngBuffer, 'pub.png');

    expect(res.statusCode).toBe(201);
    expect(res.body.data.image_url).toMatch(/\.png$/);
  });

  it('refuse un fichier dont l\'extension est valide mais le contenu ne correspond à aucune signature connue', async () => {
    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('title', `${TEST_TITLE_PREFIX}contenu-invalide`)
      .attach('image', fakePngBuffer, 'faux.png');

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('refuse un fichier au MIME/extension falsifiés (signature audio réelle, renommé en image)', async () => {
    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('title', `${TEST_TITLE_PREFIX}mime-falsifie`)
      .attach('image', audioBuffer, { filename: 'son.png', contentType: 'image/png' });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('refuse un fichier dépassant la taille maximale (5 MB)', async () => {
    const oversized = Buffer.concat([validPngBuffer, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('title', `${TEST_TITLE_PREFIX}trop-gros`)
      .attach('image', oversized, 'gros.png');

    expect(res.statusCode).toBe(400);
  }, 20000);

  it('refuse un type de fichier non supporté (ex. exécutable)', async () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('title', `${TEST_TITLE_PREFIX}exe`)
      .attach('image', exeBuffer, 'app.png');

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('refuse la création sans authentification admin', async () => {
    const res = await request(app)
      .post('/api/v1/ads')
      .field('title', `${TEST_TITLE_PREFIX}sans-auth`)
      .attach('image', validPngBuffer, 'pub.png');

    expect(res.statusCode).toBe(401);
  });
});
