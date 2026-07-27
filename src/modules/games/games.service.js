'use strict';

const { pool, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// XP requis pour passer au niveau N — courbe simple, ajustable
function xpForLevel(level) {
  return 100 * level * level;
}

function computeLevelFromXp(totalXp) {
  let level = 1;
  while (totalXp >= xpForLevel(level + 1)) level += 1;
  return level;
}

// ============================================================================
// Helpers internes partagés (session solo / duel / défi quotidien)
// ============================================================================

/**
 * Mélange un tableau in place (Fisher-Yates). Utilisé pour que la bonne
 * réponse ne se retrouve pas toujours au même rang dans les choix affichés
 * (les questions du seed ont souvent été saisies avec la bonne réponse en
 * premier).
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Sélectionne aléatoirement N ids de questions actives pour un jeu/difficulté/
 * catégorie donnés. Renvoie [] si rien ne correspond (à l'appelant de décider
 * si c'est une erreur).
 */
async function pickRandomQuestionIds(client, { gameId, difficulty, categoryId, questionCount }) {
  const res = await client.query(
    `SELECT id FROM questions
     WHERE game_id = $1 AND difficulty = $2 AND is_active = true AND deleted_at IS NULL
       AND ($3::uuid IS NULL OR category_id = $3)
     ORDER BY random()
     LIMIT $4`,
    [gameId, difficulty, categoryId, questionCount]
  );
  return res.rows.map((r) => r.id);
}

/**
 * Construit le payload questions+choix (SANS is_correct) pour une liste
 * ORDONNÉE d'ids de questions — l'ordre fourni est conservé, ce qui compte
 * pour l'équité d'un duel (les deux joueurs voient les questions dans le
 * même ordre).
 */
async function buildQuestionsPayload(client, questionIds) {
  if (questionIds.length === 0) return [];

  const questionsRes = await client.query(
    `SELECT id, question_type, prompt, media_url, base_points
     FROM questions WHERE id = ANY($1::uuid[])`,
    [questionIds]
  );
  const byId = new Map(questionsRes.rows.map((q) => [q.id, q]));

  const choicesRes = await client.query(
    `SELECT id, question_id, choice_text, display_order
     FROM question_choices
     WHERE question_id = ANY($1::uuid[])
     ORDER BY question_id, display_order`,
    [questionIds]
  );
  const choicesByQuestion = choicesRes.rows.reduce((acc, c) => {
    (acc[c.question_id] ||= []).push({ id: c.id, text: c.choice_text });
    return acc;
  }, {});

  return questionIds.map((id) => {
    const q = byId.get(id);
    return {
      id: q.id,
      type: q.question_type,
      prompt: q.prompt,
      mediaUrl: q.media_url,
      basePoints: q.base_points,
      // Mélangé à chaque session : la position de la bonne réponse ne doit
      // jamais être déductible de l'ordre de saisie en base.
      choices: shuffle([...(choicesByQuestion[q.id] || [])]),
    };
  });
}

/**
 * Crée la ligne game_sessions pour un lot de questions déjà déterminé, et
 * renvoie le payload prêt pour le client (sessionId + questions).
 */
async function createSession(client, { userId, gameId, mode, difficulty, questionIds, metadata = {} }) {
  const sessionRes = await client.query(
    `INSERT INTO game_sessions (user_id, game_id, mode, difficulty, status, metadata)
     VALUES ($1, $2, $3, $4, 'in_progress', $5::jsonb)
     RETURNING id, started_at`,
    [userId, gameId, mode, difficulty, JSON.stringify(metadata)]
  );
  const session = sessionRes.rows[0];
  const questions = await buildQuestionsPayload(client, questionIds);
  return { sessionId: session.id, startedAt: session.started_at, questions };
}

// ============================================================================
// Catalogue
// ============================================================================

/**
 * Liste des jeux actifs (catalogue affiché à l'utilisateur).
 */
async function listGames() {
  const { rows } = await pool.query(
    `SELECT id, code, name, description, engine_type, icon_url, config, display_order
     FROM games
     WHERE is_active = true AND deleted_at IS NULL
     ORDER BY display_order ASC`
  );
  return rows;
}

// ============================================================================
// Session solo — démarrage / réponse / clôture
// ============================================================================

/**
 * Démarre une session solo : sélectionne un lot de questions selon la
 * difficulté et la catégorie, crée la session, renvoie les questions SANS la
 * bonne réponse.
 */
async function startSession({ userId, gameId, difficulty = 1, categoryId = null, questionCount = 10, mode = 'solo' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameRes = await client.query(
      `SELECT id FROM games WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [gameId]
    );
    if (gameRes.rows.length === 0) {
      throw new AppError('Jeu introuvable ou inactif', 404, 'GAME_NOT_FOUND');
    }

    const questionIds = await pickRandomQuestionIds(client, { gameId, difficulty, categoryId, questionCount });
    if (questionIds.length === 0) {
      throw new AppError('Aucune question disponible pour ces critères', 422, 'NO_QUESTIONS_AVAILABLE');
    }

    const result = await createSession(client, { userId, gameId, mode, difficulty, questionIds });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Soumet une réponse à une question de la session (solo, duel ou défi
 * quotidien — le mécanisme est le même quelle que soit l'origine de la session).
 */
async function submitAnswer({ userId, sessionId, questionId, choiceId, timeTakenMs }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verrouille la session pour éviter les doubles soumissions concurrentes
    const sessionRes = await client.query(
      `SELECT id, user_id, game_id, status, difficulty FROM game_sessions
       WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session || session.user_id !== userId) {
      throw new AppError('Session introuvable', 404, 'SESSION_NOT_FOUND');
    }
    if (session.status !== 'in_progress') {
      throw new AppError('Session déjà terminée', 409, 'SESSION_ALREADY_COMPLETED');
    }

    const questionRes = await client.query(
      `SELECT id, base_points FROM questions WHERE id = $1 AND game_id = $2`,
      [questionId, session.game_id]
    );
    const question = questionRes.rows[0];
    if (!question) {
      throw new AppError('Question introuvable', 404, 'QUESTION_NOT_FOUND');
    }

    let isCorrect = false;
    if (choiceId) {
      const choiceRes = await client.query(
        `SELECT is_correct FROM question_choices WHERE id = $1 AND question_id = $2`,
        [choiceId, questionId]
      );
      isCorrect = choiceRes.rows[0]?.is_correct === true;
    }

    // Bonus de rapidité simple : jusqu'à +20% si répondu en moins de 5s
    let pointsEarned = 0;
    if (isCorrect) {
      const speedBonus = timeTakenMs && timeTakenMs < 5000 ? 1.2 : 1;
      pointsEarned = Math.round(question.base_points * speedBonus);
    }

    await client.query(
      `INSERT INTO session_answers (session_id, question_id, choice_id, is_correct, time_taken_ms, points_earned)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id, question_id) DO NOTHING`,
      [sessionId, questionId, choiceId || null, isCorrect, timeTakenMs || null, pointsEarned]
    );

    await client.query(
      `UPDATE game_sessions SET score = score + $1 WHERE id = $2`,
      [pointsEarned, sessionId]
    );

    await client.query('COMMIT');
    return { isCorrect, pointsEarned };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Clôture une session : fige le score, met à jour les stats agrégées, crédite
 * l'XP global (+ bonus et progression si la session provient d'un défi
 * quotidien).
 */
async function endSession({ userId, sessionId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(
      `SELECT id, user_id, game_id, score, status, metadata FROM game_sessions
       WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session || session.user_id !== userId) {
      throw new AppError('Session introuvable', 404, 'SESSION_NOT_FOUND');
    }
    if (session.status === 'completed') {
      await client.query('COMMIT');
      return { score: session.score, alreadyCompleted: true };
    }

    await client.query(
      `UPDATE game_sessions SET status = 'completed', ended_at = now() WHERE id = $1`,
      [sessionId]
    );

    // Upsert des stats agrégées par jeu
    await client.query(
      `INSERT INTO user_game_stats (user_id, game_id, total_sessions, best_score, total_points, last_played_at, updated_at)
       VALUES ($1, $2, 1, $3, $3, now(), now())
       ON CONFLICT (user_id, game_id) DO UPDATE SET
         total_sessions = user_game_stats.total_sessions + 1,
         best_score = GREATEST(user_game_stats.best_score, EXCLUDED.best_score),
         total_points = user_game_stats.total_points + EXCLUDED.total_points,
         last_played_at = now(),
         updated_at = now()`,
      [userId, session.game_id, session.score]
    );

    // Crédit XP global (1 point de score = 1 XP, ratio ajustable) + bonus
    // défi quotidien le cas échéant.
    let xpGained = session.score;
    let dailyBonus = 0;
    const dailyChallengeId = session.metadata?.dailyChallengeId || null;

    if (dailyChallengeId) {
      const dcRes = await client.query(
        `SELECT reward_xp FROM daily_challenges WHERE id = $1`,
        [dailyChallengeId]
      );
      if (dcRes.rows[0]) {
        dailyBonus = dcRes.rows[0].reward_xp;
        xpGained += dailyBonus;
        await client.query(
          `INSERT INTO user_daily_challenge_progress (user_id, challenge_id, completed, completed_at)
           VALUES ($1, $2, true, now())
           ON CONFLICT (user_id, challenge_id) DO UPDATE SET completed = true, completed_at = now()`,
          [userId, dailyChallengeId]
        );
      }
    }

    await client.query(
      `INSERT INTO xp_transactions (user_id, amount, source_type, source_id)
       VALUES ($1, $2, 'game_session', $3)`,
      [userId, xpGained, sessionId]
    );

    const xpRes = await client.query(
      `INSERT INTO user_xp (user_id, total_xp, level, updated_at)
       VALUES ($1, $2, 1, now())
       ON CONFLICT (user_id) DO UPDATE SET
         total_xp = user_xp.total_xp + EXCLUDED.total_xp,
         updated_at = now()
       RETURNING total_xp`,
      [userId, xpGained]
    );
    const newTotalXp = xpRes.rows[0].total_xp;
    const newLevel = computeLevelFromXp(newTotalXp);
    await client.query(`UPDATE user_xp SET level = $1 WHERE user_id = $2`, [newLevel, userId]);

    await client.query('COMMIT');
    return { score: session.score, xpGained, dailyBonus, totalXp: newTotalXp, level: newLevel };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// Classement (par jeu ou global)
// ============================================================================

async function getLeaderboard({ gameId = null, limit = 50 }) {
  if (gameId) {
    const { rows } = await pool.query(
      `SELECT ugs.user_id, ugs.total_points, ugs.best_score, p.display_name, p.avatar_url
       FROM user_game_stats ugs
       JOIN profiles p ON p.user_id = ugs.user_id
       WHERE ugs.game_id = $1
       ORDER BY ugs.total_points DESC
       LIMIT $2`,
      [gameId, limit]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT lg.user_id, lg.total_points, lg.rank, p.display_name, p.avatar_url
     FROM leaderboard_global lg
     JOIN profiles p ON p.user_id = lg.user_id
     ORDER BY lg.rank ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// ============================================================================
// Duels 1v1 ("Bataille Biblique")
//
// Les deux joueurs affrontent EXACTEMENT le même lot de questions, dans le
// même ordre (figé à la création du duel dans game_duels.question_ids), pour
// que le duel soit équitable. Le vainqueur est déterminé de façon paresseuse
// (à la lecture, cf. getDuel) dès que les deux sessions sont 'completed' —
// pas de job en arrière-plan nécessaire.
// ============================================================================

const DUEL_QUESTION_COUNT_DEFAULT = 10;

/**
 * Crée un duel : choisit le lot de questions, démarre la session du créateur,
 * et laisse le duel en statut 'waiting' jusqu'à ce qu'un adversaire rejoigne.
 */
async function createDuel({ userId, gameId, difficulty = 1, categoryId = null, questionCount = DUEL_QUESTION_COUNT_DEFAULT }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameRes = await client.query(
      `SELECT id FROM games WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [gameId]
    );
    if (gameRes.rows.length === 0) {
      throw new AppError('Jeu introuvable ou inactif', 404, 'GAME_NOT_FOUND');
    }

    const questionIds = await pickRandomQuestionIds(client, { gameId, difficulty, categoryId, questionCount });
    if (questionIds.length === 0) {
      throw new AppError('Aucune question disponible pour ces critères', 422, 'NO_QUESTIONS_AVAILABLE');
    }

    const duelRes = await client.query(
      `INSERT INTO game_duels (game_id, player_one_id, status, question_ids, difficulty)
       VALUES ($1, $2, 'waiting', $3::uuid[], $4)
       RETURNING id`,
      [gameId, userId, questionIds, difficulty]
    );
    const duelId = duelRes.rows[0].id;

    const session = await createSession(client, {
      userId, gameId, mode: 'duel', difficulty, questionIds, metadata: { duelId },
    });

    await client.query(`UPDATE game_duels SET session_p1_id = $1 WHERE id = $2`, [session.sessionId, duelId]);

    await client.query('COMMIT');
    return { duelId, status: 'waiting', session };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Rejoint un duel en attente : démarre la session de l'adversaire avec le
 * MÊME lot de questions, puis passe le duel en 'active'.
 */
async function joinDuel({ userId, duelId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const duelRes = await client.query(`SELECT * FROM game_duels WHERE id = $1 FOR UPDATE`, [duelId]);
    const duel = duelRes.rows[0];
    if (!duel) {
      throw new AppError('Duel introuvable', 404, 'DUEL_NOT_FOUND');
    }
    if (duel.player_one_id === userId) {
      throw new AppError('Vous ne pouvez pas rejoindre votre propre duel', 409, 'CANNOT_JOIN_OWN_DUEL');
    }
    if (duel.status !== 'waiting' || duel.player_two_id) {
      throw new AppError("Ce duel n'est plus disponible", 409, 'DUEL_NOT_JOINABLE');
    }

    const session = await createSession(client, {
      userId, gameId: duel.game_id, mode: 'duel', difficulty: duel.difficulty,
      questionIds: duel.question_ids, metadata: { duelId },
    });

    await client.query(
      `UPDATE game_duels SET player_two_id = $1, session_p2_id = $2, status = 'active' WHERE id = $3`,
      [userId, session.sessionId, duelId]
    );

    await client.query('COMMIT');
    return { duelId, status: 'active', session };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Détail d'un duel (réservé aux deux joueurs concernés). Finalise
 * paresseusement le duel (vainqueur + statut 'completed') dès que les deux
 * sessions sont terminées.
 */
async function getDuel({ userId, duelId }) {
  const duelRes = await query(`SELECT * FROM game_duels WHERE id = $1`, [duelId]);
  let duel = duelRes.rows[0];
  if (!duel) {
    throw new AppError('Duel introuvable', 404, 'DUEL_NOT_FOUND');
  }
  if (duel.player_one_id !== userId && duel.player_two_id !== userId) {
    throw new AppError('Accès refusé à ce duel', 403, 'DUEL_ACCESS_DENIED');
  }

  const sessionIds = [duel.session_p1_id, duel.session_p2_id].filter(Boolean);
  let sessions = [];
  if (sessionIds.length > 0) {
    const res = await query(`SELECT id, status, score FROM game_sessions WHERE id = ANY($1::uuid[])`, [sessionIds]);
    sessions = res.rows;
  }
  const s1 = sessions.find((s) => s.id === duel.session_p1_id) || null;
  const s2 = sessions.find((s) => s.id === duel.session_p2_id) || null;

  if (duel.status === 'active' && s1?.status === 'completed' && s2?.status === 'completed') {
    let winnerId = null;
    if (s1.score > s2.score) winnerId = duel.player_one_id;
    else if (s2.score > s1.score) winnerId = duel.player_two_id;
    const updated = await query(
      `UPDATE game_duels SET status = 'completed', winner_id = $1, completed_at = now() WHERE id = $2 RETURNING *`,
      [winnerId, duelId]
    );
    duel = updated.rows[0];
  }

  return {
    id: duel.id,
    gameId: duel.game_id,
    status: duel.status,
    playerOneId: duel.player_one_id,
    playerTwoId: duel.player_two_id,
    winnerId: duel.winner_id,
    playerOneScore: s1 ? s1.score : null,
    playerTwoScore: s2 ? s2.score : null,
    createdAt: duel.created_at,
    completedAt: duel.completed_at,
  };
}

/**
 * Duels ouverts en attente d'un adversaire (hors les miens).
 */
async function listOpenDuels({ userId, gameId = null, limit = 20 }) {
  const params = [userId];
  let where = "gd.status = 'waiting' AND gd.player_two_id IS NULL AND gd.player_one_id <> $1";
  if (gameId) {
    params.push(gameId);
    where += ` AND gd.game_id = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT gd.id, gd.game_id, g.name AS game_name, gd.player_one_id, p.display_name AS player_one_name, gd.created_at
     FROM game_duels gd
     JOIN games g ON g.id = gd.game_id
     JOIN profiles p ON p.user_id = gd.player_one_id
     WHERE ${where}
     ORDER BY gd.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

/**
 * Mes duels (en tant que joueur 1 ou 2), les plus récents d'abord.
 */
async function listMyDuels({ userId, limit = 20 }) {
  const { rows } = await query(
    `SELECT gd.id, gd.game_id, g.name AS game_name, gd.status, gd.player_one_id, gd.player_two_id,
            gd.winner_id, gd.created_at, gd.completed_at
     FROM game_duels gd
     JOIN games g ON g.id = gd.game_id
     WHERE gd.player_one_id = $1 OR gd.player_two_id = $1
     ORDER BY gd.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

// ============================================================================
// Défi quotidien
//
// Un seul défi par jour (daily_challenges.challenge_date UNIQUE), généré à la
// demande (au premier GET du jour) plutôt que par un job planifié. Le jeu du
// jour tourne parmi les jeux actifs pour varier le contenu.
// ============================================================================

const DAILY_QUESTION_COUNT = 5;
const DAILY_REWARD_XP = 20;

function todayDateString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

async function pickDailyGameId(client, challengeDate) {
  const gamesRes = await client.query(
    `SELECT id FROM games WHERE is_active = true AND deleted_at IS NULL ORDER BY display_order`
  );
  if (gamesRes.rows.length === 0) return null;
  const dayIndex = Math.floor(new Date(`${challengeDate}T00:00:00Z`).getTime() / 86400000);
  return gamesRes.rows[dayIndex % gamesRes.rows.length].id;
}

/**
 * Renvoie le défi du jour (le crée s'il n'existe pas encore) et la
 * progression de l'utilisateur courant.
 */
async function getOrCreateTodayChallenge(userId) {
  const today = todayDateString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let challengeRes = await client.query(`SELECT * FROM daily_challenges WHERE challenge_date = $1`, [today]);
    let challenge = challengeRes.rows[0];

    if (!challenge) {
      const gameId = await pickDailyGameId(client, today);
      if (!gameId) {
        throw new AppError('Aucun jeu actif pour le défi du jour', 422, 'NO_GAME_AVAILABLE');
      }
      const questionIds = await pickRandomQuestionIds(client, {
        gameId, difficulty: 1, categoryId: null, questionCount: DAILY_QUESTION_COUNT,
      });
      if (questionIds.length === 0) {
        throw new AppError('Aucune question disponible pour le défi du jour', 422, 'NO_QUESTIONS_AVAILABLE');
      }
      const ins = await client.query(
        `INSERT INTO daily_challenges (challenge_date, game_id, question_ids, reward_xp)
         VALUES ($1, $2, $3::uuid[], $4)
         ON CONFLICT (challenge_date) DO NOTHING
         RETURNING *`,
        [today, gameId, questionIds, DAILY_REWARD_XP]
      );
      challenge = ins.rows[0];
      if (!challenge) {
        // Créé entre-temps par une requête concurrente : on relit la ligne existante.
        challengeRes = await client.query(`SELECT * FROM daily_challenges WHERE challenge_date = $1`, [today]);
        challenge = challengeRes.rows[0];
      }
    }

    const progressRes = await client.query(
      `SELECT completed, completed_at FROM user_daily_challenge_progress WHERE user_id = $1 AND challenge_id = $2`,
      [userId, challenge.id]
    );
    const progress = progressRes.rows[0] || null;

    const gameRes = await client.query(`SELECT code, name FROM games WHERE id = $1`, [challenge.game_id]);

    await client.query('COMMIT');
    return {
      challengeId: challenge.id,
      date: challenge.challenge_date,
      game: gameRes.rows[0] || null,
      rewardXp: challenge.reward_xp,
      questionCount: challenge.question_ids.length,
      completed: progress?.completed || false,
      completedAt: progress?.completed_at || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Démarre (ou reprend) la session du défi du jour pour l'utilisateur.
 * Refuse si le défi du jour n'existe pas encore (il faut d'abord appeler
 * getOrCreateTodayChallenge, ce que fait GET /games/daily) ou s'il est déjà
 * complété.
 */
async function startTodayChallenge(userId) {
  const today = todayDateString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const challengeRes = await client.query(`SELECT * FROM daily_challenges WHERE challenge_date = $1`, [today]);
    const challenge = challengeRes.rows[0];
    if (!challenge) {
      throw new AppError("Le défi du jour n'a pas encore été généré", 404, 'DAILY_CHALLENGE_NOT_FOUND');
    }

    const progressRes = await client.query(
      `SELECT completed FROM user_daily_challenge_progress WHERE user_id = $1 AND challenge_id = $2`,
      [userId, challenge.id]
    );
    if (progressRes.rows[0]?.completed) {
      throw new AppError('Défi du jour déjà complété', 409, 'DAILY_CHALLENGE_ALREADY_COMPLETED');
    }

    const session = await createSession(client, {
      userId,
      gameId: challenge.game_id,
      mode: 'daily',
      difficulty: 1,
      questionIds: challenge.question_ids,
      metadata: { dailyChallengeId: challenge.id },
    });

    await client.query('COMMIT');
    return session;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listGames,
  startSession,
  submitAnswer,
  endSession,
  getLeaderboard,
  createDuel,
  joinDuel,
  getDuel,
  listOpenDuels,
  listMyDuels,
  getOrCreateTodayChallenge,
  startTodayChallenge,
};
