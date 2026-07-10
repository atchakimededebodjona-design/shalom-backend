const { validationResult } = require('express-validator');
const notificationsService = require('./notifications.service');

exports.getNotifications = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array(), code: 'VALIDATION_ERROR' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const data = await notificationsService.getNotifications(req.user.id, page, limit);
    res.json({
      success: true,
      data,
      message: "Notifications récupérées avec succès"
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des notifications", code: "INTERNAL_ERROR" });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await notificationsService.getUnreadCount(req.user.id);
    res.json({
      success: true,
      data: { unread_count: count },
      message: "Compteur de notifications non lues récupéré avec succès"
    });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération du compteur", code: "INTERNAL_ERROR" });
  }
};

exports.markAsRead = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array(), code: 'VALIDATION_ERROR' });
  }

  try {
    const notificationId = req.params.id;
    const notification = await notificationsService.markAsRead(req.user.id, notificationId);
    res.json({
      success: true,
      data: { notification },
      message: "Notification marquée comme lue"
    });
  } catch (err) {
    if (err.code === 'NOTIFICATION_NOT_FOUND') {
      return res.status(404).json({ success: false, error: err.message, code: err.code });
    }
    console.error('markAsRead error:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour de la notification", code: "INTERNAL_ERROR" });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const notifications = await notificationsService.markAllAsRead(req.user.id);
    res.json({
      success: true,
      data: { count: notifications.length },
      message: `${notifications.length} notification(s) marquée(s) comme lue(s)`
    });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour des notifications", code: "INTERNAL_ERROR" });
  }
};
