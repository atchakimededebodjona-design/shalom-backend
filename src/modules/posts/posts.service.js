// src/modules/posts/posts.service.js
// Service pour la gestion des publications (posts)

const { query } = require('../../config/db');

/**
 * Créer un nouveau post
 * @param {string} authorId - ID de l'auteur (utilisateur connecté)
 * @param {object} postData - { type, content, media_url, group_id }
 * @returns {Promise<object>} Post créé
 */
const createPost = async (authorId, postData) => {
  const { type, content, media_url, group_id } = postData;
  const result = await query(
    `INSERT INTO posts (author_id, type, content, media_url, group_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [authorId, type || 'texte', content, media_url || null, group_id || null]
  );
  return result.rows[0];
};

/**
 * Récupérer le fil d'actualité avec pagination
 * Seuls les posts avec status = 'publie' sont renvoyés
 * @param {number} limit - Nombre d'éléments par page
 * @param {number} offset - Décalage pour la pagination
 * @returns {Promise<{ posts: Array, total: number }>}
 */
const getFeed = async (userId, limit, offset) => {
  // Compter le total de posts publiés
  const countResult = await query(
    `SELECT count(*) FROM posts WHERE status = 'publie'`
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Récupérer les posts + infos auteur + état pour l'utilisateur courant
  // (is_liked = a-t-il liké ce post ; is_following = suit-il l'auteur)
  const postsResult = await query(
    `SELECT
      p.*,
      row_to_json(pr.*) as author_profile,
      EXISTS (
        SELECT 1 FROM likes l
        WHERE l.likeable_type = 'post' AND l.likeable_id = p.id AND l.user_id = $1
      ) AS is_liked,
      EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $1 AND f.followed_id = p.author_id
      ) AS is_following
     FROM posts p
     JOIN profiles pr ON p.author_id = pr.user_id
     WHERE p.status = 'publie'
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { posts: postsResult.rows, total };
};

/**
 * Récupérer un post spécifique par ID
 * @param {string} postId - ID du post
 * @returns {Promise<object|null>} Post ou null
 */
const getPostById = async (postId, userId) => {
  const result = await query(
    `SELECT
      p.*,
      row_to_json(pr.*) as author_profile,
      EXISTS (
        SELECT 1 FROM likes l
        WHERE l.likeable_type = 'post' AND l.likeable_id = p.id AND l.user_id = $2
      ) AS is_liked,
      EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $2 AND f.followed_id = p.author_id
      ) AS is_following
     FROM posts p
     JOIN profiles pr ON p.author_id = pr.user_id
     WHERE p.id = $1 AND p.status = 'publie'`,
    [postId, userId]
  );
  return result.rows[0] || null;
};

/**
 * Mettre à jour un post (content et media_url)
 * Seul l'auteur peut modifier son post
 * @param {string} postId - ID du post
 * @param {string} authorId - ID de l'auteur
 * @param {object} updateData - { content, media_url }
 * @returns {Promise<object|null>} Post mis à jour
 */
const updatePost = async (postId, authorId, updateData) => {
  const { content, media_url } = updateData;
  const result = await query(
    `UPDATE posts
     SET content = COALESCE($1, content),
         media_url = COALESCE($2, media_url),
         updated_at = now()
     WHERE id = $3 AND author_id = $4 AND status = 'publie'
     RETURNING *`,
    [content, media_url, postId, authorId]
  );
  return result.rows[0] || null;
};

/**
 * Soft delete d'un post (modifie status en 'supprime')
 * @param {string} postId - ID du post
 * @param {string} authorId - ID de l'auteur
 * @returns {Promise<boolean>} true si supprimé, false si introuvable ou non autorisé
 */
const softDeletePost = async (postId, authorId) => {
  const result = await query(
    `UPDATE posts
     SET status = 'supprime',
         updated_at = now()
     WHERE id = $1 AND author_id = $2 AND status = 'publie'
     RETURNING id`,
    [postId, authorId]
  );
  return result.rowCount > 0;
};

module.exports = {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  softDeletePost,
};
