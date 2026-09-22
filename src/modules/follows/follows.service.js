// src/modules/follows/follows.service.js
const { query } = require('../../config/db');
const NotificationService = require('../notifications/notifications.service');
const { PUBLIC_PROFILE_JSON_SQL } = require('../profiles/profiles.service');


/**
 * Suivre un utilisateur
 */
const followUser = async (followerId, followedId) => {
  if (followerId === followedId) {
    throw new Error('SELF_FOLLOW');
  }

  // Vérifier que le compte suivi existe
  const userCheck = await query(`SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL`, [followedId]);
  if (userCheck.rowCount === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  try {
    const result = await query(
      `INSERT INTO follows (follower_id, followed_id) 
       VALUES ($1, $2) 
       ON CONFLICT (follower_id, followed_id) DO NOTHING 
       RETURNING *`,
      [followerId, followedId]
    );

    if (result.rowCount > 0) {
      await NotificationService.createNotification(followedId, 'follow', followerId, null);
      return true;
    }

    return false;
  } catch (error) {
    if (error.code === '23514') { // Violation de la contrainte CHECK (follower_id <> followed_id)
      throw new Error('SELF_FOLLOW');
    }
    throw error;
  }
};

/**
 * Ne plus suivre un utilisateur
 */
const unfollowUser = async (followerId, followedId) => {
  const result = await query(
    `DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2 RETURNING *`,
    [followerId, followedId]
  );
  return result.rowCount > 0;
};

/**
 * Récupérer la liste des abonnés (followers)
 */
const getFollowers = async (userId, limit, offset) => {
  const countResult = await query(
    `SELECT count(*) FROM follows WHERE followed_id = $1`,
    [userId]
  );
  
  const followersResult = await query(
    `SELECT f.created_at as followed_at, ${PUBLIC_PROFILE_JSON_SQL} as profile
     FROM follows f
     JOIN profiles pr ON f.follower_id = pr.user_id
     WHERE f.followed_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    followers: followersResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

/**
 * Récupérer la liste des abonnements (following)
 */
const getFollowing = async (userId, limit, offset) => {
  const countResult = await query(
    `SELECT count(*) FROM follows WHERE follower_id = $1`,
    [userId]
  );

  const followingResult = await query(
    `SELECT f.created_at as followed_at, ${PUBLIC_PROFILE_JSON_SQL} as profile
     FROM follows f
     JOIN profiles pr ON f.followed_id = pr.user_id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    following: followingResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

/**
 * Vérifier si l'utilisateur actuel suit un autre utilisateur
 */
const checkFollowStatus = async (followerId, followedId) => {
  const result = await query(
    `SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2`,
    [followerId, followedId]
  );
  return result.rowCount > 0;
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
};
