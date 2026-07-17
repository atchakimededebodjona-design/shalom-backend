const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-tools-';
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'Tools Tester' };

let token;
let titheId; let eventId; let listId; const taskIds = [];
let units = {};

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Module Tools', () => {
  beforeAll(async () => {
    // Les tables du module référencent users(id) en ON DELETE CASCADE :
    // supprimer le compte suffit à nettoyer dîmes, événements, listes, tâches
    // et historique de conversion. Le référentiel d'unités est commun (non touché).
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    const res = await request(app).post('/api/v1/auth/register').send(user);
    token = res.body.data.tokens.access_token;

    // Référentiel : on récupère les identifiants d'unités utilisés par les tests.
    const u = await request(app).get('/api/v1/tools/units').set(auth());
    u.body.data.categories.forEach((c) => c.units.forEach((x) => { units[x.symbol] = x.id; }));
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  });

  describe('Calculatrice de dîme', () => {
    it('calcule la dîme côté serveur (10 % de 200 000 = 20 000)', async () => {
      const res = await request(app).post('/api/v1/tools/tithe').set(auth())
        .send({ income_amount: 200000, tithe_percentage: 10, offering_amount: 5000 });
      expect(res.statusCode).toBe(201);
      expect(Number(res.body.data.calculation.tithe_amount)).toBe(20000);
      titheId = res.body.data.calculation.id;
    });

    it('respecte un pourcentage personnalisé (12,5 % = 25 000)', async () => {
      const res = await request(app).post('/api/v1/tools/tithe').set(auth())
        .send({ income_amount: 200000, tithe_percentage: 12.5 });
      expect(res.statusCode).toBe(201);
      expect(Number(res.body.data.calculation.tithe_amount)).toBe(25000);
    });

    it('applique 10 % par défaut', async () => {
      const res = await request(app).post('/api/v1/tools/tithe').set(auth()).send({ income_amount: 50000 });
      expect(res.statusCode).toBe(201);
      expect(Number(res.body.data.calculation.tithe_amount)).toBe(5000);
    });

    it('refuse un revenu nul ou négatif (400)', async () => {
      const res = await request(app).post('/api/v1/tools/tithe').set(auth()).send({ income_amount: 0 });
      expect(res.statusCode).toBe(400);
    });

    it("liste l'historique avec pagination", async () => {
      const res = await request(app).get('/api/v1/tools/tithe').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.pagination.total_count).toBeGreaterThanOrEqual(3);
    });

    it('horodate le paiement puis l\'efface', async () => {
      const paid = await request(app).patch(`/api/v1/tools/tithe/${titheId}`).set(auth()).send({ is_paid: true });
      expect(paid.statusCode).toBe(200);
      expect(paid.body.data.calculation.paid_at).not.toBeNull();

      const unpaid = await request(app).patch(`/api/v1/tools/tithe/${titheId}`).set(auth()).send({ is_paid: false });
      expect(unpaid.body.data.calculation.paid_at).toBeNull();
    });

    it('filtre par statut de paiement', async () => {
      const res = await request(app).get('/api/v1/tools/tithe?is_paid=false').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.calculations.every((c) => c.is_paid === false)).toBe(true);
    });

    it('supprime un calcul', async () => {
      const res = await request(app).delete(`/api/v1/tools/tithe/${titheId}`).set(auth());
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Événements personnels', () => {
    it('planifie un événement', async () => {
      const res = await request(app).post('/api/v1/tools/personal-events').set(auth())
        .send({ title: 'Jeûne de 3 jours', event_type: 'jeune', start_date: '2026-08-01T06:00:00Z', end_date: '2026-08-03T18:00:00Z', reminder_enabled: true, reminder_before_minutes: 120 });
      expect(res.statusCode).toBe(201);
      eventId = res.body.data.event.id;
    });

    it('liste avec pagination', async () => {
      const res = await request(app).get('/api/v1/tools/personal-events').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.pagination.total_count).toBeGreaterThanOrEqual(1);
    });

    it('filtre par type', async () => {
      const res = await request(app).get('/api/v1/tools/personal-events?event_type=jeune').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.events.every((e) => e.event_type === 'jeune')).toBe(true);
    });

    it('met à jour le statut', async () => {
      const res = await request(app).patch(`/api/v1/tools/personal-events/${eventId}`).set(auth())
        .send({ status: 'completed' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.event.status).toBe('completed');
    });

    it('refuse un type invalide (400)', async () => {
      const res = await request(app).post('/api/v1/tools/personal-events').set(auth())
        .send({ title: 'X', event_type: 'invalide', start_date: '2026-08-01T06:00:00Z' });
      expect(res.statusCode).toBe(400);
    });

    it('supprime un événement', async () => {
      const res = await request(app).delete(`/api/v1/tools/personal-events/${eventId}`).set(auth());
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Listes et tâches', () => {
    it('crée une liste', async () => {
      const res = await request(app).post('/api/v1/tools/task-lists').set(auth()).send({ title: 'Ma liste test' });
      expect(res.statusCode).toBe(201);
      listId = res.body.data.list.id;
    });

    it('ajoute des tâches avec position automatique', async () => {
      for (const content of ['Tâche A', 'Tâche B', 'Tâche C']) {
        const res = await request(app).post('/api/v1/tools/tasks').set(auth()).send({ list_id: listId, content });
        expect(res.statusCode).toBe(201);
        taskIds.push(res.body.data.task.id);
      }
    });

    it('renvoie les tâches triées par position', async () => {
      const res = await request(app).get(`/api/v1/tools/task-lists/${listId}`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.list.tasks.map((t) => t.content)).toEqual(['Tâche A', 'Tâche B', 'Tâche C']);
    });

    it('réordonne les tâches et renumérote les positions 1..n', async () => {
      const res = await request(app).patch(`/api/v1/tools/task-lists/${listId}/reorder`).set(auth())
        .send({ ordered_ids: [taskIds[2], taskIds[0], taskIds[1]] });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.tasks.map((t) => t.content)).toEqual(['Tâche C', 'Tâche A', 'Tâche B']);
      expect(res.body.data.tasks.map((t) => t.position)).toEqual([1, 2, 3]);
    });

    it('rejette un réordonnancement contenant une tâche étrangère (404)', async () => {
      const res = await request(app).patch(`/api/v1/tools/task-lists/${listId}/reorder`).set(auth())
        .send({ ordered_ids: ['00000000-0000-0000-0000-000000000000'] });
      expect(res.statusCode).toBe(404);
    });

    it('coche une tâche puis la décoche', async () => {
      const done = await request(app).patch(`/api/v1/tools/tasks/${taskIds[0]}`).set(auth()).send({ is_completed: true });
      expect(done.statusCode).toBe(200);
      expect(done.body.data.task.completed_at).not.toBeNull();

      const undone = await request(app).patch(`/api/v1/tools/tasks/${taskIds[0]}`).set(auth()).send({ is_completed: false });
      expect(undone.body.data.task.completed_at).toBeNull();
    });

    it('expose les compteurs de la liste', async () => {
      const res = await request(app).get('/api/v1/tools/task-lists').set(auth());
      const l = res.body.data.lists.find((x) => x.id === listId);
      expect(l.tasks_count).toBe(3);
      expect(l.completed_count).toBe(0);
    });

    it('filtre les tâches par liste et statut', async () => {
      const res = await request(app).get(`/api/v1/tools/tasks?list_id=${listId}&is_completed=false`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.tasks.length).toBe(3);
    });

    it('refuse une tâche sur une liste inexistante (404)', async () => {
      const res = await request(app).post('/api/v1/tools/tasks').set(auth())
        .send({ list_id: '00000000-0000-0000-0000-000000000000', content: 'x' });
      expect(res.statusCode).toBe(404);
    });

    it('supprime une tâche puis la liste', async () => {
      const t = await request(app).delete(`/api/v1/tools/tasks/${taskIds[0]}`).set(auth());
      expect(t.statusCode).toBe(200);
      const l = await request(app).delete(`/api/v1/tools/task-lists/${listId}`).set(auth());
      expect(l.statusCode).toBe(200);
    });
  });

  describe("Convertisseur d'unités", () => {
    it('expose le référentiel groupé par catégorie', async () => {
      const res = await request(app).get('/api/v1/tools/units').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.categories.length).toBe(4);
      const total = res.body.data.categories.reduce((s, c) => s + c.units.length, 0);
      expect(total).toBe(18);
    });

    it('convertit 5 km en 5000 m', async () => {
      const res = await request(app).post('/api/v1/tools/units/convert').set(auth())
        .send({ from_unit_id: units.km, to_unit_id: units.m, value: 5 });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.conversion.result).toBe(5000);
    });

    it('convertit 1609,344 m en 1 mille', async () => {
      const res = await request(app).post('/api/v1/tools/units/convert').set(auth())
        .send({ from_unit_id: units.m, to_unit_id: units.mi, value: 1609.344 });
      expect(res.body.data.conversion.result).toBeCloseTo(1, 9);
    });

    it('convertit 1 EUR en 655,957 XOF (parité fixe)', async () => {
      const res = await request(app).post('/api/v1/tools/units/convert').set(auth())
        .send({ from_unit_id: units.EUR, to_unit_id: units.XOF, value: 1 });
      expect(res.body.data.conversion.result).toBeCloseTo(655.957, 6);
    });

    it('refuse une conversion entre catégories différentes (400)', async () => {
      const res = await request(app).post('/api/v1/tools/units/convert').set(auth())
        .send({ from_unit_id: units.km, to_unit_id: units.kg, value: 1 });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('CATEGORY_MISMATCH');
    });

    it('renvoie 404 pour une unité inexistante', async () => {
      const res = await request(app).post('/api/v1/tools/units/convert').set(auth())
        .send({ from_unit_id: '00000000-0000-0000-0000-000000000000', to_unit_id: units.m, value: 1 });
      expect(res.statusCode).toBe(404);
    });

    it("mémorise l'historique des conversions", async () => {
      const res = await request(app).get('/api/v1/tools/units/history').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Gardes et validations', () => {
    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/tools/tithe');
      expect(res.statusCode).toBe(401);
    });

    it('renvoie 400 pour un id non-UUID', async () => {
      const res = await request(app).get('/api/v1/tools/tasks/pas-un-uuid').set(auth());
      expect(res.statusCode).toBe(400);
    });
  });
});
