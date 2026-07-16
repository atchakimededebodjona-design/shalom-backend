// src/modules/messages/messages.service.js
const { pool, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * Vérifier la participation
 */
const _verifyParticipation = async (conversationId, userId) => {
  const result = await query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Non autorisé. Vous ne participez pas à cette conversation.', 403, 'FORBIDDEN');
  }
};

/**
 * Créer ou récupérer une conversation
 */
const createOrGetConversation = async (userId, participantIds, isGroup) => {
  // Garantir que l'utilisateur connecté est dans la liste
  let allIds = [...new Set([...participantIds, userId])];

  const client = await pool.connect();
  try {
    // 1-à-1 : Chercher une conversation existante
    if (!isGroup && allIds.length === 2) {
      const [id1, id2] = allIds.sort(); // Trier pour garantir l'ordre
      const existingConvo = await client.query(
        `SELECT conversation_id 
         FROM conversation_participants 
         WHERE conversation_id IN (SELECT id FROM conversations WHERE is_group = false)
         GROUP BY conversation_id 
         HAVING array_agg(user_id ORDER BY user_id) = ARRAY[$1::uuid, $2::uuid]`,
        [id1, id2]
      );

      if (existingConvo.rowCount > 0) {
        return { conversation_id: existingConvo.rows[0].conversation_id, is_new: false };
      }
    }

    // Création d'une nouvelle conversation
    await client.query('BEGIN');
    const convoRes = await client.query(
      `INSERT INTO conversations (is_group) VALUES ($1) RETURNING id, is_group, created_at`,
      [isGroup]
    );
    const newConvoId = convoRes.rows[0].id;

    // Insertion des participants
    const placeholders = allIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    const values = [newConvoId, ...allIds];
    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${placeholders}`,
      values
    );

    await client.query('COMMIT');
    return { conversation_id: newConvoId, is_new: true, conversation: convoRes.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Lister les conversations avec aperçu, non-lus et profils des participants
 */
const getUserConversations = async (userId, limit, offset) => {
  // On récupère le nombre total de conversations pour la pagination
  const countResult = await query(
    `SELECT count(conversation_id) FROM conversation_participants WHERE user_id = $1`,
    [userId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Requête complexe avec JSON aggregation pour les participants
  const dataResult = await query(
    `WITH LastMessages AS (
      SELECT conversation_id, content, media_url, created_at, sender_id,
             ROW_NUMBER() OVER(PARTITION BY conversation_id ORDER BY created_at DESC) as rn
      FROM messages
    ),
    UnreadCounts AS (
      SELECT conversation_id, COUNT(*) as unread_count
      FROM messages
      WHERE sender_id != $1 AND is_read = false
      GROUP BY conversation_id
    ),
    OtherParticipants AS (
      SELECT cp.conversation_id,
             json_agg(json_build_object(
               'user_id', pr.user_id,
               'display_name', pr.display_name,
               'avatar_url', pr.avatar_url
             )) as participants_profiles
      FROM conversation_participants cp
      JOIN profiles pr ON cp.user_id = pr.user_id
      WHERE cp.user_id != $1
      GROUP BY cp.conversation_id
    )
    SELECT 
      c.id, c.is_group, c.created_at as convo_created_at,
      lm.content as last_message_content, lm.created_at as last_message_date,
      COALESCE(uc.unread_count, 0) as unread_count,
      COALESCE(op.participants_profiles, '[]'::json) as other_participants
    FROM conversation_participants cp_me
    JOIN conversations c ON cp_me.conversation_id = c.id
    LEFT JOIN LastMessages lm ON c.id = lm.conversation_id AND lm.rn = 1
    LEFT JOIN UnreadCounts uc ON c.id = uc.conversation_id
    LEFT JOIN OtherParticipants op ON c.id = op.conversation_id
    WHERE cp_me.user_id = $1
    ORDER BY last_message_date DESC NULLS LAST
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    conversations: dataResult.rows.map(row => ({
      ...row,
      unread_count: parseInt(row.unread_count, 10)
    })),
    total
  };
};

/**
 * Récupérer le détail d'une conversation (avec les autres participants)
 * Vérifie que le demandeur y participe.
 */
const getConversation = async (userId, conversationId) => {
  await _verifyParticipation(conversationId, userId);

  const result = await query(
    `SELECT c.id, c.is_group, c.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'user_id', pr.user_id,
                  'display_name', pr.display_name,
                  'avatar_url', pr.avatar_url
                )
              ) FILTER (WHERE pr.user_id <> $2),
              '[]'
            ) AS other_participants
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     JOIN profiles pr ON pr.user_id = cp.user_id
     WHERE c.id = $1
     GROUP BY c.id`,
    [conversationId, userId]
  );

  return result.rows[0] || null;
};

/**
 * Lister les messages d'une conversation
 */
const getConversationMessages = async (userId, conversationId, limit, offset) => {
  await _verifyParticipation(conversationId, userId);

  const countResult = await query(
    `SELECT count(*) FROM messages WHERE conversation_id = $1`,
    [conversationId]
  );
  
  const messagesResult = await query(
    `SELECT m.id, m.sender_id, m.content, m.media_url, m.is_read, m.created_at,
            pr.display_name, pr.avatar_url
     FROM messages m
     JOIN profiles pr ON m.sender_id = pr.user_id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );

  return {
    messages: messagesResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

/**
 * Envoyer un message
 */
const sendMessage = async (userId, conversationId, content, mediaUrl) => {
  await _verifyParticipation(conversationId, userId);

  const result = await query(
    `INSERT INTO messages (conversation_id, sender_id, content, media_url, is_read) 
     VALUES ($1, $2, $3, $4, false)
     RETURNING *`,
    [conversationId, userId, content, mediaUrl]
  );

  return result.rows[0];
};

/**
 * Marquer les messages comme lus
 */
const markAsRead = async (userId, conversationId) => {
  await _verifyParticipation(conversationId, userId);

  const result = await query(
    `UPDATE messages 
     SET is_read = true 
     WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
     RETURNING id`,
    [conversationId, userId]
  );

  return result.rowCount; // Nombre de messages marqués lus
};

module.exports = {
  createOrGetConversation,
  getUserConversations,
  getConversation,
  getConversationMessages,
  sendMessage,
  markAsRead
};
