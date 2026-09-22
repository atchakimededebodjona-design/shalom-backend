// src/modules/likes/likes.service.js
// Service pour les likes

const { pool } = require('../../config/db');
const NotificationService = require('../notifications/notifications.service');


/**
 * Liker un post ou un commentaire.
 *
 * `likeable_id` est polymorphe (post ou comment selon `likeable_type`) : la
 * table `likes` ne peut pas porter de FK classique dessus. Sans autre garde,
 * un `likeable_id` inexistant (ou existant mais du mauvais type) produisait
 * un "like fantôme" : l'INSERT réussissait quand même, l'UPDATE du compteur
 * touchait 0 ligne sans erreur, la transaction était COMMIT, et l'API
 * répondait 201 pour une ressource qui n'existe pas.
 *
 * Correction : l'existence de la cible est vérifiée par un `WHERE EXISTS`
 * dans la MÊME instruction INSERT (`INSERT ... SELECT ... WHERE EXISTS`) —
 * l'existence et l'unicité du like sont donc tranchées atomiquement par
 * PostgreSQL en une seule requête, sans fenêtre "SELECT puis attendre puis
 * INSERT" à protéger séparément.
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {object} likeData - { likeable_type, likeable_id }
 * @returns {Promise<'created'|'already_liked'|'not_found'>}
 */
const addLike = async (userId, likeData) => {
  const { likeable_type, likeable_id } = likeData;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // L'INSERT ne produit une ligne QUE si la cible existe réellement dans la
    // table correspondant à likeable_type. ON CONFLICT protège toujours
    // contre le doublon (idempotence d'un second like identique).
    const insertResult = await client.query(
      `INSERT INTO likes (user_id, likeable_type, likeable_id)
       SELECT $1, $2::likeable_type, $3::uuid
       WHERE EXISTS (
         SELECT 1 FROM posts WHERE id = $3::uuid AND $2 = 'post'
         UNION ALL
         SELECT 1 FROM comments WHERE id = $3::uuid AND $2 = 'comment'
       )
       ON CONFLICT (user_id, likeable_type, likeable_id) DO NOTHING
       RETURNING id`,
      [userId, likeable_type, likeable_id]
    );

    if (insertResult.rowCount === 0) {
      // rowCount=0 recouvre deux cas distincts : déjà liké, ou cible
      // inexistante/mauvais type — à distinguer pour renvoyer 409 ou 404.
      // Vérifié dans la même transaction (READ COMMITTED) : si notre INSERT
      // ci-dessus avait réussi, il serait déjà visible ici : aucune fenêtre
      // de course supplémentaire par rapport à ce que l'INSERT vient de trancher.
      const targetTable = likeable_type === 'post' ? 'posts' : 'comments';
      const targetCheck = await client.query(`SELECT 1 FROM ${targetTable} WHERE id = $1`, [likeable_id]);
      await client.query('ROLLBACK');
      return targetCheck.rowCount === 0 ? 'not_found' : 'already_liked';
    }

    // Incrémenter le compteur selon le type et récupérer l'auteur.
    // On résout aussi postId pour le like d'un commentaire : reference_id
    // doit toujours pointer vers le post (ce vers quoi la notification
    // renvoie côté frontend), jamais vers le commentaire lui-même.
    let authorId = null;
    let postId = likeable_type === 'post' ? likeable_id : null;
    if (likeable_type === 'post') {
      const postRes = await client.query(
        `UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING author_id`,
        [likeable_id]
      );
      if (postRes.rows.length > 0) authorId = postRes.rows[0].author_id;
    } else if (likeable_type === 'comment') {
      const commentRes = await client.query(
        `SELECT author_id, post_id FROM comments WHERE id = $1`,
        [likeable_id]
      );
      if (commentRes.rows.length > 0) {
        authorId = commentRes.rows[0].author_id;
        postId = commentRes.rows[0].post_id;
      }
    }

    await client.query('COMMIT');

    // Envoyer la notification (hors transaction pour éviter de bloquer)
    if (authorId && authorId !== userId) {
      await NotificationService.createNotification(authorId, 'like', userId, postId);
    }

    return 'created';
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
