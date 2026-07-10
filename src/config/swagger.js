const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SHALOM API',
      version: '1.0.0',
      description: 'API REST backend pour la plateforme chrétienne de formation, mentorat et réseau social',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Serveur de développement local',
      },
    ],
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
