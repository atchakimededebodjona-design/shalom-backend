// src/modules/tools/tools.service.js
// Accès aux données du module Outils pratiques du quotidien :
// dîme/offrandes, événements personnels, listes de tâches et convertisseur.

const { query } = require('../../config/db');

// =========================================================================
//  Calculatrice de dîme / offrandes
// =========================================================================

/**
 * Enregistre un calcul de dîme. Le montant est calculé côté SQL à partir du
 * revenu et du pourcentage — jamais repris du client.
 */
const createTithe = async (userId, { income_amount, tithe_percentage, offering_amount, calculation_date }) => {
  const pct = tithe_percentage ?? 10;
  const result = await query(
    `INSERT INTO tithe_calculations
       (user_id, income_amount, tithe_percentage, tithe_amount, offering_amount, calculation_date)
     VALUES ($1, $2, $3, ROUND($2::numeric * $3::numeric / 100, 2), $4, COALESCE($5::date, CURRENT_DATE))
     RETURNING *`,
    [userId, income_amount, pct, offering_amount ?? 0, calculation_date || null]
  );
  return result.rows[0];
};

const listTithes = async (userId, { is_paid, from, to, limit, offset }) => {
  const filters = [userId];
  let where = 'user_id = $1';
  if (is_paid !== null && is_paid !== undefined) { filters.push(is_paid); where += ` AND is_paid = $${filters.length}`; }
  if (from) { filters.push(from); where += ` AND calculation_date >= $${filters.length}`; }
  if (to) { filters.push(to); where += ` AND calculation_date <= $${filters.length}`; }

  const countRes = await query(`SELECT count(*)::int AS total FROM tithe_calculations WHERE ${where}`, filters);
  const rows = await query(
    `SELECT * FROM tithe_calculations WHERE ${where}
     ORDER BY calculation_date DESC, created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { calculations: rows.rows, total: countRes.rows[0].total };
};

const getTitheById = async (id, userId) => {
  const result = await query(`SELECT * FROM tithe_calculations WHERE id = $1 AND user_id = $2`, [id, userId]);
  return result.rows[0] || null;
};

// Marquer payé horodate paid_at ; repasser à non payé l'efface.
const updateTithe = async (id, userId, { is_paid, offering_amount }) => {
  const result = await query(
    `UPDATE tithe_calculations
     SET is_paid = COALESCE($1, is_paid),
         offering_amount = COALESCE($2, offering_amount),
         paid_at = CASE
           WHEN $1 = true AND paid_at IS NULL THEN now()
           WHEN $1 = false THEN NULL
           ELSE paid_at END
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [is_paid ?? null, offering_amount ?? null, id, userId]
  );
  return result.rows[0] || null;
};

// La table n'a pas de deleted_at : suppression définitive.
const deleteTithe = async (id, userId) => {
  const result = await query(
    `DELETE FROM tithe_calculations WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Événements personnels
// =========================================================================

const createEvent = async (userId, data) => {
  const { title, event_type, description, start_date, end_date, reminder_enabled, reminder_before_minutes } = data;
  const result = await query(
    `INSERT INTO personal_events
       (user_id, title, event_type, description, start_date, end_date, reminder_enabled, reminder_before_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, title, event_type || 'autre', description || null, start_date, end_date || null,
      reminder_enabled ?? false, reminder_before_minutes ?? 60]
  );
  return result.rows[0];
};

const listEvents = async (userId, { status, event_type, from, to, limit, offset }) => {
  const filters = [userId];
  let where = 'user_id = $1 AND deleted_at IS NULL';
  if (status) { filters.push(status); where += ` AND status = $${filters.length}`; }
  if (event_type) { filters.push(event_type); where += ` AND event_type = $${filters.length}`; }
  if (from) { filters.push(from); where += ` AND start_date >= $${filters.length}`; }
  if (to) { filters.push(to); where += ` AND start_date <= $${filters.length}`; }

  const countRes = await query(`SELECT count(*)::int AS total FROM personal_events WHERE ${where}`, filters);
  const rows = await query(
    `SELECT * FROM personal_events WHERE ${where}
     ORDER BY start_date ASC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { events: rows.rows, total: countRes.rows[0].total };
};

const getEventById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM personal_events WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const updateEvent = async (id, userId, data) => {
  const { title, event_type, description, start_date, end_date, reminder_enabled, reminder_before_minutes, status } = data;
  const result = await query(
    `UPDATE personal_events
     SET title = COALESCE($1, title),
         event_type = COALESCE($2, event_type),
         description = COALESCE($3, description),
         start_date = COALESCE($4::timestamptz, start_date),
         end_date = COALESCE($5::timestamptz, end_date),
         reminder_enabled = COALESCE($6, reminder_enabled),
         reminder_before_minutes = COALESCE($7, reminder_before_minutes),
         status = COALESCE($8, status),
         updated_at = now()
     WHERE id = $9 AND user_id = $10 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, event_type ?? null, description ?? null, start_date ?? null, end_date ?? null,
      reminder_enabled ?? null, reminder_before_minutes ?? null, status ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteEvent = async (id, userId) => {
  const result = await query(
    `UPDATE personal_events SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Listes de tâches
// =========================================================================

const createList = async (userId, { title }) => {
  const result = await query(
    `INSERT INTO task_lists (user_id, title) VALUES ($1, COALESCE($2, 'Ma liste')) RETURNING *`,
    [userId, title || null]
  );
  return result.rows[0];
};

const listLists = async (userId) => {
  const result = await query(
    `SELECT l.*,
            (SELECT count(*)::int FROM tasks t WHERE t.list_id = l.id AND t.deleted_at IS NULL) AS tasks_count,
            (SELECT count(*)::int FROM tasks t WHERE t.list_id = l.id AND t.deleted_at IS NULL AND t.is_completed) AS completed_count
     FROM task_lists l
     WHERE l.user_id = $1 AND l.deleted_at IS NULL
     ORDER BY l.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Détail : la liste et ses tâches triées par position.
const getListById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM task_lists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  const list = result.rows[0];
  if (!list) return null;
  const tasks = await query(
    `SELECT * FROM tasks WHERE list_id = $1 AND deleted_at IS NULL
     ORDER BY position ASC, created_at ASC`,
    [id]
  );
  return { ...list, tasks: tasks.rows };
};

const updateList = async (id, userId, { title }) => {
  const result = await query(
    `UPDATE task_lists SET title = COALESCE($1, title)
     WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [title ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteList = async (id, userId) => {
  const result = await query(
    `UPDATE task_lists SET deleted_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

/**
 * Réordonne les tâches d'une liste : positions 1..n dans l'ordre fourni.
 * Transactionnel — soit tout est réordonné, soit rien.
 * @returns {Promise<Array|null>} les tâches réordonnées, ou null si la liste
 *   n'appartient pas à l'utilisateur / si un id ne fait pas partie de la liste.
 */
const reorderTasks = async (listId, userId, orderedIds) => {
  const owner = await query(
    `SELECT id FROM task_lists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [listId, userId]
  );
  if (!owner.rows[0]) return null;

  // Tous les ids fournis doivent appartenir à cette liste.
  const check = await query(
    `SELECT count(*)::int AS n FROM tasks
     WHERE id = ANY($1) AND list_id = $2 AND user_id = $3 AND deleted_at IS NULL`,
    [orderedIds, listId, userId]
  );
  if (check.rows[0].n !== orderedIds.length) return null;

  const positions = orderedIds.map((_, i) => i + 1);
  await query(
    `UPDATE tasks AS t SET position = v.position
     FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS position) AS v
     WHERE t.id = v.id AND t.list_id = $3 AND t.user_id = $4`,
    [orderedIds, positions, listId, userId]
  );

  const tasks = await query(
    `SELECT * FROM tasks WHERE list_id = $1 AND deleted_at IS NULL ORDER BY position ASC`,
    [listId]
  );
  return tasks.rows;
};

// =========================================================================
//  Tâches
// =========================================================================

// Position auto en fin de liste si non fournie.
const createTask = async (userId, { list_id, content, due_date, position }) => {
  const owner = await query(
    `SELECT id FROM task_lists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [list_id, userId]
  );
  if (!owner.rows[0]) return null;

  let pos = position;
  if (pos === undefined || pos === null) {
    const max = await query(
      `SELECT COALESCE(MAX(position), 0)::int AS m FROM tasks WHERE list_id = $1 AND deleted_at IS NULL`,
      [list_id]
    );
    pos = max.rows[0].m + 1;
  }
  const result = await query(
    `INSERT INTO tasks (list_id, user_id, content, due_date, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [list_id, userId, content, due_date || null, pos]
  );
  return result.rows[0];
};

const listTasks = async (userId, { list_id, is_completed, due_before, limit, offset }) => {
  const filters = [userId];
  let where = 'user_id = $1 AND deleted_at IS NULL';
  if (list_id) { filters.push(list_id); where += ` AND list_id = $${filters.length}`; }
  if (is_completed !== null && is_completed !== undefined) { filters.push(is_completed); where += ` AND is_completed = $${filters.length}`; }
  if (due_before) { filters.push(due_before); where += ` AND due_date <= $${filters.length}`; }

  const countRes = await query(`SELECT count(*)::int AS total FROM tasks WHERE ${where}`, filters);
  const rows = await query(
    `SELECT * FROM tasks WHERE ${where}
     ORDER BY position ASC, created_at ASC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );
  return { tasks: rows.rows, total: countRes.rows[0].total };
};

const getTaskById = async (id, userId) => {
  const result = await query(
    `SELECT * FROM tasks WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

// Cocher une tâche horodate completed_at ; la décocher l'efface.
const updateTask = async (id, userId, { content, is_completed, due_date, position }) => {
  const result = await query(
    `UPDATE tasks
     SET content = COALESCE($1, content),
         is_completed = COALESCE($2, is_completed),
         due_date = COALESCE($3::date, due_date),
         position = COALESCE($4, position),
         completed_at = CASE
           WHEN $2 = true AND completed_at IS NULL THEN now()
           WHEN $2 = false THEN NULL
           ELSE completed_at END
     WHERE id = $5 AND user_id = $6 AND deleted_at IS NULL
     RETURNING *`,
    [content ?? null, is_completed ?? null, due_date ?? null, position ?? null, id, userId]
  );
  return result.rows[0] || null;
};

const softDeleteTask = async (id, userId) => {
  const result = await query(
    `UPDATE tasks SET deleted_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
};

// =========================================================================
//  Convertisseur d'unités
// =========================================================================

// Référentiel : catégories et leurs unités.
const listUnits = async () => {
  const result = await query(
    `SELECT c.id AS category_id, c.name AS category_name,
            u.id, u.name, u.symbol, u.conversion_factor_to_base, u.is_base_unit
     FROM unit_categories c
     JOIN units u ON u.category_id = c.id
     ORDER BY c.name ASC, u.is_base_unit DESC, u.name ASC`
  );
  const byCategory = new Map();
  result.rows.forEach((r) => {
    if (!byCategory.has(r.category_id)) {
      byCategory.set(r.category_id, { id: r.category_id, name: r.category_name, units: [] });
    }
    byCategory.get(r.category_id).units.push({
      id: r.id, name: r.name, symbol: r.symbol,
      conversion_factor_to_base: r.conversion_factor_to_base, is_base_unit: r.is_base_unit,
    });
  });
  return Array.from(byCategory.values());
};

/**
 * Convertit une valeur entre deux unités d'une même catégorie, en passant par
 * l'unité de base : valeur_base = valeur * facteur_source, résultat =
 * valeur_base / facteur_cible. Mémorise la paire dans l'historique.
 * @returns {Promise<{code: string}|object>} objet résultat, ou { code } d'erreur
 *   ('UNIT_NOT_FOUND' | 'CATEGORY_MISMATCH').
 */
const convert = async (userId, { from_unit_id, to_unit_id, value }) => {
  const res = await query(
    `SELECT u.id, u.name, u.symbol, u.conversion_factor_to_base, u.category_id, c.name AS category_name
     FROM units u JOIN unit_categories c ON c.id = u.category_id
     WHERE u.id = ANY($1)`,
    [[from_unit_id, to_unit_id]]
  );
  const from = res.rows.find((r) => r.id === from_unit_id);
  const to = res.rows.find((r) => r.id === to_unit_id);
  if (!from || !to) return { code: 'UNIT_NOT_FOUND' };
  if (from.category_id !== to.category_id) return { code: 'CATEGORY_MISMATCH' };

  const fromFactor = Number(from.conversion_factor_to_base);
  const toFactor = Number(to.conversion_factor_to_base);
  const result = (Number(value) * fromFactor) / toFactor;

  await query(
    `INSERT INTO user_conversion_history (user_id, from_unit_id, to_unit_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, from_unit_id, to_unit_id)
     DO UPDATE SET used_count = user_conversion_history.used_count + 1, last_used_at = now()`,
    [userId, from_unit_id, to_unit_id]
  );

  return {
    value: Number(value),
    result,
    category: from.category_name,
    from: { id: from.id, name: from.name, symbol: from.symbol },
    to: { id: to.id, name: to.name, symbol: to.symbol },
  };
};

const listConversionHistory = async (userId) => {
  const result = await query(
    `SELECT h.used_count, h.last_used_at,
            fu.id AS from_id, fu.name AS from_name, fu.symbol AS from_symbol,
            tu.id AS to_id, tu.name AS to_name, tu.symbol AS to_symbol
     FROM user_conversion_history h
     JOIN units fu ON fu.id = h.from_unit_id
     JOIN units tu ON tu.id = h.to_unit_id
     WHERE h.user_id = $1
     ORDER BY h.last_used_at DESC
     LIMIT 20`,
    [userId]
  );
  return result.rows.map((r) => ({
    used_count: r.used_count,
    last_used_at: r.last_used_at,
    from: { id: r.from_id, name: r.from_name, symbol: r.from_symbol },
    to: { id: r.to_id, name: r.to_name, symbol: r.to_symbol },
  }));
};

module.exports = {
  createTithe, listTithes, getTitheById, updateTithe, deleteTithe,
  createEvent, listEvents, getEventById, updateEvent, softDeleteEvent,
  createList, listLists, getListById, updateList, softDeleteList, reorderTasks,
  createTask, listTasks, getTaskById, updateTask, softDeleteTask,
  listUnits, convert, listConversionHistory,
};
