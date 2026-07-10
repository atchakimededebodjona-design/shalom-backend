// src/modules/likes/likes.service.js
// Service pour les likes

const { pool } = require('../../config/db');
const NotificationService = require('../notifications/notifications.service');


/**
 * Liker un post ou un commentaire
 * @param {string} userId - ID de l'utilisateur
 * @param {object} likeData - { likeable_type, likeable_id }
 * @returns {Promise<boolean>} true si ajouté, false si déjà liké
 */
const addLike = async (userId, likeData) => {
  const { likeable_type, likeable_id } = likeData;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Tenter d'insérer le like (ON CONFLICT DO NOTHING protège contre les doublons)
    const insertResult = await client.query(
      `INSERT INTO likes (user_id, likeable_type, likeable_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, likeable_type, likeable_id) DO NOTHING
       RETURNING id`,
      [userId, likeable_type, likeable_id]
    );

    if (insertResult.rowCount === 0) {
      // Déjà liké
      await client.query('ROLLBACK');
      return false;
    }

    // 2. Incrémenter le compteur selon le type et récupérer l'auteur
    let authorId = null;
    if (likeable_type === 'post') {
      const postRes = await client.query(
        `UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING author_id`,
        [likeable_id]
      );
      if (postRes.rows.length > 0) authorId = postRes.rows[0].author_id;
    } else if (likeable_type === 'comment') {
      const commentRes = await client.query(
        `SELECT author_id FROM comments WHERE id = $1`,
        [likeable_id]
      );
      if (commentRes.rows.length > 0) authorId = commentRes.rows[0].author_id;
    }

    await client.query('COMMIT');

    // 3. Envoyer la notification (hors transaction pour éviter de bloquer)
    if (authorId && authorId !== userId) {
      await NotificationService.createNotification(authorId, 'like', userId, likeable_id);
    }

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Retirer un like
 * @param {string} userId - ID de l'utilisateur
 * @param {object} likeData - { likeable_type, likeable_id }
 * @returns {Promise<boolean>} true si supprimé, false si n'existait pas
 */
const removeLike = async (userId, likeData) => {
  const { likeable_type, likeable_id } = likeData;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Tenter de supprimer le like
    const deleteResult = await client.query(
      `DELETE FROM likes 
       WHERE user_id = $1 AND likeable_type = $2 AND likeable_id = $3
       RETURNING id`,
      [userId, likeable_type, likeable_id]
    );

    if (deleteResult.rowCount === 0) {
      // N'existait pas
      await client.query('ROLLBACK');
      return false;
    }

    // 2. Décrémenter le compteur selon le type
    if (likeable_type === 'post') {
      await client.query(
        `UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`,
        [likeable_id]
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

module.exports = {
  addLike,
  removeLike,
};
