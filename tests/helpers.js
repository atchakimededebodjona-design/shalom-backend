// tests/helpers.js
// Utilitaires partagés entre les suites de tests d'intégration.

const request = require('supertest');
const app = require('../src/app');
const { getLastTestVerificationCode } = require('../src/utils/email');

/**
 * Inscrit un utilisateur puis complète immédiatement la vérification d'email
 * (le code est récupéré via le hook de test de email.js, pas par email réel).
 * Reproduit ce que fait un vrai utilisateur : inscription → code → connecté.
 * @param {{email: string, password: string, display_name: string}} userData
 * @returns {Promise<{registerRes: import('supertest').Response, verifyRes: import('supertest').Response}>}
 */
const registerAndVerify = async (userData) => {
  const registerRes = await request(app).post('/api/v1/auth/register').send(userData);
  const code = getLastTestVerificationCode(userData.email);
  const verifyRes = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ email: userData.email, code });
  return { registerRes, verifyRes };
};

module.exports = { registerAndVerify };
