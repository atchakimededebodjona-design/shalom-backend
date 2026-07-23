// src/modules/bible/bible.routes.js
// Texte biblique (Louis Segond 1910) — lecture seule, aucune route admin :
// le contenu est chargé une fois via src/db/seed-bible.js.

const { Router } = require('express');
const controller = require('./bible.controller');
const { authenticate } = require('../auth/auth.middleware');
const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');
const { getChapterValidator, searchValidator } = require('./bible.validator');

const router = Router();

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/versions', controller.listVersions);
router.get('/books', controller.listBooks);
router.get('/books/:bookId/chapters/:chapterNumber', getChapterValidator, controller.getChapter);
router.get('/search', searchValidator, controller.search);

module.exports = router;
