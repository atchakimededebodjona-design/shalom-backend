const express = require('express');
const router = express.Router();

const { getNotifications, getUnreadCount, markAsRead, markAllAsRead } = require('./notifications.controller');
const { listNotificationsValidator, updateNotificationValidator } = require('./notifications.validator');

const { authenticate } = require('../auth/auth.middleware');
const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');

// Toutes les routes de notifications nécessitent une authentification
router.use(authenticate);
router.use(requireActiveSubscription);

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Lister les notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des notifications
 */
router.get('/', listNotificationsValidator, getNotifications);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Obtenir le nombre de notifications non lues
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compteur retourné
 */
router.get('/unread-count', getUnreadCount);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   patch:
 *     summary: Marquer toutes les notifications comme lues
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toutes les notifications sont lues
 */
router.patch('/read-all', markAllAsRead);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Marquer une notification comme lue
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification lue
 */
router.patch('/:id/read', updateNotificationValidator, markAsRead);

module.exports = router;
