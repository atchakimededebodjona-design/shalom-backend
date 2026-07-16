// src/modules/camaj/camaj.validator.js
// Validation des demandes issues des formulaires CAMAJ.
// Validation volontairement légère : les règles détaillées sont appliquées côté
// frontend. On garantit ici le minimum (type valide, un nom, un moyen de contact)
// pour éviter les envois vides. Le reste du formulaire est stocké tel quel.

const { body, param } = require('express-validator');

const TYPES = ['mentor', 'programme', 'mentorat', 'faj', 'don', 'relation_aide'];
const STATUSES = ['nouveau', 'traite', 'archive'];

const createSubmissionValidator = [
  body('type').isIn(TYPES).withMessage('Type de demande invalide'),
  body('data').isObject().withMessage('Données du formulaire manquantes'),
  body('data').custom((data) => {
    const nom = String(data?.nom ?? data?.prenom ?? '').trim();
    if (!nom) throw new Error('Le nom est requis');
    const contact = String(data?.whatsapp ?? data?.email ?? '').trim();
    if (!contact) throw new Error('Un moyen de contact (WhatsApp ou e-mail) est requis');
    return true;
  }),
];

// Mise à jour du statut d'une demande (admin).
const updateStatusValidator = [
  param('id').isUUID().withMessage('Identifiant de demande invalide'),
  body('status').isIn(STATUSES).withMessage('Statut invalide'),
];

module.exports = { createSubmissionValidator, updateStatusValidator, TYPES, STATUSES };
