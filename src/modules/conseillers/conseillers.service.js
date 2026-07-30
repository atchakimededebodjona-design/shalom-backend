const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// Colonnes communes : le nom/email/avatar viennent toujours du compte SHALOM
// lié (jamais dupliqués sur la ligne conseiller), pour rester synchronisés
// avec le profil réel du membre.
const SELECT_FIELDS = `
  c.id, c.user_id, c.telephone, c.specialite, c.bio, c.is_active,
  c.created_at, c.updated_at,
  u.email,
  p.display_name AS nom, p.avatar_url
`;
const JOINS = `
  FROM conseillers c
  JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL
  JOIN profiles p ON p.user_id = c.user_id
`;

// =========================================================================
// 1. Lister les conseillers
// =========================================================================

const getConseillers = async (options = {}) => {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 50;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE c.deleted_at IS NULL';
  const params = [];
  let paramIdx = 1;

  if (options.is_active !== undefined) {
    whereClause += ` AND c.is_active = $${paramIdx}`;
    params.push(options.is_active === 'true' || options.is_active === true);
    paramIdx++;
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total ${JOINS} ${whereClause}`,
    params
  );

  const dataResult = await query(
    `SELECT ${SELECT_FIELDS} ${JOINS} ${whereClause}
     ORDER BY p.display_name ASC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    conseillers: dataResult.rows,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

// =========================================================================
// 2. Obtenir un conseiller spécifique
// =========================================================================

const getConseillerById = async (id) => {
  const { rows } = await query(
    `SELECT ${SELECT_FIELDS} ${JOINS} WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) {
    throw new AppError('Conseiller introuvable', 404, 'CONSEILLER_NOT_FOUND');
  }
  return rows[0];
};

// =========================================================================
// 3. Créer un conseiller — désigne un membre SHALOM existant comme conseiller
// =========================================================================

const createConseiller = async (data) => {
  const { user_id, telephone, specialite, bio, is_active } = data;

  const userCheck = await query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL', [user_id]);
  if (userCheck.rows.length === 0) {
    throw new AppError('Membre introuvable', 404, 'USER_NOT_FOUND');
  }

  const existing = await query(
    'SELECT id FROM conseillers WHERE user_id = $1 AND deleted_at IS NULL',
    [user_id]
  );
  if (existing.rows.length > 0) {
    throw new AppError('Ce membre est déjà désigné comme conseiller', 409, 'CONSEILLER_ALREADY_EXISTS');
  }

  const { rows } = await query(
    `INSERT INTO conseillers (user_id, telephone, specialite, bio, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      user_id,
      telephone || null,
      specialite || null,
      bio || null,
      is_active !== undefined ? is_active : true,
    ]
  );

  return getConseillerById(rows[0].id);
};

// =========================================================================
// 4. Mettre à jour un conseiller (le membre désigné ne se change pas :
//    supprimer puis recréer si l'admin s'est trompé de compte)
// =========================================================================

const updateConseiller = async (id, data) => {
  const existing = await getConseillerById(id);

  const telephone = data.telephone !== undefined ? data.telephone : existing.telephone;
  const specialite = data.specialite !== undefined ? data.specialite : existing.specialite;
  const bio = data.bio !== undefined ? data.bio : existing.bio;
  const is_active = data.is_active !== undefined ? data.is_active : existing.is_active;

  await query(
    `UPDATE conseillers
     SET telephone = $1, specialite = $2, bio = $3, is_active = $4, updated_at = now()
     WHERE id = $5 AND deleted_at IS NULL`,
    [telephone, specialite, bio, is_active, id]
  );

  return getConseillerById(id);
};

// =========================================================================
// 5. Supprimer un conseiller (soft delete)
// =========================================================================

const deleteConseiller = async (id) => {
  const { rowCount } = await query(
    `UPDATE conseillers
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );

  if (rowCount === 0) {
    throw new AppError('Conseiller introuvable ou déjà supprimé', 404, 'CONSEILLER_NOT_FOUND');
  }
};

module.exports = {
  getConseillers,
  getConseillerById,
  createConseiller,
  updateConseiller,
  deleteConseiller,
};
