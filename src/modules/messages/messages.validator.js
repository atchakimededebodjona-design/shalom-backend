// src/modules/messages/messages.validator.js
const { body, param } = require('express-validator');

const conversationIdSchema = [
  param('id').isUUID().withMessage('ID de conversation invalide')
];

const createConversationSchema = [
  body('participant_ids').isArray({ min: 1 }).withMessage('participant_ids doit être un tableau avec au moins 1 ID'),
  body('participant_ids.*').isUUID().withMessage('Chaque ID doit être un UUID valide'),
  body('is_group').optional().isBoolean().withMessage('is_group doit être un booléen')
];

const sendMessageSchema = [
  ...conversationIdSchema,
  body().custom((value, { req }) => {
    if (!req.body.content && !req.body.media_url) {
      throw new Error('Le message doit contenir au moins du texte (content) ou un média (media_url)');
    }
    return true;
  }),
  body('content').optional().trim(),
  body('media_url').optional().trim().isURL().withMessage('URL de média invalide')
];

module.exports = {
  conversationIdSchema,
  createConversationSchema,
  sendMessageSchema
};
