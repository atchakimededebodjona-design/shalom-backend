const { param, query } = require('express-validator');

const listNotificationsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100')
];

const updateNotificationValidator = [
  param('id')
    .isUUID()
    .withMessage('L\'ID de la notification doit être un UUID valide')
];

module.exports = {
  listNotificationsValidator,
  updateNotificationValidator
};
