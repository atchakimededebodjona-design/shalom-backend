// tests/games-duel-daily.test.js
// Tests d'intégration HTTP des modes Duel ("Bataille Biblique") et Défi
// quotidien du module Jeux (supertest). Même convention que games.test.js :
// tourne sur la vraie base Supabase, isolé par préfixe, nettoyé en
// beforeAll/afterAll.

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const PREFIX = 'test-jest-games-duel-';
const player1 = { email: `${PREFIX}p1@shalom.dev`, password: 'Password123!', display_name: 'Duel P1' };
const player2 = { email: `${PREFIX}p2@shalom.dev`, password: 'Password123!', display_name: 'Duel P2' };
const outsider = { email: `${PREFIX}outsider@shalom.dev`, password: 'Password123!', display_name: 'Outsider' };

let token1, userId1;
let token2, userId2;
let tokenOutsider;
let quizGameId;

const auth = (t) => ({ Authorization: `Bearer ${t}` });

const cleanup = async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
};

const correctChoiceFor = async (questionId) => {
  const res = await pool.query(
    'SELECT id FROM question_choices WHERE question_id = $1 AND is_correct = true',
    [questionId]
  );
  return res.rows[0].id;
};

const wrongChoiceFor = async (questionId) => {
  const res = await pool.query(
    'SELECT id FROM question_choices WHERE question_id = $1 AND is_correct = false LIMIT 1',
    [questionId]
  );
  return res.rows[0].id;
};

describe('Module Games — Duels et Défi quotidien', () => {
  beforeAll(async () => {
    await cleanup();

    let { verifyRes: res } = await registerAndVerify(player1);
    token1 = res.body.data.tokens.access_token;
    userId1 = res.body.data.user.id;

    ({ verifyRes: res } = await registerAndVerify(player2));
    token2 = res.body.data.tokens.access_token;
    userId2 = res.body.data.user.id;

    ({ verifyRes: res } = await registerAndVerify(outsider));
    tokenOutsider = res.body.data.tokens.access_token;

    const gameRes = await pool.query("SELECT id FROM games WHERE code = 'quiz_biblique'");
    quizGameId = gameRes.rows[0].id;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Duel — cycle de vie complet', () => {
    let duelId;
    let p1Session;
    let p2Session;

    it('joueur 1 crée un duel : statut waiting, sa session démarre aussitôt', async () => {
      const res = await request(app).post('/api/v1/games/duels').set(auth(token1))
        .send({ gameId: quizGameId, questionCount: 2 });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.status).toBe('waiting');
      expect(res.body.data.session.questions.length).toBe(2);
      duelId = res.body.data.duelId;
      p1Session = res.body.data.session;
    });

    it('apparaît dans les duels ouverts pour un autre joueur', async () => {
      const res = await request(app).get('/api/v1/games/duels?open=true').set(auth(token2));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.duels.some((d) => d.id === duelId)).toBe(true);
    });

    it("refuse que le créateur rejoigne son propre duel (409)", async () => {
      const res = await request(app).post(`/api/v1/games/duels/${duelId}/join`).set(auth(token1));
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('CANNOT_JOIN_OWN_DUEL');
    });

    it('joueur 2 rejoint le duel : mêmes questions, dans le même ordre', async () => {
      const res = await request(app).post(`/api/v1/games/duels/${duelId}/join`).set(auth(token2));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('active');
      p2Session = res.body.data.session;
      expect(p2Session.questions.map((q) => q.id)).toEqual(p1Session.questions.map((q) => q.id));
    });

    it('refuse un 3e joueur sur un duel déjà complet (409)', async () => {
      const res = await request(app).post(`/api/v1/games/duels/${duelId}/join`).set(auth(tokenOutsider));
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('DUEL_NOT_JOINABLE');
    });

    it("refuse l'accès au duel à un tiers (403)", async () => {
      const res = await request(app).get(`/api/v1/games/duels/${duelId}`).set(auth(tokenOutsider));
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('DUEL_ACCESS_DENIED');
    });

    it('joueur 1 répond juste aux deux questions, joueur 2 se trompe : joueur 1 gagne', async () => {
      for (const q of p1Session.questions) {
        const choiceId = await correctChoiceFor(q.id);
        const res = await request(app)
          .post(`/api/v1/games/sessions/${p1Session.sessionId}/answers`).set(auth(token1))
          .send({ questionId: q.id, choiceId });
        expect(res.body.data.isCorrect).toBe(true);
      }
      await request(app).post(`/api/v1/games/sessions/${p1Session.sessionId}/end`).set(auth(token1));

      for (const q of p2Session.questions) {
        const choiceId = await wrongChoiceFor(q.id);
        const res = await request(app)
          .post(`/api/v1/games/sessions/${p2Session.sessionId}/answers`).set(auth(token2))
          .send({ questionId: q.id, choiceId });
        expect(res.body.data.isCorrect).toBe(false);
      }
      await request(app).post(`/api/v1/games/sessions/${p2Session.sessionId}/end`).set(auth(token2));
    });

    it('le duel se finalise à la lecture : status completed, winnerId = joueur 1', async () => {
      const res = await request(app).get(`/api/v1/games/duels/${duelId}`).set(auth(token1));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.winnerId).toBe(userId1);
      expect(res.body.data.playerOneScore).toBeGreaterThan(res.body.data.playerTwoScore);
    });

    it('apparaît dans "mes duels" pour les deux joueurs', async () => {
      const res1 = await request(app).get('/api/v1/games/duels').set(auth(token1));
      const res2 = await request(app).get('/api/v1/games/duels').set(auth(token2));
      expect(res1.body.data.duels.some((d) => d.id === duelId)).toBe(true);
      expect(res2.body.data.duels.some((d) => d.id === duelId)).toBe(true);
    });

    it('renvoie 404 pour un duel inexistant', async () => {
      const res = await request(app)
        .get('/api/v1/games/duels/00000000-0000-0000-0000-000000000000').set(auth(token1));
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Défi quotidien', () => {
    let challengeId;
    let questionCount;
    let session;

    it("renvoie (et génère si besoin) le défi du jour, non complété au départ", async () => {
      const res = await request(app).get('/api/v1/games/daily').set(auth(token1));
      expect(res.statusCode).toBe(200);
      expect(res.body.data.challengeId).toBeTruthy();
      expect(res.body.data.completed).toBe(false);
      challengeId = res.body.data.challengeId;
      questionCount = res.body.data.questionCount;
    });

    it('démarre la session du défi du jour', async () => {
      const res = await request(app).post('/api/v1/games/daily/start').set(auth(token1));
      expect(res.statusCode).toBe(201);
      expect(res.body.data.questions.length).toBe(questionCount);
      session = res.body.data;
    });

    it('répondre puis clôturer crédite un bonus XP et marque le défi complété', async () => {
      let expectedScore = 0;
      for (const q of session.questions) {
        const choiceId = await correctChoiceFor(q.id);
        const res = await request(app)
          .post(`/api/v1/games/sessions/${session.sessionId}/answers`).set(auth(token1))
          .send({ questionId: q.id, choiceId });
        expectedScore += res.body.data.pointsEarned;
      }
      const endRes = await request(app)
        .post(`/api/v1/games/sessions/${session.sessionId}/end`).set(auth(token1));
      expect(endRes.body.data.score).toBe(expectedScore);
      expect(endRes.body.data.dailyBonus).toBeGreaterThan(0);
      expect(endRes.body.data.xpGained).toBe(expectedScore + endRes.body.data.dailyBonus);

      const dailyRes = await request(app).get('/api/v1/games/daily').set(auth(token1));
      expect(dailyRes.body.data.completed).toBe(true);
      expect(dailyRes.body.data.challengeId).toBe(challengeId);
    });

    it('refuse de redémarrer le défi du jour déjà complété (409)', async () => {
      const res = await request(app).post('/api/v1/games/daily/start').set(auth(token1));
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('DAILY_CHALLENGE_ALREADY_COMPLETED');
    });
  });
});
