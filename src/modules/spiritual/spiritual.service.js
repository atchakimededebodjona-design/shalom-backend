// src/modules/spiritual/spiritual.service.js
// Accès aux données du module Outils Spirituels : plans de lecture, carnet de
// prière, versets du jour, journal spirituel et louange.

const { query } = require('../../config/db');

// =========================================================================
//  Plans de lecture biblique
// =========================================================================

// Catalogue : plans publics + plans créés par l'utilisateur.
const listPlans = async (userId) => {
  const result = await query(
    `SELECT p.*,
            (SELECT count(*)::int FROM bible_reading_plan_days d WHERE d.plan_id = p.id) AS days_defined,
            pr.status AS my_status, pr.current_day AS my_current_day, pr.streak_count AS my_streak
     FROM bible_reading_plans p
     LEFT JOIN user_reading_progress pr ON pr.plan_id = p.id AND pr.user_id = $1
     WHERE p.is_public = true OR p.created_by = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows;
};

const createPlan = async (userId, { title, description, duration_type, total_days, is_public }) => {
  const result = await query(
    `INSERT INTO bible_reading_plans (title, description, duration_type, total_days, is_public, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [title, description || null, duration_type || 'custom', total_days, is_public ?? true, userId]
  );
  return result.rows[0];
};

// Détail d'un plan + ses jours. Visible si public ou créé par l'utilisateur.
const getPlanById = async (planId, userId) => {
  const result = await query(
    `SELECT * FROM bible_reading_plans
     WHERE id = $1 AND (is_public = true OR created_by = $2)`,
    [planId, userId]
  );
  const plan = result.rows[0];
  if (!plan) return null;
  const days = await query(
    `SELECT id, day_number, passages FROM bible_reading_plan_days
     WHERE plan_id = $1 ORDER BY day_number ASC`,
    [planId]
  );
  return { ...plan, days: days.rows };
};

// Ajout d'un jour — réservé au créateur du plan.
const addPlanDay = async (planId, userId, { day_number, passages }) => {
  const owner = await query(
    `SELECT id FROM bible_reading_plans WHERE id = $1 AND created_by = $2`,
    [planId, userId]
  );
  if (!owner.rows[0]) return null;
  const result = await query(
    `INSERT INTO bible_reading_plan_days (plan_id, day_number, passages)
     VALUES ($1, $2, $3)
     ON CONFLICT (plan_id, day_number) DO UPDATE SET passages = EXCLUDED.passages
     RETURNING *`,
    [planId, day_number, passages]
  );
  return result.rows[0];
};

// Démarrer un plan (idempotent).
const startPlan = async (userId, planId) => {
  const plan = await query(
    `SELECT id FROM bible_reading_plans WHERE id = $1 AND (is_public = true OR created_by = $2)`,
    [planId, userId]
  );
  if (!plan.rows[0]) return null;
  const result = await query(
    `INSERT INTO user_reading_progress (user_id, plan_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, plan_id) DO UPDATE SET status = 'active'
     RETURNING *`,
    [userId, planId]
  );
  return result.rows[0];
};

const listProgress = async (userId) => {
  const result = await query(
    `SELECT pr.*, p.title, p.total_days, p.duration_type
     FROM user_reading_progress pr
     JOIN bible_reading_plans p ON p.id = pr.plan_id
     WHERE pr.user_id = $1
     ORDER BY pr.started_at DESC`,
    [userId]
  );
  return result.rows;
};

/**
 * Valide un jour de lecture : journalise le jour, met à jour la progression et
 * recalcule le streak (J+1 → +1 ; même jour → inchangé ; trou → repart à 1).
 * @returns {Promise<{progress: object, already_completed: boolean}|null>}
 */
const completeDay = async (userId, planId, dayNumber) => {
  const plan = await query(`SELECT total_days FROM bible_reading_plans WHERE id = $1`, [planId]);
  if (!plan.rows[0]) return null;
  const totalDays = plan.rows[0].total_days;

  const progRes = await query(
    `SELECT * FROM user_reading_progress WHERE user_id = $1 AND plan_id = $2`,
    [userId, planId]
  );
  const prog = progRes.rows[0];
  if (!prog) return null; // plan non démarré

  const logRes = await query(
    `INSERT INTO user_reading_logs (user_id, plan_id, day_number)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, plan_id, day_number) DO NOTHING
     RETURNING id`,
    [userId, planId, dayNumber]
  );
  const alreadyCompleted = logRes.rowCount === 0;

  // Recalcul du streak à partir de la dernière validation.
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const today = startOfDay(new Date());
  let streak;
  if (!prog.last_completed_at) {
    streak = 1;
  } else {
    const diffDays = Math.round((today - startOfDay(prog.last_completed_at)) / 86400000);
    if (diffDays === 0) streak = prog.streak_count || 1;      // déjà validé aujourd'hui
    else if (diffDays === 1) streak = (prog.streak_count || 0) + 1;
    else streak = 1;                                          // série rompue
  }

  const nextDay = Math.min(Math.max(prog.current_day || 1, dayNumber + 1), totalDays + 1);
  const status = dayNumber >= totalDays ? 'completed' : prog.status;

  const upd = await query(
    `UPDATE user_reading_progress
     SET current_day = $1, last_completed_at = now(), streak_count = $2, status = $3
     WHERE user_id = $4 AND plan_id = $5
     RETURNING *`,
    [nextDay, streak, status, userId, planId]
  );
  return { progress: upd.rows[0], already_completed: alreadyCompleted };
};

const listLogs = async (userId, planId) => {
  const result = await query(
    `SELECT day_number, completed_at FROM user_reading_logs
     WHERE user_id = $1 AND plan_id = $2
     ORDER BY day_number ASC`,
    [userId, planId]
  );
  return result.rows;
};

const updateProgressStatus = async (userId, planId, status) => {
  const result = await query(
    `UPDATE user_reading_progress SET status = $1
     WHERE user_id = $2 AND plan_id = $3
     RETURNING *`,
    [status, userId, planId]
  );
  return result.rows[0] || null;
};

// =========================================================================
//  Carnet de prière
// =========================================================================

const createPrayer = async (userId, { title, description, category, reminder_frequency }) => {
  const result = await query(
    `INSERT INTO prayer_requests (user_id, title, description, category, reminder_frequency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, title, description || null, category || null, reminder_frequency || 'none']
  );
  return result.rows[0];
};

const listPrayers = async (userId, { status, category, limit, offset }) => {
  const filters = [userId];
  let where = 'user_id = $1 AND deleted_at IS NULL';
  if (status) { filters.push(status); where += ` AND status = $${filters.length}`; }
  if (category) { filters.push(category); where += ` AND category = $${filters.length}`; }

  const countRes = await query(`SELECT count(*)::int AS total FROM prayer_requests WHERE ${where}`, filters);
  const rows = await query(
    `SELECT * FROM prayer_requests WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { prayers: rows.rows, total: countRes.rows[0].total };
};

const getPrayerById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM prayer_requests WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

// Passer une prière à « answered » horodate la réponse ; en sortir l'efface.
const updatePrayer = async (id, userId, data) => {
  const { title, description, category, status, answered_note, reminder_frequency } = data;
  const result = await query(
    `UPDATE prayer_requests
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         status = COALESCE($4, status),
         answered_note = COALESCE($5, answered_note),
         reminder_frequency = COALESCE($6, reminder_frequency),
         answered_at = CASE
           WHEN $4 = 'answered' AND answered_at IS NULL THEN now()
           WHEN $4 IS NOT NULL AND $4 <> 'answered' THEN NULL
           ELSE answered_at END,
         updated_at = now()
     WHERE id = $7 AND user_id = $8 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, description ?? null, category ?? null, status ?? null,
      answered_note ?? null, reminder_frequency ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeletePrayer = async (id, userId) => {
  const result = await query(
    `UPDATE prayer_requests SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Versets / citations
// =========================================================================

const createVerse = async ({ content, reference, type, display_date }) => {
  const result = await query(
    `INSERT INTO daily_verses (content, reference, type, display_date)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [content, reference || null, type || 'verse', display_date || null]
  );
  return result.rows[0];
};

/**
 * Verset du jour : celui assigné à la date du jour, sinon rotation déterministe
 * sur les versets sans date (stable pour une journée donnée). La consultation
 * est enregistrée dans user_verse_interactions.
 */
const getVerseOfTheDay = async (userId) => {
  let res = await query(`SELECT * FROM daily_verses WHERE display_date = CURRENT_DATE LIMIT 1`);
  let verse = res.rows[0];

  if (!verse) {
    const countRes = await query(`SELECT count(*)::int AS n FROM daily_verses WHERE display_date IS NULL`);
    const n = countRes.rows[0].n;
    if (n === 0) return null;
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const rot = await query(
      `SELECT * FROM daily_verses WHERE display_date IS NULL
       ORDER BY created_at ASC, id ASC LIMIT 1 OFFSET $1`,
      [dayOfYear % n]
    );
    verse = rot.rows[0];
  }
  if (!verse) return null;

  const inter = await query(
    `INSERT INTO user_verse_interactions (user_id, verse_id, viewed_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id, verse_id) DO UPDATE SET viewed_at = now()
     RETURNING is_favorite`,
    [userId, verse.id]
  );
  return { ...verse, is_favorite: inter.rows[0]?.is_favorite ?? false };
};

const setVerseFavorite = async (userId, verseId, isFavorite) => {
  const exists = await query(`SELECT id FROM daily_verses WHERE id = $1`, [verseId]);
  if (!exists.rows[0]) return null;
  const result = await query(
    `INSERT INTO user_verse_interactions (user_id, verse_id, is_favorite)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, verse_id) DO UPDATE SET is_favorite = EXCLUDED.is_favorite
     RETURNING *`,
    [userId, verseId, isFavorite]
  );
  return result.rows[0];
};

const listFavoriteVerses = async (userId) => {
  const result = await query(
    `SELECT v.*, i.is_favorite, i.viewed_at
     FROM user_verse_interactions i
     JOIN daily_verses v ON v.id = i.verse_id
     WHERE i.user_id = $1 AND i.is_favorite = true
     ORDER BY i.viewed_at DESC`,
    [userId]
  );
  return result.rows;
};

// =========================================================================
//  Journal spirituel
// =========================================================================

const createEntry = async (userId, { content, entry_type, mood, entry_date }) => {
  const result = await query(
    `INSERT INTO spiritual_journal_entries (user_id, content, entry_type, mood, entry_date)
     VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))
     RETURNING *`,
    [userId, content, entry_type || 'note', mood || null, entry_date || null]
  );
  return result.rows[0];
};

const listEntries = async (userId, { entry_type, from, to, limit, offset }) => {
  const filters = [userId];
  let where = 'user_id = $1 AND deleted_at IS NULL';
  if (entry_type) { filters.push(entry_type); where += ` AND entry_type = $${filters.length}`; }
  if (from) { filters.push(from); where += ` AND entry_date >= $${filters.length}`; }
  if (to) { filters.push(to); where += ` AND entry_date <= $${filters.length}`; }

  const countRes = await query(`SELECT count(*)::int AS total FROM spiritual_journal_entries WHERE ${where}`, filters);
  const rows = await query(
    `SELECT * FROM spiritual_journal_entries WHERE ${where}
     ORDER BY entry_date DESC, created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { entries: rows.rows, total: countRes.rows[0].total };
};

const getEntryById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM spiritual_journal_entries WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const updateEntry = async (id, userId, { content, entry_type, mood, entry_date }) => {
  const result = await query(
    `UPDATE spiritual_journal_entries
     SET content = COALESCE($1, content),
         entry_type = COALESCE($2, entry_type),
         mood = COALESCE($3, mood),
         entry_date = COALESCE($4::date, entry_date),
         updated_at = now()
     WHERE id = $5 AND user_id = $6 AND deleted_at IS NULL
     RETURNING *`,
    [content ?? null, entry_type ?? null, mood ?? null, entry_date ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteEntry = async (id, userId) => {
  const result = await query(
    `UPDATE spiritual_journal_entries SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Louange : chants et playlists
// =========================================================================

const createSong = async (userId, { title, artist_or_author, lyrics, language, category, is_public }) => {
  const result = await query(
    `INSERT INTO worship_songs (title, artist_or_author, lyrics, language, category, created_by, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [title, artist_or_author || null, lyrics || null, language || 'fr', category || null, userId, is_public ?? true]
  );
  return result.rows[0];
};

// Chants publics + ceux de l'utilisateur, avec recherche optionnelle.
const listSongs = async (userId, { q, category, limit, offset }) => {
  const filters = [userId];
  let where = '(is_public = true OR created_by = $1)';
  if (q) { filters.push(`%${q}%`); where += ` AND (title ILIKE $${filters.length} OR artist_or_author ILIKE $${filters.length})`; }
  if (category) { filters.push(category); where += ` AND category = $${filters.length}`; }

  const countRes = await query(`SELECT count(*)::int AS total FROM worship_songs WHERE ${where}`, filters);
  const rows = await query(
    `SELECT * FROM worship_songs WHERE ${where}
     ORDER BY title ASC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { songs: rows.rows, total: countRes.rows[0].total };
};

const getSongById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM worship_songs WHERE id = $1 AND (is_public = true OR created_by = $2)`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const createPlaylist = async (userId, { title, is_public }) => {
  const result = await query(
    `INSERT INTO worship_playlists (user_id, title, is_public)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, title, is_public ?? false]
  );
  return result.rows[0];
};

const listPlaylists = async (userId) => {
  const result = await query(
    `SELECT pl.*, (SELECT count(*)::int FROM worship_playlist_songs s WHERE s.playlist_id = pl.id) AS songs_count
     FROM worship_playlists pl
     WHERE pl.user_id = $1 AND pl.deleted_at IS NULL
     ORDER BY pl.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Détail : la playlist et ses chants ordonnés (visible si propriétaire ou publique).
const getPlaylistById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM worship_playlists
     WHERE id = $1 AND deleted_at IS NULL AND (user_id = $2 OR is_public = true)`,
    [id, userId]
  );
  const playlist = result.rows[0];
  if (!playlist) return null;
  const songs = await query(
    `SELECT s.*, ps.position
     FROM worship_playlist_songs ps
     JOIN worship_songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = $1
     ORDER BY ps.position ASC`,
    [id]
  );
  return { ...playlist, songs: songs.rows };
};

const updatePlaylist = async (id, userId, { title, is_public }) => {
  const result = await query(
    `UPDATE worship_playlists
     SET title = COALESCE($1, title),
         is_public = COALESCE($2, is_public)
     WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, is_public ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeletePlaylist = async (id, userId) => {
  const result = await query(
    `UPDATE worship_playlists SET deleted_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// Ajoute un chant à la playlist (propriétaire). Position auto si non fournie.
const addSongToPlaylist = async (playlistId, userId, { song_id, position }) => {
  const owner = await query(
    `SELECT id FROM worship_playlists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [playlistId, userId]
  );
  if (!owner.rows[0]) return null;

  let pos = position;
  if (!pos) {
    const max = await query(
      `SELECT COALESCE(MAX(position), 0)::int AS m FROM worship_playlist_songs WHERE playlist_id = $1`,
      [playlistId]
    );
    pos = max.rows[0].m + 1;
  }
  const result = await query(
    `INSERT INTO worship_playlist_songs (playlist_id, song_id, position)
     VALUES ($1, $2, $3)
     ON CONFLICT (playlist_id, song_id) DO UPDATE SET position = EXCLUDED.position
     RETURNING *`,
    [playlistId, song_id, pos]
  );
  return result.rows[0];
};

const removeSongFromPlaylist = async (playlistId, userId, songId) => {
  const owner = await query(
    `SELECT id FROM worship_playlists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [playlistId, userId]
  );
  if (!owner.rows[0]) return false;
  const result = await query(
    `DELETE FROM worship_playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING id`,
    [playlistId, songId]
  );
  return result.rowCount > 0;
};

module.exports = {
  listPlans, createPlan, getPlanById, addPlanDay,
  startPlan, listProgress, completeDay, listLogs, updateProgressStatus,
  createPrayer, listPrayers, getPrayerById, updatePrayer, softDeletePrayer,
  createVerse, getVerseOfTheDay, setVerseFavorite, listFavoriteVerses,
  createEntry, listEntries, getEntryById, updateEntry, softDeleteEntry,
  createSong, listSongs, getSongById,
  createPlaylist, listPlaylists, getPlaylistById, updatePlaylist, softDeletePlaylist,
  addSongToPlaylist, removeSongFromPlaylist,
};
