const path = require('path');
const dotenv = require('dotenv');

// Charger les variables de test AVANT l'import de app ou des services
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const { pool } = require('../src/config/db');

// Préfixe strict pour identifier les données de test Jest
const TEST_EMAIL_PREFIX = 'test-jest-';

beforeAll(async () => {
  console.log('🧹 [Setup] Nettoyage global avant la suite de tests...');
  await cleanTestData();
});

afterAll(async () => {
  console.log('🧹 [Teardown] Nettoyage global après la suite de tests...');
  await cleanTestData();
  // Fermer la connexion du pool pour éviter les Open Handles
  await pool.end();
});

async function cleanTestData() {
  try {
    // Supprimer tous les utilisateurs dont l'email commence par TEST_EMAIL_PREFIX.
    // Grâce à "ON DELETE CASCADE", cela supprimera automatiquement leurs profils, posts, comments, likes, follows, groups, messages, reports, notifications.
    // Si la DB n'utilise pas CASCADE partout, il faudra nettoyer les tables manuellement.
    // On nettoie manuellement dans l'ordre (enfants -> parents) pour être sûr de ne pas avoir d'erreur de Foreign Key
    const res = await pool.query(`SELECT id FROM users WHERE email LIKE $1`, [`${TEST_EMAIL_PREFIX}%`]);
    const userIds = res.rows.map(r => r.id);

    if (userIds.length > 0) {
      // 1. Nettoyer les tables dépendantes
      await pool.query(`DELETE FROM notifications WHERE user_id = ANY($1) OR actor_id = ANY($1)`, [userIds]);
      await pool.query(`DELETE FROM reports WHERE reporter_id = ANY($1) OR handled_by = ANY($1)`, [userIds]);
      
      await pool.query(`DELETE FROM messages WHERE sender_id = ANY($1)`, [userIds]);
      await pool.query(`DELETE FROM conversation_participants WHERE user_id = ANY($1)`, [userIds]);
      
      // Nettoyer les conversations où il n'y a plus de participants
      await pool.query(`
        DELETE FROM conversations 
        WHERE id NOT IN (SELECT conversation_id FROM conversation_participants)
      `);

      await pool.query(`DELETE FROM group_members WHERE user_id = ANY($1)`, [userIds]);
      await pool.query(`DELETE FROM groups WHERE created_by = ANY($1)`, [userIds]);

      await pool.query(`DELETE FROM follows WHERE follower_id = ANY($1) OR followed_id = ANY($1)`, [userIds]);
      
      await pool.query(`DELETE FROM likes WHERE user_id = ANY($1)`, [userIds]);
      await pool.query(`DELETE FROM comments WHERE author_id = ANY($1)`, [userIds]);
      await pool.query(`DELETE FROM posts WHERE author_id = ANY($1)`, [userIds]);
      
      await pool.query(`DELETE FROM profiles WHERE user_id = ANY($1)`, [userIds]);
      
      // 2. Nettoyer les utilisateurs
      await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
      
      console.log(`✅ [Teardown] ${userIds.length} utilisateur(s) de test supprimé(s)`);
    }
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des données de test:', error);
  }
}
