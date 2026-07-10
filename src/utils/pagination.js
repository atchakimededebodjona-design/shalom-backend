// src/utils/pagination.js
// Utilitaire de pagination — standardise la pagination sur toutes les routes de liste

/**
 * Extrait et normalise les paramètres de pagination depuis la query string.
 *
 * @param {object} query - req.query de la requête Express
 * @param {object} [options] - Options de configuration
 * @param {number} [options.defaultLimit=20] - Limite par défaut
 * @param {number} [options.maxLimit=100] - Limite maximum autorisée
 * @returns {{ page: number, limit: number, offset: number }}
 *
 * @example
 * // GET /api/v1/posts?page=2&limit=10
 * const { page, limit, offset } = getPagination(req.query);
 * // → { page: 2, limit: 10, offset: 10 }
 */
const getPagination = (query, options = {}) => {
  const { defaultLimit = 20, maxLimit = 100 } = options;

  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  // Valeurs par défaut et bornes
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Formate les métadonnées de pagination pour la réponse API.
 *
 * @param {number} page - Page courante
 * @param {number} limit - Nombre d'éléments par page
 * @param {number} totalCount - Nombre total d'éléments
 * @returns {{ page: number, limit: number, total_count: number, total_pages: number, has_next: boolean, has_previous: boolean }}
 *
 * @example
 * const pagination = formatPagination(2, 20, 55);
 * // → { page: 2, limit: 20, total_count: 55, total_pages: 3, has_next: true, has_previous: true }
 */
const formatPagination = (page, limit, totalCount) => {
  const totalPages = Math.ceil(totalCount / limit);

  return {
    page,
    limit,
    total_count: totalCount,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_previous: page > 1,
  };
};

module.exports = { getPagination, formatPagination };
