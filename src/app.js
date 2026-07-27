// src/app.js
// Point d'entrée Express — configuration de l'application

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const { globalLimiter } = require('./middlewares/rate-limit.middleware');

const authRoutes = require('./modules/auth/auth.routes');
const profilesRoutes = require('./modules/profiles/profiles.routes');
const postsRoutes = require('./modules/posts/posts.routes');
const commentsRoutes = require('./modules/comments/comments.routes');
const likesRoutes = require('./modules/likes/likes.routes');
const groupsRoutes = require('./modules/groups/groups.routes');
const followsRoutes = require('./modules/follows/follows.routes');
const messagesRoutes = require('./modules/messages/messages.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const uploadsRoutes = require('./modules/uploads/uploads.routes');
const camajRoutes = require('./modules/camaj/camaj.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const spiritualRoutes = require('./modules/spiritual/spiritual.routes');
const toolsRoutes = require('./modules/tools/tools.routes');
const communityRoutes = require('./modules/community/community.routes');
const walletRoutes = require('./modules/wallet/wallet.routes');
const gamesRoutes = require('./modules/games/games.routes');
const billingRoutes = require('./modules/billing/billing.routes');
const ambassadorRoutes = require('./modules/ambassador/ambassador.routes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Initialisation de l'application Express
const app = express();

// --- Middlewares globaux ---

// Sécurité : headers HTTP
app.use(helmet());

// CORS : origines autorisées
app.use(cors({
  origin: env.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parser JSON (limite à 10mb pour les uploads base64)
// `verify` capture les octets bruts de la requête dans req.rawBody : nécessaire
// pour vérifier la signature HMAC des webhooks de paiement (wallet), qui doit
// porter sur le corps EXACT envoyé par le provider, pas sur une reserialisation.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Parser URL-encoded
app.use(express.urlencoded({ extended: true }));

// Cookies (access_token / refresh_token httpOnly posés par le module auth)
app.use(cookieParser());

// Rate limiting global (100 req / 15 min par IP)
app.use(globalLimiter);

// --- Route de santé ---
app.get('/api/v1/health', (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'SHALOM API est opérationnelle 🕊️',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// --- Documentation Swagger ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "SHALOM API Docs" }));

// --- Fichiers téléversés (servis statiquement) ---
// CORP cross-origin pour permettre l'affichage des médias depuis le front (autre origine)
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Défense en profondeur : ces fichiers viennent de l'extérieur. La route
    // d'upload n'accepte déjà que des images/vidéos authentifiées par leurs
    // octets, mais si un document exécutable parvenait ici, cette CSP
    // l'empêcherait de charger ou d'exécuter quoi que ce soit.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data: blob:; media-src 'self' data: blob:");
    next();
  },
  express.static(path.join(__dirname, '..', 'uploads'))
);

// --- Routes de l'API ---
app.use('/api/v1/uploads', uploadsRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profilesRoutes);
app.use('/api/v1/posts', postsRoutes);
app.use('/api/v1/comments', commentsRoutes);
app.use('/api/v1/likes', likesRoutes);
app.use('/api/v1/groups', groupsRoutes);
app.use('/api/v1/follows', followsRoutes);
app.use('/api/v1/conversations', messagesRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/camaj', camajRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/spiritual', spiritualRoutes);
app.use('/api/v1/tools', toolsRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/games', gamesRoutes);
app.use('/api/v1/billing', billingRoutes);
const shalomTvRoutes = require('./modules/shalom-tv/shalom-tv.routes');
const adsRoutes = require('./modules/ads/ads.routes');
const bibleRoutes = require('./modules/bible/bible.routes');
const conseillersRoutes = require('./modules/conseillers/conseillers.routes');

app.use('/api/v1/ambassador', ambassadorRoutes);
app.use('/api/v1/shalom-tv', shalomTvRoutes);
app.use('/api/v1/ads', adsRoutes);
app.use('/api/v1/bible', bibleRoutes);
app.use('/api/v1/conseillers', conseillersRoutes);
// --- Gestion des erreurs ---

// 404 — Route non trouvée
app.use(notFoundHandler);

// Middleware centralisé d'erreurs
app.use(errorHandler);

module.exports = app;
