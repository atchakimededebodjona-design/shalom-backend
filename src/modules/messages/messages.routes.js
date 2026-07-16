// src/modules/messages/messages.routes.js
const { Router } = require('express');
const messagesController = require('./messages.controller');
const { authenticate } = require('../auth/auth.middleware');
const { 
  createConversationSchema, 
  conversationIdSchema, 
  sendMessageSchema 
} = require('./messages.validator');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/conversations:
 *   post:
 *     summary: Créer ou récupérer une conversation
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participant_ids]
 *             properties:
 *               participant_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_group:
 *                 type: boolean
 *               group_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Conversation créée
 *       200:
 *         description: Conversation existante retournée
 */
router.post('/', createConversationSchema, messagesController.createConversation);

/**
 * @swagger
 * /api/v1/conversations:
 *   get:
 *     summary: Lister les conversations (Inbox)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des conversations
 */
router.get('/', messagesController.getUserConversations);

/**
 * @swagger
 * /api/v1/conversations/{id}:
 *   get:
 *     summary: Détail d'une conversation (participants)
 *     tags: [Messages]
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
 *         description: Détail de la conversation
 *       403:
 *         description: Non participant
 *       404:
 *         description: Conversation introuvable
 */
router.get('/:id', conversationIdSchema, messagesController.getConversation);

/**
 * @swagger
 * /api/v1/conversations/{id}/messages:
 *   get:
 *     summary: Obtenir les messages d'une conversation
 *     tags: [Messages]
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
 *         description: Liste des messages
 */
router.get('/:id/messages', conversationIdSchema, messagesController.getConversationMessages);

/**
 * @swagger
 * /api/v1/conversations/{id}/messages:
 *   post:
 *     summary: Envoyer un message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message envoyé
 */
router.post('/:id/messages', sendMessageSchema, messagesController.sendMessage);

/**
 * @swagger
 * /api/v1/conversations/{id}/read:
 *   patch:
 *     summary: Marquer les messages comme lus
 *     tags: [Messages]
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
 *         description: Messages marqués comme lus
 */
router.patch('/:id/read', conversationIdSchema, messagesController.markAsRead);

module.exports = router;
