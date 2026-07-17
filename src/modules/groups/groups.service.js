// src/modules/groups/groups.service.js
// Service pour la gestion des groupes

const { pool, query } = require('../../config/db');

/**
 * Créer un nouveau groupe
 */
const createGroup = async (userId, groupData) => {
  const { name, description, cover_url, visibility } = groupData;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Créer le groupe
    const groupResult = await client.query(
      `INSERT INTO groups (name, description, cover_url, visibility, created_by, members_count)
       VALUES ($1, $2, $3, $4, $5, 1)
       RETURNING *`,
      [name, description, cover_url || null, visibility || 'public', userId]
    );
    const newGroup = groupResult.rows[0];

    // 2. Ajouter le créateur comme admin (status='actif')
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'actif')`,
      [newGroup.id, userId]
    );

    await client.query('COMMIT');
    return newGroup;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Lister les groupes publics avec pagination et recherche
 */
const getGroups = async (limit, offset, search) => {
  let countQuery = `SELECT count(*) FROM groups WHERE visibility = 'public' AND deleted_at IS NULL`;
  let dataQuery = `SELECT * FROM groups WHERE visibility = 'public' AND deleted_at IS NULL`;
  const params = [limit, offset];
  let searchParamIndex = 3;

  if (search) {
    countQuery += ` AND name ILIKE $1`;
    dataQuery += ` AND name ILIKE $3`;
    params.push(`%${search}%`);
  }

  dataQuery += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`;

  const countResult = await query(
    countQuery,
    search ? [params[2]] : []
  );
  
  const groupsResult = await query(dataQuery, params);

  return {
    groups: groupsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

/**
 * Récupérer un groupe par ID
 */
const getGroupById = async (groupId) => {
  const result = await query(
    `SELECT * FROM groups WHERE id = $1 AND deleted_at IS NULL`,
    [groupId]
  );
  return result.rows[0] || null;
};

/**
 * Mettre à jour un groupe (nom, description, cover_url, visibility)
 * Vérifie si l'utilisateur est admin
 */
const updateGroup = async (groupId, userId, updateData) => {
  const {
    name, description, cover_url, visibility,
    // Champs d'annuaire (ajoutés par 007_community_tools_module)
    group_category, meeting_schedule, location_info, is_directory_visible
  } = updateData;

  const adminCheck = await query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'actif'`,
    [groupId, userId]
  );

  if (adminCheck.rowCount === 0) {
    return null; // Pas admin ou n'existe pas
  }

  const result = await query(
    `UPDATE groups
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         cover_url = COALESCE($3, cover_url),
         visibility = COALESCE($4, visibility),
         group_category = COALESCE($5, group_category),
         meeting_schedule = COALESCE($6, meeting_schedule),
         location_info = COALESCE($7, location_info),
         is_directory_visible = COALESCE($8, is_directory_visible)
     WHERE id = $9 AND deleted_at IS NULL
     RETURNING *`,
    [name, description, cover_url, visibility,
      group_category ?? null, meeting_schedule ?? null, location_info ?? null,
      is_directory_visible ?? null, groupId]
  );

  return result.rows[0];
};

/**
 * Supprimer un groupe (Soft Delete)
 */
const softDeleteGroup = async (groupId, userId) => {
  const adminCheck = await query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'actif'`,
    [groupId, userId]
  );

  if (adminCheck.rowCount === 0) {
    return false;
  }

  const result = await query(
    `UPDATE groups SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [groupId]
  );

  return result.rowCount > 0;
};

/**
 * Rejoindre un groupe
 */
const joinGroup = async (groupId, userId) => {
  const groupResult = await query(
    `SELECT visibility FROM groups WHERE id = $1 AND deleted_at IS NULL`,
    [groupId]
  );

  if (groupResult.rowCount === 0) {
    throw new Error('GROUP_NOT_FOUND');
  }

  const visibility = groupResult.rows[0].visibility;
  const status = visibility === 'public' ? 'actif' : 'en_attente';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insertion ON CONFLICT pour éviter doublons
    const insertResult = await client.query(
      `INSERT INTO group_members (group_id, user_id, role, status)
       VALUES ($1, $2, 'membre', $3)
       ON CONFLICT (group_id, user_id) DO NOTHING
       RETURNING status`,
      [groupId, userId, status]
    );

    if (insertResult.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new Error('ALREADY_MEMBER');
    }

    if (status === 'actif') {
      await client.query(
        `UPDATE groups SET members_count = members_count + 1 WHERE id = $1`,
        [groupId]
      );
    }

    await client.query('COMMIT');
    return status; // 'actif' ou 'en_attente'
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Retirer un membre (ou quitter)
 */
const removeMember = async (groupId, adminId, targetUserId) => {
  // Soit c'est l'utilisateur qui quitte, soit c'est un admin qui le vire
  if (adminId !== targetUserId) {
    const adminCheck = await query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'actif'`,
      [groupId, adminId]
    );
    if (adminCheck.rowCount === 0) {
      return false; // Non autorisé
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const deleteResult = await client.query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING status`,
      [groupId, targetUserId]
    );

    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    // Décrémenter que si l'utilisateur était actif
    if (deleteResult.rows[0].status === 'actif') {
      await client.query(
        `UPDATE groups SET members_count = GREATEST(members_count - 1, 0) WHERE id = $1`,
        [groupId]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Modifier le rôle d'un membre (Admin only)
 */
const updateMemberRole = async (groupId, adminId, targetUserId, newRole) => {
  const adminCheck = await query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'actif'`,
    [groupId, adminId]
  );
  if (adminCheck.rowCount === 0) return false;

  const updateResult = await query(
    `UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3 AND status = 'actif' RETURNING *`,
    [newRole, groupId, targetUserId]
  );

  return updateResult.rowCount > 0;
};

/**
 * Approuver ou refuser un membre en attente (Admin only)
 */
const updateMemberStatus = async (groupId, adminId, targetUserId, newStatus) => {
  const adminCheck = await query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role IN ('admin', 'moderateur') AND status = 'actif'`,
    [groupId, adminId]
  );
  if (adminCheck.rowCount === 0) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (newStatus === 'refuse') {
      const deleteRes = await client.query(
        `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'en_attente' RETURNING id`,
        [groupId, targetUserId]
      );
      await client.query('COMMIT');
      return deleteRes.rowCount > 0;
    } else if (newStatus === 'actif') {
      const updateRes = await client.query(
        `UPDATE group_members SET status = 'actif' WHERE group_id = $1 AND user_id = $2 AND status = 'en_attente' RETURNING *`,
        [groupId, targetUserId]
      );

      if (updateRes.rowCount > 0) {
        await client.query(
          `UPDATE groups SET members_count = members_count + 1 WHERE id = $1`,
          [groupId]
        );
        await client.query('COMMIT');
        return true;
      }
      await client.query('ROLLBACK');
      return false;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Lister les membres d'un groupe (actifs uniquement)
 */
const getMembers = async (groupId, limit, offset) => {
  const countResult = await query(
    `SELECT count(*) FROM group_members WHERE group_id = $1 AND status = 'actif'`,
    [groupId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const membersResult = await query(
    `SELECT gm.role, gm.joined_at, row_to_json(pr.*) as profile
     FROM group_members gm
     JOIN profiles pr ON gm.user_id = pr.user_id
     WHERE gm.group_id = $1 AND gm.status = 'actif'
     ORDER BY gm.joined_at ASC
     LIMIT $2 OFFSET $3`,
    [groupId, limit, offset]
  );

  return { members: membersResult.rows, total };
};

/**
 * Annuaire des groupes / cellules de prière : groupes souhaitant y figurer,
 * filtrables par catégorie et par recherche texte.
 *
 * NB sécurité : `is_directory_visible` vaut `true` par défaut. On exclut donc
 * explicitement les groupes `prive`, sinon ce défaut contournerait le modèle de
 * visibilité déjà en place et exposerait des groupes privés dans l'annuaire.
 *
 * @param {{ category?: string|null, search?: string|null, limit: number, offset: number }} options
 * @returns {Promise<{ groups: Array, total: number }>}
 */
const getDirectory = async ({ category, search, limit, offset }) => {
  const filters = [];
  let where = "deleted_at IS NULL AND is_directory_visible = true AND visibility <> 'prive'";
  if (category) {
    filters.push(category);
    where += ` AND group_category = $${filters.length}`;
  }
  if (search) {
    filters.push(`%${search}%`);
    where += ` AND (name ILIKE $${filters.length} OR description ILIKE $${filters.length})`;
  }

  const countResult = await query(`SELECT count(*)::int AS total FROM groups WHERE ${where}`, filters);

  const rows = await query(
    `SELECT id, name, description, cover_url, visibility, members_count,
            group_category, meeting_schedule, location_info, created_at
     FROM groups
     WHERE ${where}
     ORDER BY members_count DESC, name ASC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset]
  );

  return { groups: rows.rows, total: countResult.rows[0].total };
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  softDeleteGroup,
  joinGroup,
  removeMember,
  updateMemberRole,
  updateMemberStatus,
  getMembers,
  getDirectory
};
