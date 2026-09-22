// src/modules/comments/comments.service.js
// Service pour la gestion des commentaires

const { pool, query } = require('../../config/db');
const NotificationService = require('../notifications/notifications.service');
const { PUBLIC_PROFILE_JSON_SQL } = require('../profiles/profiles.service');


/**
 * Ajouter un commentaire à un post
 * Utilise une transaction pour garantir l'incrémentation du compteur
 * @param {string} postId - ID du post
 * @param {string} authorId - ID de l'auteur
 * @param {object} commentData - { content, parent_id }
 * @returns {Promise<object>} Commentaire créé
 */
const addComment = async (postId, authorId, commentData) => {
  const { content, parent_id } = commentData;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insérer le commentaire
    const insertResult = await client.query(
      `INSERT INTO comments (post_id, author_id, parent_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, authorId, parent_id || null, content]
    );
    const newComment = insertResult.rows[0];

    // 2. Incrémenter le compteur sur le post et récupérer l'auteur du post
    const postRes = await client.query(
      `UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1 RETURNING author_id`,
      [postId]
    );
    const postAuthorId = postRes.rows[0].author_id;

    await client.query('COMMIT');

    // 3. Envoyer la notification (hors transaction)
    // reference_id = l'ID du post (pas du commentaire) : c'est ce vers quoi
    // la notification doit renvoyer côté frontend, cohérent avec 'like'.
    if (postAuthorId && postAuthorId !== authorId) {
      await NotificationService.createNotification(postAuthorId, 'comment', authorId, postId);
    }

    return newComment;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Récupérer les commentaires d'un post avec pagination
 * @param {string} postId - ID du post
 * @param {number} limit - Limite de pagination
 * @param {number} offset - Décalage
 * @returns {Promise<{ comments: Array, total: number }>}
 */
const getCommentsByPost = async (postId, limit, offset) => {
  // Compter le total
  const countResult = await query(
    `SELECT count(*) FROM comments WHERE post_id = $1 AND status = 'publie'`,
    [postId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Récupérer les données
  const commentsResult = await query(
    `SELECT
      c.*,
      ${PUBLIC_PROFILE_JSON_SQL} as author_profile
     FROM comments c
     JOIN profiles pr ON c.author_id = pr.user_id
     WHERE c.post_id = $1 AND c.status = 'publie'
     ORDER BY c.created_at ASC
     LIMIT $2 OFFSET $3`,
    [postId, limit, offset]
  );

  return { comments: commentsResult.rows, total };
};

/**
 * Soft delete d'un commentaire
 * Utilise une transaction pour décrémenter le compteur du post
 * @param {string} commentId - ID du commentaire
 * @param {string} authorId - ID de l'auteur (vérification des droits)
 * @returns {Promise<boolean>}
 */
const softDeleteComment = async (commentId, authorId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Récupérer et mettre à jour le commentaire
    const updateResult = await client.query(
      `UPDATE comments
       SET status = 'supprime'
       WHERE id = $1 AND author_id = $2 AND status = 'publie'
       RETURNING post_id`,
      [commentId, authorId]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return false; // Introuvable ou non autorisé
    }

    const postId = updateResult.rows[0].post_id;

    // 2. Décrémenter le compteur
    await client.query(
      `UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1`,
      [postId]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  addComment,
  getCommentsByPost,
  softDeleteComment,
};
