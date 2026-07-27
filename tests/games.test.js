// tests/games.test.js
// Tests d'intégration HTTP du module Jeux (supertest), au même format que les
// autres suites du backend. Couvre : catalogue, cycle de vie d'une session
// (start/answer/end), XP/niveau, et classement.
//
// NB (cf. mémoire projet) : les tests tournent sur la même base Supabase que le
// dev. On isole donc par préfixe et on nettoie en beforeAll/afterAll. Les jeux/
// questions/choix sont des données de référence partagées (seed migrations
// 022-023) : on les lit, on ne les supprime jamais.

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-games-';
const user = {
  email: `${PREFIX}user@shalom.dev`,
  password: 'Password123!',
  display_name: 'Games Tester',
};

let token;
let userId;
let quizGameId;
let quizBasePoints;

const auth = () => ({ Authorization: `Bearer ${token}` });

const cleanup = async () => {
  // game_sessions / user_game_stats / user_xp / xp_transactions partent en
  // cascade avec l'utilisateur (toutes REFERENCES users(id) ON DELETE CASCADE).
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
};

describe('Module Games (Jeux)', () => {
  beforeAll(async () => {
    await cleanup();
    const res = await request(app).post('/api/v1/auth/register').send(user);
    token = res.body.data.tokens.access_token;
    userId = res.body.data.user.id;

    const gameRes = await pool.query("SELECT id FROM games WHERE code = 'quiz_biblique'");
    quizGameId = gameRes.rows[0].id;
    const pointsRes = await pool.query(
      'SELECT base_points FROM questions WHERE game_id = $1 AND difficulty = 1 LIMIT 1',
      [quizGameId]
    );
    quizBasePoints = pointsRes.rows[0].base_points;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Catalogue', () => {
    it('liste les jeux actifs', async () => {
      const res = await request(app).get('/api/v1/games').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.games.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.games.some((g) => g.code === 'quiz_biblique')).toBe(true);
    });

    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/games');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Démarrage de session', () => {
    it('refuse sans gameId (400)', async () => {
      const res = await request(app).post('/api/v1/games/sessions').set(auth()).send({});
      expect(res.statusCode).toBe(400);
    });

    it('renvoie 404 pour un jeu inexistant', async () => {
      const res = await request(app).post('/api/v1/games/sessions').set(auth())
        .send({ gameId: '00000000-0000-0000-0000-000000000000' });
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('GAME_NOT_FOUND');
    });

    it("renvoie 422 quand aucune question ne correspond aux critères", async () => {
      const res = await request(app).post('/api/v1/games/sessions').set(auth())
        .send({ gameId: quizGameId, categoryId: '00000000-0000-0000-0000-000000000000' });
      expect(res.statusCode).toBe(422);
      expect(res.body.code).toBe('NO_QUESTIONS_AVAILABLE');
    });

    it('démarre une session avec des questions sans révéler la bonne réponse', async () => {
      const res = await request(app).post('/api/v1/games/sessions').set(auth())
        .send({ gameId: quizGameId, questionCount: 3 });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.sessionId).toBeTruthy();
      expect(res.body.data.questions.length).toBe(3);
      const [q] = res.body.data.questions;
      expect(q.choices.length).toBeGreaterThan(0);
      expect(q.choices[0].is_correct).toBeUndefined();
    });
  });

  describe("Cycle de vie d'une partie (réponses + clôture)", () => {
    let sessionId;
    let questions;
    let expectedScore = 0;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/games/sessions').set(auth())
        .send({ gameId: quizGameId, questionCount: 2 });
      sessionId = res.body.data.sessionId;
      questions = res.body.data.questions;
    });

    it('répond correctement à la première question (isCorrect=true, points=base_points)', async () => {
      const q = questions[0];
      const choicesRes = await pool.query(
        'SELECT id FROM question_choices WHERE question_id = $1 AND is_correct = true',
        [q.id]
      );
      const correctChoiceId = choicesRes.rows[0].id;

      const res = await request(app)
        .post(`/api/v1/games/sessions/${sessionId}/answers`).set(auth())
        .send({ questionId: q.id, choiceId: correctChoiceId });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isCorrect).toBe(true);
      expect(res.body.data.pointsEarned).toBe(quizBasePoints);
      expectedScore += quizBasePoints;
    });

    it('répond incorrectement à la deuxième question (isCorrect=false, points=0)', async () => {
      const q = questions[1];
      const choicesRes = await pool.query(
        'SELECT id FROM question_choices WHERE question_id = $1 AND is_correct = false LIMIT 1',
        [q.id]
      );
      const wrongChoiceId = choicesRes.rows[0].id;

      const res = await request(app)
        .post(`/api/v1/games/sessions/${sessionId}/answers`).set(auth())
        .send({ questionId: q.id, choiceId: wrongChoiceId });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isCorrect).toBe(false);
      expect(res.body.data.pointsEarned).toBe(0);
    });

    it('refuse de répondre pour une session inexistante (404)', async () => {
      const res = await request(app)
        .post('/api/v1/games/sessions/00000000-0000-0000-0000-000000000000/answers').set(auth())
        .send({ questionId: questions[0].id, choiceId: questions[0].choices[0].id });
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('clôture la session : score, XP et niveau cohérents', async () => {
      const res = await request(app).post(`/api/v1/games/sessions/${sessionId}/end`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.score).toBe(expectedScore);
      expect(res.body.data.xpGained).toBe(expectedScore);
      expect(res.body.data.totalXp).toBe(expectedScore);
      expect(res.body.data.level).toBe(1);
    });

    it('est idempotente : une 2e clôture renvoie alreadyCompleted=true sans changer le score', async () => {
      const res = await request(app).post(`/api/v1/games/sessions/${sessionId}/end`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.alreadyCompleted).toBe(true);
      expect(res.body.data.score).toBe(expectedScore);
    });

    it('apparaît dans le classement global avec le bon total de points', async () => {
      const res = await request(app).get('/api/v1/games/leaderboard').set(auth());
      expect(res.statusCode).toBe(200);
      const entry = res.body.data.leaderboard.find((e) => e.user_id === userId);
      expect(entry).toBeTruthy();
      expect(Number(entry.total_points)).toBe(expectedScore);
    });
  });

  describe('Validation', () => {
    it('refuse un gameId non-UUID (400)', async () => {
      const res = await request(app).post('/api/v1/games/sessions').set(auth())
        .send({ gameId: 'pas-un-uuid' });
      expect(res.statusCode).toBe(400);
    });

    it('refuse un limit hors bornes sur le classement (400)', async () => {
      const res = await request(app).get('/api/v1/games/leaderboard?limit=500').set(auth());
      expect(res.statusCode).toBe(400);
    });
  });
});
