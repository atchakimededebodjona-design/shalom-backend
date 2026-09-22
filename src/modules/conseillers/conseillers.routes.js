const { Router } = require('express');
const controller = require('./conseillers.controller');
const validator = require('./conseillers.validator');
const { authenticate } = require('../auth/auth.middleware');
const requireAdmin = require('../../middlewares/admin.middleware');

const router = Router();

// Annuaire interne — réservé aux administrateurs (pas de vue publique).
router.get('/', authenticate, requireAdmin, validator.listConseillersValidator, controller.listConseillers);
router.get('/:id', authenticate, requireAdmin, validator.conseillerIdValidator, controller.getConseiller);
router.post('/', authenticate, requireAdmin, validator.createConseillerValidator, controller.createConseiller);
router.put('/:id', authenticate, requireAdmin, validator.updateConseillerValidator, controller.updateConseiller);
router.patch('/:id', authenticate, requireAdmin, validator.updateConseillerValidator, controller.updateConseiller);
router.delete('/:id', authenticate, requireAdmin, validator.conseillerIdValidator, controller.deleteConseiller);

module.exports = router;
