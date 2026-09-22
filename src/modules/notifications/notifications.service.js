const { pool } = require('../../config/db');

class NotificationsService {
  /**
   * Créer une nouvelle notification (fonction interne utilisée par d'autres modules)
   */
  async createNotification(userId, type, actorId, referenceId) {
    // Éviter de s'envoyer des notifications à soi-même (ex: auto-like)
    if (userId === actorId) {
      return null;
    }

    try {
      const result = await pool.query(
        `INSERT INTO notifications (user_id, type, actor_id, reference_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, type, actorId, referenceId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la création de notification:', error);
      // On ne lève pas l'erreur pour ne pas bloquer l'action principale (ex: like)
      return null;
    }
  }

  async getNotifications(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Jamais l'email de l'acteur : seuls des champs publics du profil
    // (display_name, avatar_url) sont exposés au destinataire de la
    // notification, cf. profiles.service.js#findPublicProfileByUserId.
    const result = await pool.query(
      `SELECT n.*,
              p.display_name as actor_name,
              p.avatar_url as actor_avatar
       FROM notifications n
       LEFT JOIN profiles p ON n.actor_id = p.user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      notifications: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getUnreadCount(userId) {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  async markAsRead(userId, notificationId) {
    const result = await pool.query(
      `UPDATE notifications SET is_read = true 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      const error = new Error("Notification introuvable ou vous n'avez pas les droits");
      error.code = 'NOTIFICATION_NOT_FOUND';
      throw error;
    }

    return result.rows[0];
  }

  async markAllAsRead(userId) {
    const result = await pool.query(
      `UPDATE notifications SET is_read = true 
       WHERE user_id = $1 AND is_read = false 
       RETURNING *`,
      [userId]
    );
    return result.rows;
  }
}

module.exports = new NotificationsService();
