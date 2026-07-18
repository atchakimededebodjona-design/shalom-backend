const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// =========================================================================
// 1. Lister les contenus (Utilisateur & Admin)
// =========================================================================

/**
 * Récupérer la liste des contenus SHALOM TV
 * @param {object} options - Filtres (target_audience, type, is_published, page, limit)
 * @returns {Promise<object>}
 */
const getContents = async (options = {}) => {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 20;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE deleted_at IS NULL';
  const params = [];
  let paramIdx = 1;

  if (options.target_audience) {
    // Le contenu marqué 'all' (Tous) doit apparaître dans les deux univers
    // (Adultes ET Enfants), pas seulement quand on filtre explicitement sur 'all'.
    if (options.target_audience === 'all') {
      whereClause += ` AND target_audience = $${paramIdx}`;
      params.push('all');
      paramIdx++;
    } else {
      whereClause += ` AND target_audience IN ($${paramIdx}, $${paramIdx + 1})`;
      params.push(options.target_audience, 'all');
      paramIdx += 2;
    }
  }

  if (options.type) {
    whereClause += ` AND type = $${paramIdx}`;
    params.push(options.type);
    paramIdx++;
  }

  if (options.is_published !== undefined) {
    whereClause += ` AND is_published = $${paramIdx}`;
    params.push(options.is_published === 'true' || options.is_published === true);
    paramIdx++;
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM shalom_tv_contents ${whereClause}`,
    params
  );

  const dataResult = await query(
    `SELECT *
     FROM shalom_tv_contents
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    contents: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

// =========================================================================
// 2. Obtenir un contenu spécifique
// =========================================================================

/**
 * Récupérer un contenu par son ID
 * @param {string} contentId
 * @returns {Promise<object>}
 */
const getContentById = async (contentId) => {
  const { rows } = await query(
    `SELECT * FROM shalom_tv_contents WHERE id = $1 AND deleted_at IS NULL`,
    [contentId]
  );
  if (!rows[0]) {
    throw new AppError('Contenu introuvable', 404, 'CONTENT_NOT_FOUND');
  }
  return rows[0];
};

// =========================================================================
// 3. Créer un contenu (Admin)
// =========================================================================

/**
 * Ajouter un nouveau contenu SHALOM TV
 * @param {object} data
 * @returns {Promise<object>}
 */
const createContent = async (data) => {
  const {
    title, description, type, target_audience,
    media_url, thumbnail_url, content_text, duration_seconds, is_published
  } = data;

  const publishedAt = is_published ? 'now()' : null;

  const { rows } = await query(
    `INSERT INTO shalom_tv_contents 
      (title, description, type, target_audience, media_url, thumbnail_url, content_text, duration_seconds, is_published, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${publishedAt})
     RETURNING *`,
    [title, description, type, target_audience, media_url, thumbnail_url, content_text, duration_seconds, is_published]
  );

  return rows[0];
};

// =========================================================================
// 4. Mettre à jour un contenu (Admin)
// =========================================================================

/**
 * Mettre à jour un contenu SHALOM TV
 * @param {string} contentId
 * @param {object} data
 * @returns {Promise<object>}
 */
const updateContent = async (contentId, data) => {
  const existing = await getContentById(contentId);

  const title = data.title !== undefined ? data.title : existing.title;
  const description = data.description !== undefined ? data.description : existing.description;
  const type = data.type !== undefined ? data.type : existing.type;
  const target_audience = data.target_audience !== undefined ? data.target_audience : existing.target_audience;
  const media_url = data.media_url !== undefined ? data.media_url : existing.media_url;
  const thumbnail_url = data.thumbnail_url !== undefined ? data.thumbnail_url : existing.thumbnail_url;
  const content_text = data.content_text !== undefined ? data.content_text : existing.content_text;
  const duration_seconds = data.duration_seconds !== undefined ? data.duration_seconds : existing.duration_seconds;
  
  let is_published = existing.is_published;
  let published_at = existing.published_at;

  if (data.is_published !== undefined) {
    if (data.is_published && !existing.is_published) {
      published_at = new Date();
    } else if (!data.is_published) {
      published_at = null;
    }
    is_published = data.is_published;
  }

  const { rows } = await query(
    `UPDATE shalom_tv_contents
     SET title = $1, description = $2, type = $3, target_audience = $4,
         media_url = $5, thumbnail_url = $6, content_text = $7, duration_seconds = $8,
         is_published = $9, published_at = $10, updated_at = now()
     WHERE id = $11 AND deleted_at IS NULL
     RETURNING *`,
    [title, description, type, target_audience, media_url, thumbnail_url, content_text, duration_seconds, is_published, published_at, contentId]
  );

  return rows[0];
};

// =========================================================================
// 5. Supprimer un contenu (Admin) - Soft Delete
// =========================================================================

/**
 * Supprimer un contenu (Soft Delete)
 * @param {string} contentId
 */
const deleteContent = async (contentId) => {
  const { rowCount } = await query(
    `UPDATE shalom_tv_contents
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [contentId]
  );

  if (rowCount === 0) {
    throw new AppError('Contenu introuvable ou déjà supprimé', 404, 'CONTENT_NOT_FOUND');
  }
};

module.exports = {
  getContents,
  getContentById,
  createContent,
  updateContent,
  deleteContent
};
