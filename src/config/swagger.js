const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

// Liste des serveurs proposés dans Swagger (« Try it out »).
// - Toujours le serveur local, sur le PORT réellement utilisé.
// - En prod, on ajoute (en tête) l'URL publique si API_PUBLIC_URL est définie.
const servers = [
  { url: `http://localhost:${env.PORT}`, description: 'Serveur de développement local' },
];
if (env.API_PUBLIC_URL) {
  servers.unshift({ url: env.API_PUBLIC_URL, description: 'Serveur de production' });
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SHALOM API',
      version: '1.0.0',
      description: 'API REST backend pour la plateforme chrétienne de formation, mentorat et réseau social',
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.js'], // Fichiers contenant les annotations Swagger
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
