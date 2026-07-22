const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// =========================================================================
// 1. Lister les conseillers
// =========================================================================

const getConseillers = async (options = {}) => {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 50;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE deleted_at IS NULL';
  const params = [];
  let paramIdx = 1;

  if (options.is_active !== undefined) {
    whereClause += ` AND is_active = $${paramIdx}`;
    params.push(options.is_active === 'true' || options.is_active === true);
    paramIdx++;
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM conseillers ${whereClause}`,
    params
  );

  const dataResult = await query(
    `SELECT *
     FROM conseillers
     ${whereClause}
     ORDER BY nom ASC
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
    `SELECT * FROM conseillers WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) {
    throw new AppError('Conseiller introuvable', 404, 'CONSEILLER_NOT_FOUND');
  }
  return rows[0];
};

// =========================================================================
// 3. Créer un conseiller
// =========================================================================

const createConseiller = async (data) => {
  const { nom, email, telephone, specialite, bio, is_active } = data;

  const { rows } = await query(
    `INSERT INTO conseillers (nom, email, telephone, specialite, bio, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      nom,
      email || null,
      telephone || null,
      specialite || null,
      bio || null,
      is_active !== undefined ? is_active : true,
    ]
  );

  return rows[0];
};

// =========================================================================
// 4. Mettre à jour un conseiller
// =========================================================================

const updateConseiller = async (id, data) => {
  const existing = await getConseillerById(id);

  const nom = data.nom !== undefined ? data.nom : existing.nom;
  const email = data.email !== undefined ? data.email : existing.email;
  const telephone = data.telephone !== undefined ? data.telephone : existing.telephone;
  const specialite = data.specialite !== undefined ? data.specialite : existing.specialite;
  const bio = data.bio !== undefined ? data.bio : existing.bio;
  const is_active = data.is_active !== undefined ? data.is_active : existing.is_active;

  const { rows } = await query(
    `UPDATE conseillers
     SET nom = $1, email = $2, telephone = $3, specialite = $4, bio = $5, is_active = $6, updated_at = now()
     WHERE id = $7 AND deleted_at IS NULL
     RETURNING *`,
    [nom, email, telephone, specialite, bio, is_active, id]
  );

  return rows[0];
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
