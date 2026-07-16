// src/modules/messages/messages.controller.js
const messagesService = require('./messages.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');

const createConversation = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const userId = req.user.id;
    const { participant_ids, is_group } = req.body;
    
    const result = await messagesService.createOrGetConversation(userId, participant_ids, is_group || false);
    
    return res.status(result.is_new ? 201 : 200).json({
      success: true,
      message: result.is_new ? 'Conversation créée' : 'Conversation existante',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getUserConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, offset } = getPagination(req.query);
    
    const { conversations, total } = await messagesService.getUserConversations(userId, limit, offset);
    const pagination = formatPagination(page, limit, total);
    
    return res.status(200).json({
      success: true,
      data: { conversations, pagination }
    });
  } catch (error) {
    next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const userId = req.user.id;
    const { id } = req.params;

    const conversation = await messagesService.getConversation(userId, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation introuvable', code: 'CONVERSATION_NOT_FOUND' });
    }

    return res.status(200).json({
      success: true,
      data: { conversation }
    });
  } catch (error) {
    next(error);
  }
};

const getConversationMessages = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const userId = req.user.id;
    const { id } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    
    const { messages, total } = await messagesService.getConversationMessages(userId, id, limit, offset);
    const pagination = formatPagination(page, limit, total);
    
    return res.status(200).json({
      success: true,
      data: { messages, pagination }
    });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const userId = req.user.id;
    const { id } = req.params;
    const { content, media_url } = req.body;
    
    const message = await messagesService.sendMessage(userId, id, content, media_url);
    
    return res.status(201).json({
      success: true,
      message: 'Message envoyé',
      data: { message }
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const userId = req.user.id;
    const { id } = req.params;
    
    const readCount = await messagesService.markAsRead(userId, id);
    
    return res.status(200).json({
      success: true,
      message: `${readCount} message(s) marqué(s) comme lu(s)`,
      data: { read_count: readCount }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createConversation,
  getUserConversations,
  getConversation,
  getConversationMessages,
  sendMessage,
  markAsRead
};
