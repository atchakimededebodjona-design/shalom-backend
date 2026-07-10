// src/config/db.js
// Pool de connexion PostgreSQL via node-postgres (pg)

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // SSL requis par Supabase
  ssl: { rejectUnauthorized: false },
  // Paramètres de pool optimisés pour la production
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log de connexion au démarrage
pool.on('connect', () => {
  if (env.NODE_ENV === 'development') {
    console.log('🗄️  Connexion PostgreSQL établie');
  }
});

// Gestion des erreurs de connexion
pool.on('error', (err) => {
  console.error('❌ Erreur inattendue du pool PostgreSQL :', err.message);
  process.exit(1);
});

/**
 * Exécute une requête SQL paramétrée
 * @param {string} text - Requête SQL avec placeholders $1, $2, etc.
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => {
  return pool.query(text, params);
};

module.exports = { pool, query };
