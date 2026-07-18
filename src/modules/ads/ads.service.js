const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// =========================================================================
// 1. Lister les publicités (Utilisateur & Admin)
// =========================================================================

const getAds = async (options = {}) => {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 20;
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
    `SELECT COUNT(*) AS total FROM ads ${whereClause}`,
    params
  );

  const dataResult = await query(
    `SELECT *
     FROM ads
     ${whereClause}
     ORDER BY display_order ASC, created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    ads: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

// =========================================================================
// 2. Obtenir une publicité spécifique
// =========================================================================

const getAdById = async (adId) => {
  const { rows } = await query(
    `SELECT * FROM ads WHERE id = $1 AND deleted_at IS NULL`,
    [adId]
  );
  if (!rows[0]) {
    throw new AppError('Publicité introuvable', 404, 'AD_NOT_FOUND');
  }
  return rows[0];
};

// =========================================================================
// 3. Créer une publicité (Admin)
// =========================================================================

const createAd = async (data) => {
  const { title, image_url, link_url, is_active, display_order } = data;

  const { rows } = await query(
    `INSERT INTO ads (title, image_url, link_url, is_active, display_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      title,
      image_url,
      link_url || null,
      is_active !== undefined ? is_active : true,
      display_order !== undefined ? display_order : 0
    ]
  );

  return rows[0];
};

// =========================================================================
// 4. Mettre à jour une publicité (Admin)
// =========================================================================

const updateAd = async (adId, data) => {
  const existing = await getAdById(adId);

  const title = data.title !== undefined ? data.title : existing.title;
  const image_url = data.image_url !== undefined ? data.image_url : existing.image_url;
  const link_url = data.link_url !== undefined ? data.link_url : existing.link_url;
  const is_active = data.is_active !== undefined ? data.is_active : existing.is_active;
  const display_order = data.display_order !== undefined ? data.display_order : existing.display_order;

  const { rows } = await query(
    `UPDATE ads
     SET title = $1, image_url = $2, link_url = $3, is_active = $4, display_order = $5, updated_at = now()
     WHERE id = $6 AND deleted_at IS NULL
     RETURNING *`,
    [title, image_url, link_url, is_active, display_order, adId]
  );

  return rows[0];
};

// =========================================================================
// 5. Supprimer une publicité (Admin) - Soft Delete
// =========================================================================

const deleteAd = async (adId) => {
  const { rowCount } = await query(
    `UPDATE ads
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [adId]
  );

  if (rowCount === 0) {
    throw new AppError('Publicité introuvable ou déjà supprimée', 404, 'AD_NOT_FOUND');
  }
};

module.exports = {
  getAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd
};
