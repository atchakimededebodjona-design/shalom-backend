// src/server.js
// Démarrage du serveur HTTP

const app = require('./app');
const env = require('./config/env');

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log('================================================');
  console.log(`🕊️  SHALOM API démarrée avec succès`);
  console.log(`📡 Port        : ${PORT}`);
  console.log(`🌍 Environnement: ${env.NODE_ENV}`);
  console.log(`⏰ Heure       : ${new Date().toISOString()}`);
  console.log('================================================');
});
