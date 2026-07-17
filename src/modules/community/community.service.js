// src/modules/community/community.service.js
// Accès aux données du module Outils communautaires : événements + inscriptions,
// demandes de prière partagées + soutiens, annonces épinglées.
//
// Réutilise notifications.service.createNotification() pour prévenir les membres
// d'un groupe (aucune logique de notification n'est redupliquée ici).

const { query, pool } = require('../../config/db');
const notificationsService = require('../notifications/notifications.service');

// L'enum notification_type est partagé (like, comment, follow, mention, groupe,
// systeme) et ne comporte pas de type dédié « prière » ou « événement » : on
// réutilise donc 'groupe' pour tout ce qui est communautaire.
const NOTIF_TYPE = 'groupe';

/** Membres actifs d'un groupe, hors l'auteur de l'action. */
const activeMemberIds = async (groupId, exceptUserId) => {
  const res = await query(
    `SELECT user_id FROM group_members
     WHERE group_id = $1 AND status = 'actif' AND user_id <> $2`,
    [groupId, exceptUserId]
  );
  return res.rows.map((r) => r.user_id);
};

/** L'utilisateur est-il membre actif du groupe ? */
const isActiveMember = async (groupId, userId) => {
  const res = await query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'actif'`,
    [groupId, userId]
  );
  return res.rowCount > 0;
};

/** L'utilisateur administre-t-il le groupe (admin ou modérateur) ? */
const isGroupManager = async (groupId, userId) => {
  const res = await query(
    `SELECT 1 FROM group_members
     WHERE group_id = $1 AND user_id = $2 AND status = 'actif' AND role IN ('admin','moderateur')`,
    [groupId, userId]
  );
  return res.rowCount > 0;
};

// =========================================================================
//  Événements communautaires
// =========================================================================

const createEvent = async (userId, data) => {
  const {
    title, description, event_type, start_date, end_date, location_info,
    cover_image_url, group_id, max_participants, registration_required,
  } = data;

  if (group_id && !(await isActiveMember(group_id, userId))) return { code: 'NOT_A_MEMBER' };

  const result = await query(
    `INSERT INTO community_events
       (title, description, event_type, start_date, end_date, location_info,
        cover_image_url, organizer_id, group_id, max_participants, registration_required)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [title, description || null, event_type || 'autre', start_date, end_date || null,
      location_info || null, cover_image_url || null, userId, group_id || null,
      max_participants ?? null, registration_required ?? false]
  );
  const event = result.rows[0];

  // Prévient les membres du groupe (jamais l'organisateur : createNotification
  // ignore déjà l'auto-notification).
  if (group_id) {
    const members = await activeMemberIds(group_id, userId);
    await Promise.all(members.map((m) => notificationsService.createNotification(m, NOTIF_TYPE, userId, event.id)));
  }
  return event;
};

const listEvents = async (userId, { event_type, status, group_id, from, to, limit, offset }) => {
  // Un seul WHERE, aliasé dès le départ, réutilisé tel quel par le COUNT et le
  // SELECT (pas de réécriture de SQL a posteriori).
  const filters = [userId];
  let where = `e.deleted_at IS NULL AND (e.group_id IS NULL OR e.group_id IN (
    SELECT group_id FROM group_members WHERE user_id = $1 AND status = 'actif'))`;
  if (event_type) { filters.push(event_type); where += ` AND e.event_type = $${filters.length}`; }
  if (status) { filters.push(status); where += ` AND e.status = $${filters.length}`; }
  if (group_id) { filters.push(group_id); where += ` AND e.group_id = $${filters.length}`; }
  if (from) { filters.push(from); where += ` AND e.start_date >= $${filters.length}`; }
  if (to) { filters.push(to); where += ` AND e.start_date <= $${filters.length}`; }

  const countRes = await query(
    `SELECT count(*)::int AS total FROM community_events e WHERE ${where}`,
    filters
  );
  const rows = await query(
    `SELECT e.*,
            g.name AS group_name,
            (SELECT count(*)::int FROM event_registrations r
              WHERE r.event_id = e.id AND r.status = 'registered') AS registrations_count,
            EXISTS (SELECT 1 FROM event_registrations r
                     WHERE r.event_id = e.id AND r.user_id = $1 AND r.status = 'registered') AS is_registered
     FROM community_events e
     LEFT JOIN groups g ON g.id = e.group_id
     WHERE ${where}
     ORDER BY e.start_date ASC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { events: rows.rows, total: countRes.rows[0].total };
};

const getEventById = async (id, userId) => {
  const result = await query(
    `SELECT e.*, g.name AS group_name,
            (SELECT count(*)::int FROM event_registrations r
              WHERE r.event_id = e.id AND r.status = 'registered') AS registrations_count,
            EXISTS (SELECT 1 FROM event_registrations r
                     WHERE r.event_id = e.id AND r.user_id = $2 AND r.status = 'registered') AS is_registered
     FROM community_events e
     LEFT JOIN groups g ON g.id = e.group_id
     WHERE e.id = $1 AND e.deleted_at IS NULL
       AND (e.group_id IS NULL OR e.group_id IN (
             SELECT group_id FROM group_members WHERE user_id = $2 AND status = 'actif'))`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const updateEvent = async (id, userId, data) => {
  const {
    title, description, event_type, start_date, end_date, location_info,
    cover_image_url, max_participants, registration_required, status,
  } = data;
  const result = await query(
    `UPDATE community_events
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         event_type = COALESCE($3, event_type),
         start_date = COALESCE($4::timestamptz, start_date),
         end_date = COALESCE($5::timestamptz, end_date),
         location_info = COALESCE($6, location_info),
         cover_image_url = COALESCE($7, cover_image_url),
         max_participants = COALESCE($8, max_participants),
         registration_required = COALESCE($9, registration_required),
         status = COALESCE($10, status),
         updated_at = now()
     WHERE id = $11 AND organizer_id = $12 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, description ?? null, event_type ?? null, start_date ?? null, end_date ?? null,
      location_info ?? null, cover_image_url ?? null, max_participants ?? null,
      registration_required ?? null, status ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteEvent = async (id, userId) => {
  const result = await query(
    `UPDATE community_events SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND organizer_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

/**
 * Inscription à un événement. La capacité est vérifiée dans une transaction
 * avec verrou sur l'événement, pour éviter de dépasser max_participants en cas
 * d'inscriptions simultanées.
 * @returns {Promise<{code:string}|object>} l'inscription, ou un code d'erreur
 *   ('EVENT_NOT_FOUND' | 'EVENT_FULL' | 'EVENT_CANCELLED').
 */
const registerToEvent = async (eventId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = await client.query(
      `SELECT id, max_participants, status FROM community_events
       WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [eventId]
    );
    const event = ev.rows[0];
    if (!event) { await client.query('ROLLBACK'); return { code: 'EVENT_NOT_FOUND' }; }
    if (event.status === 'cancelled') { await client.query('ROLLBACK'); return { code: 'EVENT_CANCELLED' }; }

    if (event.max_participants !== null) {
      const cnt = await client.query(
        `SELECT count(*)::int AS n FROM event_registrations
         WHERE event_id = $1 AND status = 'registered' AND user_id <> $2`,
        [eventId, userId]
      );
      if (cnt.rows[0].n >= event.max_participants) {
        await client.query('ROLLBACK');
        return { code: 'EVENT_FULL' };
      }
    }

    const reg = await client.query(
      `INSERT INTO event_registrations (event_id, user_id, status)
       VALUES ($1, $2, 'registered')
       ON CONFLICT (event_id, user_id)
       DO UPDATE SET status = 'registered', registered_at = now()
       RETURNING *`,
      [eventId, userId]
    );
    await client.query('COMMIT');
    return reg.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const cancelRegistration = async (eventId, userId) => {
  const result = await query(
    `UPDATE event_registrations SET status = 'cancelled'
     WHERE event_id = $1 AND user_id = $2 AND status <> 'cancelled'
     RETURNING id`,
    [eventId, userId]
  );
  return result.rowCount > 0;
};

// Liste des inscrits — réservée à l'organisateur.
const listRegistrations = async (eventId, userId) => {
  const owner = await query(
    `SELECT id FROM community_events WHERE id = $1 AND organizer_id = $2 AND deleted_at IS NULL`,
    [eventId, userId]
  );
  if (!owner.rows[0]) return null;
  const rows = await query(
    `SELECT r.id, r.status, r.registered_at, r.user_id,
            p.display_name, p.avatar_url
     FROM event_registrations r
     LEFT JOIN profiles p ON p.user_id = r.user_id
     WHERE r.event_id = $1
     ORDER BY r.registered_at ASC`,
    [eventId]
  );
  return rows.rows;
};

// =========================================================================
//  Demandes de prière partagées
// =========================================================================

const createSharedPrayer = async (userId, data) => {
  const { title, description, visibility, group_id, is_anonymous } = data;
  const vis = visibility || (group_id ? 'group' : 'public');

  if (vis === 'group') {
    if (!group_id) return { code: 'GROUP_REQUIRED' };
    if (!(await isActiveMember(group_id, userId))) return { code: 'NOT_A_MEMBER' };
  }

  const result = await query(
    `INSERT INTO shared_prayer_requests (user_id, group_id, visibility, title, description, is_anonymous)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [userId, vis === 'group' ? group_id : null, vis, title, description || null, is_anonymous ?? false]
  );
  const prayer = result.rows[0];

  // Prévient les membres du groupe concerné (les demandes publiques ne
  // déclenchent pas de notification de masse).
  if (vis === 'group' && group_id) {
    const members = await activeMemberIds(group_id, userId);
    await Promise.all(members.map((m) => notificationsService.createNotification(m, NOTIF_TYPE, userId, prayer.id)));
  }
  return prayer;
};

const listSharedPrayers = async (userId, { visibility, status, group_id, limit, offset }) => {
  // Visible : demandes publiques + demandes des groupes dont on est membre actif.
  const filters = [userId];
  let where = `sp.deleted_at IS NULL AND (sp.visibility = 'public' OR sp.group_id IN (
    SELECT group_id FROM group_members WHERE user_id = $1 AND status = 'actif'))`;
  if (visibility) { filters.push(visibility); where += ` AND sp.visibility = $${filters.length}`; }
  if (status) { filters.push(status); where += ` AND sp.status = $${filters.length}`; }
  if (group_id) { filters.push(group_id); where += ` AND sp.group_id = $${filters.length}`; }

  const countRes = await query(
    `SELECT count(*)::int AS total FROM shared_prayer_requests sp WHERE ${where}`,
    filters
  );

  // L'anonymat est appliqué à la lecture : l'auteur n'est jamais exposé quand
  // is_anonymous, tout en conservant `is_mine` pour que l'auteur se retrouve.
  const rows = await query(
    `SELECT sp.id, sp.group_id, sp.visibility, sp.title, sp.description, sp.is_anonymous,
            sp.status, sp.answered_note, sp.created_at, sp.updated_at,
            CASE WHEN sp.is_anonymous THEN NULL ELSE sp.user_id END AS user_id,
            CASE WHEN sp.is_anonymous THEN NULL ELSE p.display_name END AS author_name,
            CASE WHEN sp.is_anonymous THEN NULL ELSE p.avatar_url END AS author_avatar,
            g.name AS group_name,
            (SELECT count(*)::int FROM prayer_request_supports s WHERE s.prayer_request_id = sp.id) AS supports_count,
            EXISTS (SELECT 1 FROM prayer_request_supports s
                     WHERE s.prayer_request_id = sp.id AND s.user_id = $1) AS is_supported,
            (sp.user_id = $1) AS is_mine
     FROM shared_prayer_requests sp
     LEFT JOIN profiles p ON p.user_id = sp.user_id
     LEFT JOIN groups g ON g.id = sp.group_id
     WHERE ${where}
     ORDER BY sp.created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { prayers: rows.rows, total: countRes.rows[0].total };
};

const getSharedPrayerById = async (id, userId) => {
  const result = await query(
    `SELECT sp.id, sp.group_id, sp.visibility, sp.title, sp.description, sp.is_anonymous,
            sp.status, sp.answered_note, sp.created_at, sp.updated_at,
            CASE WHEN sp.is_anonymous THEN NULL ELSE sp.user_id END AS user_id,
            CASE WHEN sp.is_anonymous THEN NULL ELSE p.display_name END AS author_name,
            g.name AS group_name,
            (SELECT count(*)::int FROM prayer_request_supports s WHERE s.prayer_request_id = sp.id) AS supports_count,
            EXISTS (SELECT 1 FROM prayer_request_supports s
                     WHERE s.prayer_request_id = sp.id AND s.user_id = $2) AS is_supported,
            (sp.user_id = $2) AS is_mine
     FROM shared_prayer_requests sp
     LEFT JOIN profiles p ON p.user_id = sp.user_id
     LEFT JOIN groups g ON g.id = sp.group_id
     WHERE sp.id = $1 AND sp.deleted_at IS NULL
       AND (sp.visibility = 'public' OR sp.group_id IN (
             SELECT group_id FROM group_members WHERE user_id = $2 AND status = 'actif'))`,
    [id, userId]
  );
  return result.rows[0] || null;
};

// Passer à « answered » horodate ; en sortir efface la note d'exaucement.
const updateSharedPrayer = async (id, userId, { title, description, status, answered_note, is_anonymous }) => {
  const result = await query(
    `UPDATE shared_prayer_requests
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         answered_note = CASE
           WHEN $3 IS NOT NULL AND $3 <> 'answered' THEN NULL
           ELSE COALESCE($4, answered_note) END,
         is_anonymous = COALESCE($5, is_anonymous),
         updated_at = now()
     WHERE id = $6 AND user_id = $7 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, description ?? null, status ?? null, answered_note ?? null,
      is_anonymous ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteSharedPrayer = async (id, userId) => {
  const result = await query(
    `UPDATE shared_prayer_requests SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

/**
 * « Je prie pour toi » — idempotent. Prévient l'auteur de la demande.
 * @returns {Promise<{code:string}|object>}
 */
const supportPrayer = async (prayerId, userId) => {
  const target = await getSharedPrayerById(prayerId, userId);
  if (!target) return { code: 'PRAYER_NOT_FOUND' };

  const result = await query(
    `INSERT INTO prayer_request_supports (prayer_request_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (prayer_request_id, user_id) DO NOTHING
     RETURNING *`,
    [prayerId, userId]
  );
  const alreadySupported = result.rowCount === 0;

  if (!alreadySupported) {
    // L'auteur réel (même si la demande est anonyme pour les autres).
    const owner = await query(`SELECT user_id FROM shared_prayer_requests WHERE id = $1`, [prayerId]);
    if (owner.rows[0]) {
      await notificationsService.createNotification(owner.rows[0].user_id, NOTIF_TYPE, userId, prayerId);
    }
  }

  const count = await query(
    `SELECT count(*)::int AS n FROM prayer_request_supports WHERE prayer_request_id = $1`,
    [prayerId]
  );
  return { supports_count: count.rows[0].n, already_supported: alreadySupported, is_supported: true };
};

const unsupportPrayer = async (prayerId, userId) => {
  const del = await query(
    `DELETE FROM prayer_request_supports WHERE prayer_request_id = $1 AND user_id = $2 RETURNING id`,
    [prayerId, userId]
  );
  const count = await query(
    `SELECT count(*)::int AS n FROM prayer_request_supports WHERE prayer_request_id = $1`,
    [prayerId]
  );
  return { removed: del.rowCount > 0, supports_count: count.rows[0].n, is_supported: false };
};

// =========================================================================
//  Annonces communautaires
// =========================================================================

const createAnnouncement = async (userId, data) => {
  const { title, content, group_id, is_pinned, priority, expires_at } = data;
  if (group_id && !(await isGroupManager(group_id, userId))) return { code: 'NOT_GROUP_MANAGER' };

  const result = await query(
    `INSERT INTO community_announcements (title, content, group_id, posted_by, is_pinned, priority, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [title, content, group_id || null, userId, is_pinned ?? true, priority ?? 0, expires_at || null]
  );
  const announcement = result.rows[0];

  if (group_id) {
    const members = await activeMemberIds(group_id, userId);
    await Promise.all(members.map((m) => notificationsService.createNotification(m, NOTIF_TYPE, userId, announcement.id)));
  }
  return announcement;
};

// Annonces globales + celles de ses groupes, hors annonces expirées.
// Tri : épinglées d'abord, puis priorité décroissante, puis les plus récentes.
const listAnnouncements = async (userId, { group_id, limit, offset }) => {
  const filters = [userId];
  let extra = '';
  if (group_id) { filters.push(group_id); extra = ` AND a.group_id = $${filters.length}`; }

  const countRes = await query(
    `SELECT count(*)::int AS total FROM community_announcements a
     WHERE a.deleted_at IS NULL
       AND (a.expires_at IS NULL OR a.expires_at > now())
       AND (a.group_id IS NULL OR a.group_id IN (
             SELECT group_id FROM group_members WHERE user_id = $1 AND status = 'actif'))${extra}`,
    filters
  );

  const rows = await query(
    `SELECT a.*, g.name AS group_name, p.display_name AS author_name, p.avatar_url AS author_avatar
     FROM community_announcements a
     LEFT JOIN groups g ON g.id = a.group_id
     LEFT JOIN profiles p ON p.user_id = a.posted_by
     WHERE a.deleted_at IS NULL
       AND (a.expires_at IS NULL OR a.expires_at > now())
       AND (a.group_id IS NULL OR a.group_id IN (
             SELECT group_id FROM group_members WHERE user_id = $1 AND status = 'actif'))${extra}
     ORDER BY a.is_pinned DESC, a.priority DESC, a.created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { announcements: rows.rows, total: countRes.rows[0].total };
};

const updateAnnouncement = async (id, userId, { title, content, is_pinned, priority, expires_at }) => {
  const result = await query(
    `UPDATE community_announcements
     SET title = COALESCE($1, title),
         content = COALESCE($2, content),
         is_pinned = COALESCE($3, is_pinned),
         priority = COALESCE($4, priority),
         expires_at = COALESCE($5::timestamptz, expires_at),
         updated_at = now()
     WHERE id = $6 AND posted_by = $7 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, content ?? null, is_pinned ?? null, priority ?? null, expires_at ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteAnnouncement = async (id, userId) => {
  const result = await query(
    `UPDATE community_announcements SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND posted_by = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

module.exports = {
  isActiveMember, isGroupManager,
  createEvent, listEvents, getEventById, updateEvent, softDeleteEvent,
  registerToEvent, cancelRegistration, listRegistrations,
  createSharedPrayer, listSharedPrayers, getSharedPrayerById, updateSharedPrayer,
  softDeleteSharedPrayer, supportPrayer, unsupportPrayer,
  createAnnouncement, listAnnouncements, updateAnnouncement, softDeleteAnnouncement,
};
