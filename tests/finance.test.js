const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-finance-';
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'Finance Tester' };

let token;
let catInId; let catExId; let txId; let goalId;

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Module Finance', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    const res = await request(app).post('/api/v1/auth/register').send(user);
    token = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    // Les tables finance_* ont ON DELETE CASCADE sur user_id : supprimer le
    // compte suffit à nettoyer catégories, transactions, objectifs et résumés.
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  });

  describe('Catégories', () => {
    it('crée une catégorie de revenu', async () => {
      const res = await request(app).post('/api/v1/finance/categories').set(auth()).send({ name: 'Salaire', type: 'income' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.category.id).toBeDefined();
      catInId = res.body.data.category.id;
    });

    it('crée une catégorie de dépense', async () => {
      const res = await request(app).post('/api/v1/finance/categories').set(auth()).send({ name: 'Courses', type: 'expense', icon: '🛒' });
      expect(res.statusCode).toBe(201);
      catExId = res.body.data.category.id;
    });

    it('liste les catégories', async () => {
      const res = await request(app).get('/api/v1/finance/categories').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.categories.length).toBeGreaterThanOrEqual(2);
    });

    it('filtre les catégories par type', async () => {
      const res = await request(app).get('/api/v1/finance/categories?type=expense').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.categories.every((c) => c.type === 'expense')).toBe(true);
    });

    it('met à jour une catégorie', async () => {
      const res = await request(app).patch(`/api/v1/finance/categories/${catExId}`).set(auth()).send({ name: 'Courses maison' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.category.name).toBe('Courses maison');
    });

    it('refuse un type invalide (400)', async () => {
      const res = await request(app).post('/api/v1/finance/categories').set(auth()).send({ name: 'X', type: 'bad' });
      expect(res.statusCode).toBe(400);
    });

    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/finance/categories');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Transactions', () => {
    it('enregistre un revenu', async () => {
      const res = await request(app).post('/api/v1/finance/transactions').set(auth())
        .send({ type: 'income', amount: 200000, transaction_date: '2026-07-05', category_id: catInId, note: 'Salaire juillet' });
      expect(res.statusCode).toBe(201);
      txId = res.body.data.transaction.id;
    });

    it('enregistre une dépense', async () => {
      const res = await request(app).post('/api/v1/finance/transactions').set(auth())
        .send({ type: 'expense', amount: 35000, transaction_date: '2026-07-10', category_id: catExId });
      expect(res.statusCode).toBe(201);
    });

    it('refuse un montant négatif ou nul (400)', async () => {
      const res = await request(app).post('/api/v1/finance/transactions').set(auth())
        .send({ type: 'income', amount: -5, transaction_date: '2026-07-01' });
      expect(res.statusCode).toBe(400);
    });

    it('liste les transactions avec pagination', async () => {
      const res = await request(app).get('/api/v1/finance/transactions').set(auth());
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.transactions)).toBe(true);
      expect(res.body.data.pagination.total_count).toBeGreaterThanOrEqual(2);
    });

    it('filtre par type', async () => {
      const res = await request(app).get('/api/v1/finance/transactions?type=expense').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.transactions.every((t) => t.type === 'expense')).toBe(true);
    });

    it('récupère une transaction avec le nom de catégorie', async () => {
      const res = await request(app).get(`/api/v1/finance/transactions/${txId}`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.transaction.category_name).toBe('Salaire');
    });

    it('met à jour le montant', async () => {
      const res = await request(app).patch(`/api/v1/finance/transactions/${txId}`).set(auth()).send({ amount: 210000 });
      expect(res.statusCode).toBe(200);
      expect(Number(res.body.data.transaction.amount)).toBe(210000);
    });

    it('renvoie 404 pour un id inexistant', async () => {
      const res = await request(app).get('/api/v1/finance/transactions/00000000-0000-0000-0000-000000000000').set(auth());
      expect(res.statusCode).toBe(404);
    });

    it('renvoie 400 pour un id non-UUID', async () => {
      const res = await request(app).get('/api/v1/finance/transactions/pas-un-uuid').set(auth());
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Objectifs', () => {
    it('crée un objectif', async () => {
      const res = await request(app).post('/api/v1/finance/goals').set(auth())
        .send({ title: 'Fonds urgence', target_amount: 500000, current_amount: 50000, target_date: '2026-12-31' });
      expect(res.statusCode).toBe(201);
      goalId = res.body.data.goal.id;
    });

    it('liste les objectifs', async () => {
      const res = await request(app).get('/api/v1/finance/goals').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.goals.length).toBeGreaterThanOrEqual(1);
    });

    it('met à jour la progression', async () => {
      const res = await request(app).patch(`/api/v1/finance/goals/${goalId}`).set(auth()).send({ current_amount: 120000 });
      expect(res.statusCode).toBe(200);
      expect(Number(res.body.data.goal.current_amount)).toBe(120000);
    });

    it('refuse un montant cible nul (400)', async () => {
      const res = await request(app).post('/api/v1/finance/goals').set(auth()).send({ title: 'X', target_amount: 0 });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Analyse', () => {
    it('calcule le résumé mensuel', async () => {
      const res = await request(app).get('/api/v1/finance/summary?year_month=2026-07').set(auth());
      expect(res.statusCode).toBe(200);
      const s = res.body.data.summary;
      expect(Number(s.total_income)).toBe(210000);
      expect(Number(s.total_expense)).toBe(35000);
      expect(Number(s.savings_rate)).toBeCloseTo(83.33, 1);
      expect(Number(s.balance)).toBe(175000);
    });

    it("renvoie l'aperçu global (solde = revenus - dépenses)", async () => {
      const res = await request(app).get('/api/v1/finance/overview').set(auth());
      expect(res.statusCode).toBe(200);
      const o = res.body.data.overview;
      expect(Number(o.balance)).toBe(Number(o.total_income) - Number(o.total_expense));
      expect(o.active_goals).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Suppression (soft delete)', () => {
    it('supprime la transaction', async () => {
      const res = await request(app).delete(`/api/v1/finance/transactions/${txId}`).set(auth());
      expect(res.statusCode).toBe(200);
    });

    it('supprime l\'objectif', async () => {
      const res = await request(app).delete(`/api/v1/finance/goals/${goalId}`).set(auth());
      expect(res.statusCode).toBe(200);
    });

    it('supprime la catégorie', async () => {
      const res = await request(app).delete(`/api/v1/finance/categories/${catExId}`).set(auth());
      expect(res.statusCode).toBe(200);
    });
  });
});
