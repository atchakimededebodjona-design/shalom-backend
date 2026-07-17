const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-spirit-';
const admin = { email: `${PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Spirit Admin' };
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'Spirit User' };

let tokenAdmin; let tokenUser;
let planId; let prayerId; let verseId; let entryId; let songId; let playlistId;
const createdVerseIds = [];

const asAdmin = () => ({ Authorization: `Bearer ${tokenAdmin}` });
const asUser = () => ({ Authorization: `Bearer ${tokenUser}` });

/**
 * Nettoyage ordonné : bible_reading_plans.created_by et worship_songs.created_by
 * sont en NO ACTION (pas de CASCADE). Il faut donc supprimer les plans/chants
 * créés par les comptes de test AVANT les comptes eux-mêmes, sinon la
 * suppression échoue sur une violation de clé étrangère.
 */
async function cleanup() {
  if (createdVerseIds.length > 0) {
    await pool.query('DELETE FROM user_verse_interactions WHERE verse_id = ANY($1)', [createdVerseIds]);
    await pool.query('DELETE FROM daily_verses WHERE id = ANY($1)', [createdVerseIds]);
  }
  const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  const ids = res.rows.map((r) => r.id);
  if (ids.length === 0) return;

  await pool.query(
    `DELETE FROM user_reading_logs
     WHERE user_id = ANY($1) OR plan_id IN (SELECT id FROM bible_reading_plans WHERE created_by = ANY($1))`, [ids]);
  await pool.query(
    `DELETE FROM user_reading_progress
     WHERE user_id = ANY($1) OR plan_id IN (SELECT id FROM bible_reading_plans WHERE created_by = ANY($1))`, [ids]);
  await pool.query('DELETE FROM bible_reading_plans WHERE created_by = ANY($1)', [ids]);
  await pool.query(
    `DELETE FROM worship_playlist_songs
     WHERE playlist_id IN (SELECT id FROM worship_playlists WHERE user_id = ANY($1))
        OR song_id IN (SELECT id FROM worship_songs WHERE created_by = ANY($1))`, [ids]);
  await pool.query('DELETE FROM worship_playlists WHERE user_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM worship_songs WHERE created_by = ANY($1)', [ids]);
  await pool.query('DELETE FROM user_verse_interactions WHERE user_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM prayer_requests WHERE user_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM spiritual_journal_entries WHERE user_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
}

describe('Module Spiritual', () => {
  beforeAll(async () => {
    await cleanup();
    process.env.ADMIN_EMAILS = admin.email; // injection de l'admin pour cette suite
    const a = await request(app).post('/api/v1/auth/register').send(admin);
    tokenAdmin = a.body.data.tokens.access_token;
    const u = await request(app).post('/api/v1/auth/register').send(user);
    tokenUser = u.body.data.tokens.access_token;
  });

  afterAll(async () => { await cleanup(); });

  describe('Plans de lecture', () => {
    it('crée un plan', async () => {
      const res = await request(app).post('/api/v1/spiritual/plans').set(asAdmin())
        .send({ title: 'Plan test 3 jours', duration_type: 'custom', total_days: 3, is_public: false });
      expect(res.statusCode).toBe(201);
      planId = res.body.data.plan.id;
    });

    it('ajoute des jours au plan', async () => {
      const j1 = await request(app).post(`/api/v1/spiritual/plans/${planId}/days`).set(asAdmin())
        .send({ day_number: 1, passages: 'Genèse 1-3' });
      const j2 = await request(app).post(`/api/v1/spiritual/plans/${planId}/days`).set(asAdmin())
        .send({ day_number: 2, passages: 'Genèse 4-6' });
      expect(j1.statusCode).toBe(201);
      expect(j2.statusCode).toBe(201);
    });

    it('récupère le plan avec ses jours', async () => {
      const res = await request(app).get(`/api/v1/spiritual/plans/${planId}`).set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.plan.days.length).toBe(2);
    });

    it('rend un plan privé invisible aux autres (404)', async () => {
      const res = await request(app).get(`/api/v1/spiritual/plans/${planId}`).set(asUser());
      expect(res.statusCode).toBe(404);
    });

    it('refuse de valider un jour si le plan n\'est pas démarré (404)', async () => {
      const res = await request(app).post(`/api/v1/spiritual/plans/${planId}/complete-day`).set(asAdmin())
        .send({ day_number: 1 });
      expect(res.statusCode).toBe(404);
    });

    it('démarre le plan', async () => {
      const res = await request(app).post(`/api/v1/spiritual/plans/${planId}/start`).set(asAdmin());
      expect(res.statusCode).toBe(201);
      expect(res.body.data.progress.current_day).toBe(1);
    });

    it('valide le jour 1 (streak = 1, jour courant = 2)', async () => {
      const res = await request(app).post(`/api/v1/spiritual/plans/${planId}/complete-day`).set(asAdmin())
        .send({ day_number: 1 });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.progress.streak_count).toBe(1);
      expect(res.body.data.progress.current_day).toBe(2);
    });

    it('est idempotent si le même jour est rejoué (streak inchangé)', async () => {
      const res = await request(app).post(`/api/v1/spiritual/plans/${planId}/complete-day`).set(asAdmin())
        .send({ day_number: 1 });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.already_completed).toBe(true);
      expect(res.body.data.progress.streak_count).toBe(1);
    });

    it('journalise les jours validés', async () => {
      const res = await request(app).get(`/api/v1/spiritual/plans/${planId}/logs`).set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.logs.length).toBe(1);
    });

    it('marque le plan comme terminé au dernier jour', async () => {
      const res = await request(app).post(`/api/v1/spiritual/plans/${planId}/complete-day`).set(asAdmin())
        .send({ day_number: 3 });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.progress.status).toBe('completed');
    });

    it('liste la progression', async () => {
      const res = await request(app).get('/api/v1/spiritual/progress').set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.progress.length).toBeGreaterThanOrEqual(1);
    });

    it('met à jour le statut de progression', async () => {
      const res = await request(app).patch(`/api/v1/spiritual/plans/${planId}/progress`).set(asAdmin())
        .send({ status: 'abandoned' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.progress.status).toBe('abandoned');
    });
  });

  describe('Carnet de prière', () => {
    it('ajoute un sujet de prière', async () => {
      const res = await request(app).post('/api/v1/spiritual/prayers').set(asAdmin())
        .send({ title: 'Pour ma famille', category: 'famille', reminder_frequency: 'daily' });
      expect(res.statusCode).toBe(201);
      prayerId = res.body.data.prayer.id;
    });

    it('liste les sujets avec pagination', async () => {
      const res = await request(app).get('/api/v1/spiritual/prayers').set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.pagination.total_count).toBeGreaterThanOrEqual(1);
    });

    it('horodate la réponse quand le statut passe à "answered"', async () => {
      const res = await request(app).patch(`/api/v1/spiritual/prayers/${prayerId}`).set(asAdmin())
        .send({ status: 'answered', answered_note: 'Dieu a répondu' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.prayer.status).toBe('answered');
      expect(res.body.data.prayer.answered_at).not.toBeNull();
    });

    it('efface la date de réponse si le statut repasse à "pending"', async () => {
      const res = await request(app).patch(`/api/v1/spiritual/prayers/${prayerId}`).set(asAdmin())
        .send({ status: 'pending' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.prayer.answered_at).toBeNull();
    });

    it('cloisonne les prières entre utilisateurs (404)', async () => {
      const res = await request(app).get(`/api/v1/spiritual/prayers/${prayerId}`).set(asUser());
      expect(res.statusCode).toBe(404);
    });

    it('supprime un sujet de prière', async () => {
      const res = await request(app).delete(`/api/v1/spiritual/prayers/${prayerId}`).set(asAdmin());
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Versets du jour', () => {
    it('refuse la création à un non-admin (403)', async () => {
      const res = await request(app).post('/api/v1/spiritual/verses').set(asUser())
        .send({ content: 'x', reference: 'y', type: 'verse' });
      expect(res.statusCode).toBe(403);
    });

    it('permet à un admin de créer un verset', async () => {
      const res = await request(app).post('/api/v1/spiritual/verses').set(asAdmin())
        .send({ content: 'Car Dieu a tant aimé le monde…', reference: 'Jean 3:16 (test)', type: 'verse' });
      expect(res.statusCode).toBe(201);
      verseId = res.body.data.verse.id;
      createdVerseIds.push(verseId);
    });

    it('renvoie le verset du jour', async () => {
      const res = await request(app).get('/api/v1/spiritual/verses/today').set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.verse.content).toBeTruthy();
    });

    it('gère les favoris', async () => {
      const fav = await request(app).patch(`/api/v1/spiritual/verses/${verseId}/favorite`).set(asAdmin())
        .send({ is_favorite: true });
      expect(fav.statusCode).toBe(200);
      expect(fav.body.data.interaction.is_favorite).toBe(true);

      const list = await request(app).get('/api/v1/spiritual/verses/favorites').set(asAdmin());
      expect(list.statusCode).toBe(200);
      expect(list.body.data.verses.some((v) => v.id === verseId)).toBe(true);
    });
  });

  describe('Journal spirituel', () => {
    it('ajoute une entrée', async () => {
      const res = await request(app).post('/api/v1/spiritual/journal').set(asAdmin())
        .send({ content: 'Merci Seigneur', entry_type: 'gratitude', mood: 'reconnaissant' });
      expect(res.statusCode).toBe(201);
      entryId = res.body.data.entry.id;
    });

    it('liste et filtre par type', async () => {
      const res = await request(app).get('/api/v1/spiritual/journal?entry_type=gratitude').set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.entries.every((e) => e.entry_type === 'gratitude')).toBe(true);
    });

    it('met à jour une entrée', async () => {
      const res = await request(app).patch(`/api/v1/spiritual/journal/${entryId}`).set(asAdmin())
        .send({ mood: 'en paix' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.entry.mood).toBe('en paix');
    });

    it('supprime une entrée', async () => {
      const res = await request(app).delete(`/api/v1/spiritual/journal/${entryId}`).set(asAdmin());
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Louange', () => {
    it('crée un chant', async () => {
      const res = await request(app).post('/api/v1/spiritual/songs').set(asAdmin())
        .send({ title: 'Amazing Grace (test)', artist_or_author: 'J. Newton', category: 'adoration' });
      expect(res.statusCode).toBe(201);
      songId = res.body.data.song.id;
    });

    it('recherche un chant', async () => {
      const res = await request(app).get('/api/v1/spiritual/songs?q=Amazing').set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.songs.some((s) => s.id === songId)).toBe(true);
    });

    it('crée une playlist et y ajoute un chant (position auto)', async () => {
      const pl = await request(app).post('/api/v1/spiritual/playlists').set(asAdmin())
        .send({ title: 'Ma playlist' });
      expect(pl.statusCode).toBe(201);
      playlistId = pl.body.data.playlist.id;

      const add = await request(app).post(`/api/v1/spiritual/playlists/${playlistId}/songs`).set(asAdmin())
        .send({ song_id: songId });
      expect(add.statusCode).toBe(201);
      expect(add.body.data.item.position).toBe(1);
    });

    it('renvoie la playlist avec ses chants ordonnés', async () => {
      const res = await request(app).get(`/api/v1/spiritual/playlists/${playlistId}`).set(asAdmin());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.playlist.songs.length).toBe(1);
    });

    it('retire un chant puis supprime la playlist', async () => {
      const rm = await request(app).delete(`/api/v1/spiritual/playlists/${playlistId}/songs/${songId}`).set(asAdmin());
      expect(rm.statusCode).toBe(200);
      const del = await request(app).delete(`/api/v1/spiritual/playlists/${playlistId}`).set(asAdmin());
      expect(del.statusCode).toBe(200);
    });
  });

  describe('Gardes et validations', () => {
    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/spiritual/plans');
      expect(res.statusCode).toBe(401);
    });

    it('refuse une prière sans titre (400)', async () => {
      const res = await request(app).post('/api/v1/spiritual/prayers').set(asAdmin()).send({ description: 'sans titre' });
      expect(res.statusCode).toBe(400);
    });

    it('renvoie 404 pour une prière inexistante', async () => {
      const res = await request(app).get('/api/v1/spiritual/prayers/00000000-0000-0000-0000-000000000000').set(asAdmin());
      expect(res.statusCode).toBe(404);
    });

    it('renvoie 400 pour un id non-UUID', async () => {
      const res = await request(app).get('/api/v1/spiritual/journal/pas-un-uuid').set(asAdmin());
      expect(res.statusCode).toBe(400);
    });
  });
});
