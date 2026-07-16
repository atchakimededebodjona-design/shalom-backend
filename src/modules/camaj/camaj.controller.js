// src/modules/camaj/camaj.controller.js
// Contrôleur du module camaj — réception des demandes des formulaires publics.

const { hasValidationErrors } = require('../../utils/validate');
const camajService = require('./camaj.service');

/**
 * POST /api/v1/camaj/submissions  (public)
 * Enregistre une demande issue d'un formulaire CAMAJ.
 * Corps attendu : { type, data }  où `data` est l'état complet du formulaire.
 */
const creerSubmission = async (req, res) => {
  if (hasValidationErrors(req, res)) return;

  try {
    const { type, data } = req.body;

    const nom = String(data.nom ?? data.prenom ?? '').trim() || null;
    const email = String(data.email ?? '').trim() || null;
    const indicatif = String(data.indicatif ?? '').trim();
    const numero = String(data.whatsapp ?? '').trim();
    const whatsapp = numero ? `${indicatif} ${numero}`.trim() : null;

    const submission = await camajService.creerSubmission({ type, nom, email, whatsapp, payload: data });

    return res.status(201).json({
      success: true,
      message: 'Votre demande a bien été enregistrée.',
      data: { id: submission.id },
    });
  } catch (err) {
    console.error('creerSubmission error:', err);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de l'envoi de la demande",
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * GET /api/v1/camaj/submissions  (admin)
 * Liste paginée des demandes, filtrable par ?type= et ?status=.
 */
const listerSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const data = await camajService.listerSubmissions({
      type: req.query.type || null,
      status: req.query.status || null,
      page,
      limit,
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('listerSubmissions error:', err);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des demandes',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * PATCH /api/v1/camaj/submissions/:id  (admin)
 * Change le statut d'une demande : nouveau | traite | archive.
 */
const changerStatut = async (req, res) => {
  if (hasValidationErrors(req, res)) return;

  try {
    const submission = await camajService.changerStatut({
      id: req.params.id,
      status: req.body.status,
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Demande introuvable',
        code: 'NOT_FOUND',
      });
    }

    return res.json({
      success: true,
      message: 'Statut mis à jour.',
      data: submission,
    });
  } catch (err) {
    console.error('changerStatut error:', err);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du statut',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * GET /api/v1/camaj/submissions/stats  (admin)
 * Compteurs par statut et par type pour le tableau de bord.
 */
const statsSubmissions = async (req, res) => {
  try {
    const data = await camajService.statsSubmissions();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('statsSubmissions error:', err);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors du calcul des statistiques',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = { creerSubmission, listerSubmissions, changerStatut, statsSubmissions };
