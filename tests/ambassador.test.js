// tests/ambassador.test.js
// Tests d'intégration Jest + Supertest pour le module Ambassadeur SHALOM.
// Couvre : inscription, profil, dashboard, lien de parrainage,
//          commissions (création via service), retraits Mobile Money,
//          et quelques routes admin.

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const ambassadorService = require('../src/modules/ambassador/ambassador.service');

const PREFIX = 'test-jest-ambassador-';

// Comptes de test
const userA = { email: `${PREFIX}a@shalom.dev`, password: 'Password123!', display_name: 'Ambassadeur Alpha' };
const userB = { email: `${PREFIX}b@shalom.dev`, password: 'Password123!', display_name: 'Filleul Beta' };

let tokenA;  // Token de l'ambassadeur
let tokenB;  // Token du filleul
let userAId;
let userBId;
let ambassadorProfileId;
let referralCode;
let commissionId;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// =========================================================================
// Setup / Teardown
// =========================================================================
describe('Module Ambassadeur', () => {
  beforeAll(async () => {
    // Nettoyer les données de test précédentes
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);

    // Créer les deux comptes de test
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send(userA);
    tokenA  = resA.body.data?.tokens?.access_token;
    userAId = resA.body.data?.user?.id;

    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send(userB);
    tokenB  = resB.body.data?.tokens?.access_token;
    userBId = resB.body.data?.user?.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  });

  // =========================================================================
  // 1. Inscription Automatique au programme
  // =========================================================================
  describe('1. Inscription Automatique au programme', () => {
    it('crée un profil ambassadeur automatiquement dès l\'inscription', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/profile')
        .set(auth(tokenA));

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ambassador).toBeDefined();
      expect(res.body.data.ambassador.level).toBe('standard');
      expect(res.body.data.ambassador.status).toBe('active');
      expect(res.body.data.ambassador.referral_code).toMatch(/^SHLM-[A-Z0-9]{6}$/);

      ambassadorProfileId = res.body.data.ambassador.id;
      referralCode = res.body.data.ambassador.referral_code;
    });

    it('rejette l\'accès si le token est invalide (401)', async () => {
      const res = await request(app).get('/api/v1/ambassador/profile').set(auth('invalid-token'));
      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // 2. Profil ambassadeur
  // =========================================================================
  describe('2. Profil ambassadeur', () => {
    it('récupère mon profil existant', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/profile')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.ambassador.referral_code).toBe(referralCode);
      expect(res.body.data.ambassador.level).toBe('standard');
    });

    it('met à jour la bio', async () => {
      const res = await request(app)
        .patch('/api/v1/ambassador/profile')
        .set(auth(tokenA))
        .send({ bio: 'Nouvelle bio mise à jour.' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.ambassador.bio).toBe('Nouvelle bio mise à jour.');
    });
  });

  // =========================================================================
  // 3. Tableau de bord
  // =========================================================================
  describe('3. Tableau de bord', () => {
    it('retourne le dashboard avec les statistiques', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/dashboard')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.profile).toBeDefined();
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.certification).toBeDefined();
      expect(res.body.data.certification.threshold).toBe(10);
      expect(res.body.data.stats.available_balance).toBe(0);
    });

  });

  // =========================================================================
  // 4. Lien de parrainage
  // =========================================================================
  describe('4. Lien de parrainage', () => {
    it('génère un lien de parrainage et un lien WhatsApp', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/referral-link')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.referral_code).toBe(referralCode);
      expect(res.body.data.referral_url).toContain(referralCode);
      expect(res.body.data.whatsapp_url).toContain('wa.me');
    });
  });

  // =========================================================================
  // 5. Parrainages
  // =========================================================================
  describe('5. Parrainages', () => {
    it('liste les parrainages (vide initialement)', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/referrals')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.referrals).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('enregistre un parrainage via recordReferral', async () => {
      // Simuler l'inscription d'un filleul avec le code de parrainage
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await ambassadorService.recordReferral(userBId, referralCode, client);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const res = await request(app)
        .get('/api/v1/ambassador/referrals')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.referrals.length).toBeGreaterThan(0);
      expect(res.body.data.referrals[0].status).toBe('registered');
    });

    it('filtre les parrainages par statut', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/referrals?status=registered')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.referrals.every(r => r.status === 'registered')).toBe(true);
    });

    it('rejette un statut invalide (400)', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/referrals?status=invalide')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // 6. Commissions
  // =========================================================================
  describe('6. Commissions', () => {
    it('liste les commissions (vide initialement)', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/commissions')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.commissions).toBeInstanceOf(Array);
    });

    it('retourne le résumé des commissions', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/commissions/summary')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.pending).toBeDefined();
      expect(res.body.data.summary.available_balance).toBeDefined();
    });

    it('crée une commission via le service lors d\'un abonnement', async () => {
      // Simuler un abonnement payant du filleul
      const sub = await pool.query(
        `INSERT INTO subscriptions (user_id, plan, amount, started_at, expires_at, status)
         VALUES ($1, 'mensuel', 5000, now(), now() + interval '30 days', 'active')
         RETURNING id`,
        [userBId]
      );
      const subscriptionId = sub.rows[0].id;

      const commission = await ambassadorService.createCommissionForSubscription(
        userBId,
        subscriptionId,
        5000,
        'subscription'
      );

      expect(commission).not.toBeNull();
      expect(parseInt(commission.amount, 10)).toBe(Math.ceil(5000 * 10 / 100)); // 10% = 500 FCFA
      expect(commission.status).toBe('pending');
      commissionId = commission.id;
    });

    it('la commission apparaît dans la liste', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/commissions')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.commissions.length).toBeGreaterThan(0);
      expect(res.body.data.commissions[0].status).toBe('pending');
    });
  });

  // =========================================================================
  // 7. Retraits Mobile Money
  // =========================================================================
  describe('7. Retraits Mobile Money', () => {
    it('refuse un retrait si solde insuffisant (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ambassador/withdrawals')
        .set(auth(tokenA))
        .send({ amount: 10000, phone_number: '+22997123456', operator: 'mtn' });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
    });

    it('refuse un montant inférieur à 5 000 FCFA (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ambassador/withdrawals')
        .set(auth(tokenA))
        .send({ amount: 1000, phone_number: '+22997123456', operator: 'mtn' });
      expect(res.statusCode).toBe(400);
    });

    it('refuse un numéro de téléphone invalide (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ambassador/withdrawals')
        .set(auth(tokenA))
        .send({ amount: 5000, phone_number: 'abc', operator: 'mtn' });
      expect(res.statusCode).toBe(400);
    });

    it('liste mes retraits (vide)', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/withdrawals')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.withdrawals).toBeInstanceOf(Array);
    });

    it('crée un retrait après avoir crédité manuellement le solde', async () => {
      // Créditer directement en base pour simuler une commission approuvée
      await pool.query(
        `UPDATE ambassador_profiles
         SET available_balance = 25000
         WHERE id = $1`,
        [ambassadorProfileId]
      );

      const res = await request(app)
        .post('/api/v1/ambassador/withdrawals')
        .set(auth(tokenA))
        .send({ amount: 15000, phone_number: '+22997123456', operator: 'mtn' });

      expect(res.statusCode).toBe(201);
      expect(parseInt(res.body.data.withdrawal.amount, 10)).toBe(15000);
      expect(res.body.data.withdrawal.status).toBe('pending');
      expect(res.body.data.withdrawal.operator).toBe('mtn');
    });

    it('le solde est débité après la demande', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/dashboard')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.stats.available_balance).toBe(10000); // 25000 - 15000
    });
  });

  // =========================================================================
  // 8. Routes Admin (refusées pour un utilisateur standard)
  // =========================================================================
  describe('8. Routes Admin — access control', () => {
    it('refuse l\'accès à la liste admin pour un non-admin (403)', async () => {
      const res = await request(app)
        .get('/api/v1/ambassador/admin/list')
        .set(auth(tokenA));
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('refuse l\'approbation de commission pour un non-admin (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/ambassador/admin/commissions/${commissionId}`)
        .set(auth(tokenA));
      expect(res.statusCode).toBe(403);
    });
  });
});
