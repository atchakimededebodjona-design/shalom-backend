// src/config/env.js
// Charge et exporte les variables d'environnement avec valeurs par défaut

const dotenv = require('dotenv');
dotenv.config();

const env = {
  // Serveur
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  // URL publique de l'API (prod), ex: https://api.mondomaine.com — utilisée par
  // Swagger pour le bouton « Try it out ». En dev, repli sur http://localhost:PORT.
  API_PUBLIC_URL: process.env.API_PUBLIC_URL || null,

  // Base de données PostgreSQL
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT — Access Token
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',

  // JWT — Refresh Token
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS — Origines autorisées (séparées par des virgules)
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'],
};

// Vérification des variables critiques au démarrage
const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

for (const varName of requiredVars) {
  if (!env[varName]) {
    console.error(`❌ Variable d'environnement manquante : ${varName}`);
    process.exit(1);
  }
}

module.exports = env;
