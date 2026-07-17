// src/modules/groups/groups.routes.js
const { Router } = require('express');
const groupsController = require('./groups.controller');
const { authenticate } = require('../auth/auth.middleware');
const {
  createGroupSchema,
  updateGroupSchema,
  groupIdSchema,
  groupMemberIdSchema,
  updateRoleSchema,
  updateStatusSchema,
  directorySchema
} = require('./groups.validator');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/groups:
 *   post:
 *     summary: Créer un groupe
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [public, private, hidden]
 *     responses:
 *       201:
 *         description: Groupe créé
 */
router.post('/', createGroupSchema, groupsController.createGroup);

/**
 * @swagger
 * /api/v1/groups:
 *   get:
 *     summary: Lister les groupes
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des groupes
 */
router.get('/', groupsController.getGroups);

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   get:
 *     summary: Récupérer un groupe
 *     tags: [Groups]
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
 *         description: Détails du groupe
 */
/**
 * @swagger
 * /api/v1/groups/directory:
 *   get:
 *     summary: Annuaire des groupes / cellules de prière (filtrable par catégorie)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [cellule_priere, etude_biblique, jeunesse, autre]
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Groupes visibles dans l'annuaire (les groupes privés en sont exclus)
 */
// NB : déclarée AVANT /:id pour que le segment littéral /directory ait la priorité
router.get('/directory', directorySchema, groupsController.getDirectory);

/**
 * @swagger
 * /api/v1/groups/mine:
 *   get:
 *     summary: Groupes dont l'utilisateur est membre actif (avec son rôle)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mes groupes
 */
// NB : littérale, donc déclarée avant /:id
router.get('/mine', groupsController.getMyGroups);

router.get('/:id', groupIdSchema, groupsController.getGroupById);

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   patch:
 *     summary: Mettre à jour un groupe
 *     tags: [Groups]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Groupe mis à jour
 */
router.patch('/:id', updateGroupSchema, groupsController.updateGroup);

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   delete:
 *     summary: Supprimer un groupe
 *     tags: [Groups]
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
 *         description: Groupe supprimé
 */
router.delete('/:id', groupIdSchema, groupsController.deleteGroup);

/**
 * @swagger
 * /api/v1/groups/{id}/members:
 *   post:
 *     summary: Rejoindre un groupe
 *     tags: [Groups]
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
 *         description: Demande envoyée ou groupe rejoint
 */
router.post('/:id/members', groupIdSchema, groupsController.joinGroup);

/**
 * @swagger
 * /api/v1/groups/{id}/members:
 *   get:
 *     summary: Lister les membres
 *     tags: [Groups]
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
 *         description: Liste des membres
 */
router.get('/:id/members', groupIdSchema, groupsController.getMembers);

/**
 * @swagger
 * /api/v1/groups/{id}/members/{userId}:
 *   delete:
 *     summary: Quitter ou retirer un membre
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Membre retiré
 */
router.delete('/:id/members/:userId', groupMemberIdSchema, groupsController.removeMember);

/**
 * @swagger
 * /api/v1/groups/{id}/members/{userId}/role:
 *   patch:
 *     summary: Modifier le rôle d'un membre
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *     responses:
 *       200:
 *         description: Rôle modifié
 */
router.patch('/:id/members/:userId/role', updateRoleSchema, groupsController.updateMemberRole);

/**
 * @swagger
 * /api/v1/groups/{id}/members/{userId}/status:
 *   patch:
 *     summary: Modifier le statut d'un membre
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, banned]
 *     responses:
 *       200:
 *         description: Statut modifié
 */
router.patch('/:id/members/:userId/status', updateStatusSchema, groupsController.updateMemberStatus);

module.exports = router;
