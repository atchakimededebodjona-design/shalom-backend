const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-comm-';
const admin = { email: `${PREFIX}admin@shalom.dev`, password: 'Password123!', display_name: 'Comm Admin' };
const member = { email: `${PREFIX}member@shalom.dev`, password: 'Password123!', display_name: 'Comm Member' };
const outsider = { email: `${PREFIX}out@shalom.dev`, password: 'Password123!', display_name: 'Comm Outsider' };

let tokenAdmin; let tokenMember; let tokenOut;
let gPublic; let gPrivate; let evGlobal; let evGroup; let prPublic; let prGroup; let prAnon; let anGlobal;

const asAdmin = () => ({ Authorization: `Bearer ${tokenAdmin}` });
const asMember = () => ({ Authorization: `Bearer ${tokenMember}` });
const asOut = () => ({ Authorization: `Bearer ${tokenOut}` });

/**
 * Nettoyage ordonné : community_events.organizer_id, community_announcements.posted_by
 * et groups.created_by sont en NO ACTION (pas de CASCADE) — il faut supprimer ces
 * lignes avant les comptes, sinon la suppression échoue sur une clé étrangère.
 */
async function cleanup() {
  const res = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  const ids = res.rows.map((r) => r.id);
  if (ids.length === 0) return;

  await pool.query(
    `DELETE FROM prayer_request_supports
     WHERE user_id = ANY($1) OR prayer_request_id IN (SELECT id FROM shared_prayer_requests WHERE user_id = ANY($1))`, [ids]);
  await pool.query('DELETE FROM shared_prayer_requests WHERE user_id = ANY($1)', [ids]);
  await pool.query(
    `DELETE FROM event_registrations
     WHERE user_id = ANY($1) OR event_id IN (SELECT id FROM community_events WHERE organizer_id = ANY($1))`, [ids]);
  await pool.query('DELETE FROM community_events WHERE organizer_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM community_announcements WHERE posted_by = ANY($1)', [ids]);
  await pool.query('DELETE FROM notifications WHERE user_id = ANY($1) OR actor_id = ANY($1)', [ids]);
  await pool.query(
    `DELETE FROM group_members
     WHERE user_id = ANY($1) OR group_id IN (SELECT id FROM groups WHERE created_by = ANY($1))`, [ids]);
  await pool.query('DELETE FROM groups WHERE created_by = ANY($1)', [ids]);
  await pool.query('DELETE FROM profiles WHERE user_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
}

describe('Module Community', () => {
  beforeAll(async () => {
    await cleanup();
    process.env.ADMIN_EMAILS = admin.email; // annonces globales réservées aux admins
    const a = await request(app).post('/api/v1/auth/register').send(admin);
    tokenAdmin = a.body.data.tokens.access_token;
    const m = await request(app).post('/api/v1/auth/register').send(member);
    tokenMember = m.body.data.tokens.access_token;
    const o = await request(app).post('/api/v1/auth/register').send(outsider);
    tokenOut = o.body.data.tokens.access_token;

    const gp = await request(app).post('/api/v1/groups').set(asAdmin())
      .send({ name: 'Cellule test Nord', description: 'Cellule de prière', visibility: 'public' });
    gPublic = gp.body.data.group.id;
    const gv = await request(app).post('/api/v1/groups').set(asAdmin())
      .send({ name: 'Groupe privé test', description: 'secret', visibility: 'prive' });
    gPrivate = gv.body.data.group.id;
    await request(app).post(`/api/v1/groups/${gPublic}/members`).set(asMember());
  });

  afterAll(async () => { await cleanup(); });

  describe('Annuaire des groupes (extension du module groups)', () => {
    it("persiste les champs d'annuaire via PATCH /groups/:id", async () => {
      const res = await request(app).patch(`/api/v1/groups/${gPublic}`).set(asAdmin())
        .send({ group_category: 'cellule_priere', meeting_schedule: 'Tous les mardis 18h', location_info: 'Lomé, Tokoin' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.group.group_category).toBe('cellule_priere');
      expect(res.body.data.group.meeting_schedule).toBe('Tous les mardis 18h');
    });

    it("liste l'annuaire", async () => {
      const res = await request(app).get('/api/v1/groups/directory').set(asOut());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.groups.some((g) => g.id === gPublic)).toBe(true);
    });

    it("n'expose jamais les groupes privés dans l'annuaire", async () => {
      const res = await request(app).get('/api/v1/groups/directory').set(asOut());
      expect(res.body.data.groups.some((g) => g.id === gPrivate)).toBe(false);
    });

    it('filtre par catégorie', async () => {
      const res = await request(app).get('/api/v1/groups/directory?category=cellule_priere').set(asOut());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.groups.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.groups.every((g) => g.group_category === 'cellule_priere')).toBe(true);
    });

    it('refuse une catégorie invalide (400)', async () => {
      const res = await request(app).get('/api/v1/groups/directory?category=invalide').set(asOut());
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Événements communautaires', () => {
    it('crée un événement global avec capacité', async () => {
      const res = await request(app).post('/api/v1/community/events').set(asAdmin())
        .send({ title: 'Retraite globale', event_type: 'retraite', start_date: '2026-09-01T08:00:00Z', registration_required: true, max_participants: 2 });
      expect(res.statusCode).toBe(201);
      evGlobal = res.body.data.event.id;
    });

    it('crée un événement de groupe et notifie les membres', async () => {
      const res = await request(app).post('/api/v1/community/events').set(asAdmin())
        .send({ title: 'Formation du groupe', event_type: 'formation', start_date: '2026-09-10T08:00:00Z', group_id: gPublic });
      expect(res.statusCode).toBe(201);
      evGroup = res.body.data.event.id;

      // Réutilisation du module notifications
      const notifs = await request(app).get('/api/v1/notifications').set(asMember());
      expect(notifs.body.data.notifications.some((n) => n.reference_id === evGroup)).toBe(true);
    });

    it("refuse un événement sur un groupe dont on n'est pas membre (403)", async () => {
      const res = await request(app).post('/api/v1/community/events').set(asOut())
        .send({ title: 'X', start_date: '2026-09-10T08:00:00Z', group_id: gPublic });
      expect(res.statusCode).toBe(403);
    });

    it('cloisonne les événements de groupe aux membres', async () => {
      const mine = await request(app).get('/api/v1/community/events').set(asMember());
      expect(mine.body.data.events.some((e) => e.id === evGroup)).toBe(true);

      const out = await request(app).get('/api/v1/community/events').set(asOut());
      expect(out.body.data.events.some((e) => e.id === evGlobal)).toBe(true);
      expect(out.body.data.events.some((e) => e.id === evGroup)).toBe(false);
    });

    it('respecte la capacité maximale (409 EVENT_FULL)', async () => {
      const r1 = await request(app).post(`/api/v1/community/events/${evGlobal}/register`).set(asAdmin());
      expect(r1.statusCode).toBe(201);
      const r2 = await request(app).post(`/api/v1/community/events/${evGlobal}/register`).set(asMember());
      expect(r2.statusCode).toBe(201);
      const r3 = await request(app).post(`/api/v1/community/events/${evGlobal}/register`).set(asOut());
      expect(r3.statusCode).toBe(409);
      expect(r3.body.code).toBe('EVENT_FULL');
    });

    it('expose le compteur et son propre statut d\'inscription', async () => {
      const res = await request(app).get(`/api/v1/community/events/${evGlobal}`).set(asAdmin());
      expect(res.body.data.event.registrations_count).toBe(2);
      expect(res.body.data.event.is_registered).toBe(true);
    });

    it("réserve la liste des inscrits à l'organisateur", async () => {
      const ok = await request(app).get(`/api/v1/community/events/${evGlobal}/registrations`).set(asAdmin());
      expect(ok.statusCode).toBe(200);
      expect(ok.body.data.registrations.length).toBe(2);

      const ko = await request(app).get(`/api/v1/community/events/${evGlobal}/registrations`).set(asOut());
      expect(ko.statusCode).toBe(404);
    });

    it('libère une place à l\'annulation', async () => {
      const cancel = await request(app).delete(`/api/v1/community/events/${evGlobal}/register`).set(asMember());
      expect(cancel.statusCode).toBe(200);
      const again = await request(app).post(`/api/v1/community/events/${evGlobal}/register`).set(asOut());
      expect(again.statusCode).toBe(201);
    });
  });

  describe('Demandes de prière partagées', () => {
    it('partage une demande publique', async () => {
      const res = await request(app).post('/api/v1/community/prayers').set(asMember())
        .send({ title: 'Priez pour mon examen', visibility: 'public' });
      expect(res.statusCode).toBe(201);
      prPublic = res.body.data.prayer.id;
    });

    it('partage une demande de groupe', async () => {
      const res = await request(app).post('/api/v1/community/prayers').set(asMember())
        .send({ title: 'Sujet du groupe', visibility: 'group', group_id: gPublic });
      expect(res.statusCode).toBe(201);
      prGroup = res.body.data.prayer.id;
    });

    it("exige un groupe quand la visibilité est 'group' (400)", async () => {
      const res = await request(app).post('/api/v1/community/prayers').set(asMember())
        .send({ title: 'X', visibility: 'group' });
      expect(res.statusCode).toBe(400);
    });

    it("refuse une demande sur un groupe dont on n'est pas membre (403)", async () => {
      const res = await request(app).post('/api/v1/community/prayers').set(asOut())
        .send({ title: 'X', visibility: 'group', group_id: gPublic });
      expect(res.statusCode).toBe(403);
    });

    it('cloisonne les demandes de groupe', async () => {
      const res = await request(app).get('/api/v1/community/prayers').set(asOut());
      expect(res.body.data.prayers.some((p) => p.id === prPublic)).toBe(true);
      expect(res.body.data.prayers.some((p) => p.id === prGroup)).toBe(false);
    });

    it("masque l'auteur d'une demande anonyme", async () => {
      const created = await request(app).post('/api/v1/community/prayers').set(asMember())
        .send({ title: 'Demande anonyme', visibility: 'public', is_anonymous: true });
      prAnon = created.body.data.prayer.id;

      const res = await request(app).get('/api/v1/community/prayers').set(asOut());
      const anon = res.body.data.prayers.find((p) => p.id === prAnon);
      expect(anon.user_id).toBeNull();
      expect(anon.author_name).toBeNull();
    });

    it('enregistre un soutien « je prie pour toi » et notifie l\'auteur', async () => {
      const res = await request(app).post(`/api/v1/community/prayers/${prPublic}/support`).set(asOut());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.supports_count).toBe(1);
      expect(res.body.data.is_supported).toBe(true);

      const notifs = await request(app).get('/api/v1/notifications').set(asMember());
      expect(notifs.body.data.notifications.some((n) => n.reference_id === prPublic)).toBe(true);
    });

    it('rend le soutien idempotent', async () => {
      const res = await request(app).post(`/api/v1/community/prayers/${prPublic}/support`).set(asOut());
      expect(res.body.data.already_supported).toBe(true);
      expect(res.body.data.supports_count).toBe(1);
    });

    it('retire un soutien', async () => {
      const res = await request(app).delete(`/api/v1/community/prayers/${prPublic}/support`).set(asOut());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.supports_count).toBe(0);
    });

    it('marque une demande comme exaucée', async () => {
      const res = await request(app).patch(`/api/v1/community/prayers/${prPublic}`).set(asMember())
        .send({ status: 'answered', answered_note: 'Examen réussi !' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.prayer.status).toBe('answered');
      expect(res.body.data.prayer.answered_note).toBe('Examen réussi !');
    });

    it("refuse de modifier la demande d'autrui (404)", async () => {
      const res = await request(app).patch(`/api/v1/community/prayers/${prPublic}`).set(asOut()).send({ title: 'pirate' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Annonces communautaires', () => {
    it('permet à un admin de publier une annonce globale', async () => {
      const res = await request(app).post('/api/v1/community/announcements').set(asAdmin())
        .send({ title: 'Annonce globale', content: 'Bienvenue !', priority: 10 });
      expect(res.statusCode).toBe(201);
      anGlobal = res.body.data.announcement.id;
    });

    it('refuse une annonce globale à un non-admin (403)', async () => {
      const res = await request(app).post('/api/v1/community/announcements').set(asMember())
        .send({ title: 'X', content: 'y' });
      expect(res.statusCode).toBe(403);
    });

    it("permet à l'admin du groupe de publier une annonce de groupe", async () => {
      const res = await request(app).post('/api/v1/community/announcements').set(asAdmin())
        .send({ title: 'Annonce du groupe', content: 'Réunion mardi', group_id: gPublic, priority: 5 });
      expect(res.statusCode).toBe(201);
    });

    it('refuse une annonce de groupe à un simple membre (403)', async () => {
      const res = await request(app).post('/api/v1/community/announcements').set(asMember())
        .send({ title: 'X', content: 'y', group_id: gPublic });
      expect(res.statusCode).toBe(403);
    });

    it('trie les épinglées par priorité décroissante et exclut les expirées', async () => {
      await request(app).post('/api/v1/community/announcements').set(asAdmin())
        .send({ title: 'Expirée', content: 'vieille', expires_at: '2020-01-01T00:00:00Z' });

      const res = await request(app).get('/api/v1/community/announcements').set(asMember());
      expect(res.statusCode).toBe(200);
      const list = res.body.data.announcements;
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].priority).toBeGreaterThanOrEqual(list[1].priority);
      expect(list.some((a) => a.title === 'Expirée')).toBe(false);
    });

    it('met à jour puis supprime une annonce', async () => {
      const upd = await request(app).patch(`/api/v1/community/announcements/${anGlobal}`).set(asAdmin())
        .send({ priority: 20 });
      expect(upd.body.data.announcement.priority).toBe(20);

      const del = await request(app).delete(`/api/v1/community/announcements/${anGlobal}`).set(asAdmin());
      expect(del.statusCode).toBe(200);
    });
  });

  describe('Gardes', () => {
    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/community/events');
      expect(res.statusCode).toBe(401);
    });

    it('renvoie 400 pour un id non-UUID', async () => {
      const res = await request(app).get('/api/v1/community/prayers/pas-un-uuid').set(asAdmin());
      expect(res.statusCode).toBe(400);
    });
  });
});
