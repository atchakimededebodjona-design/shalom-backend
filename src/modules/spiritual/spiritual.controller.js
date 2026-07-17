// src/modules/spiritual/spiritual.controller.js
// Contrôleur du module Outils Spirituels.

const service = require('./spiritual.service');
const { hasValidationErrors } = require('../../utils/validate');
const { getPagination, formatPagination } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');

// =========================================================================
//  Plans de lecture
// =========================================================================

const listPlans = async (req, res, next) => {
  try {
    const plans = await service.listPlans(req.user.id);
    return res.status(200).json({ success: true, data: { plans } });
  } catch (error) { next(error); }
};

const createPlan = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const plan = await service.createPlan(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Plan créé', data: { plan } });
  } catch (error) { next(error); }
};

const getPlan = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const plan = await service.getPlanById(req.params.id, req.user.id);
    if (!plan) throw new AppError('Plan introuvable', 404, 'PLAN_NOT_FOUND');
    return res.status(200).json({ success: true, data: { plan } });
  } catch (error) { next(error); }
};

const addPlanDay = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const day = await service.addPlanDay(req.params.id, req.user.id, req.body);
    if (!day) throw new AppError("Plan introuvable ou vous n'en êtes pas le créateur", 403, 'FORBIDDEN');
    return res.status(201).json({ success: true, message: 'Jour enregistré', data: { day } });
  } catch (error) { next(error); }
};

const startPlan = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const progress = await service.startPlan(req.user.id, req.params.id);
    if (!progress) throw new AppError('Plan introuvable', 404, 'PLAN_NOT_FOUND');
    return res.status(201).json({ success: true, message: 'Plan démarré', data: { progress } });
  } catch (error) { next(error); }
};

const listProgress = async (req, res, next) => {
  try {
    const progress = await service.listProgress(req.user.id);
    return res.status(200).json({ success: true, data: { progress } });
  } catch (error) { next(error); }
};

const completeDay = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const result = await service.completeDay(req.user.id, req.params.id, req.body.day_number);
    if (!result) throw new AppError('Plan introuvable ou non démarré', 404, 'PROGRESS_NOT_FOUND');
    return res.status(200).json({
      success: true,
      message: result.already_completed ? 'Jour déjà validé' : 'Jour validé',
      data: { progress: result.progress, already_completed: result.already_completed },
    });
  } catch (error) { next(error); }
};

const listLogs = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const logs = await service.listLogs(req.user.id, req.params.id);
    return res.status(200).json({ success: true, data: { logs } });
  } catch (error) { next(error); }
};

const updateProgress = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const progress = await service.updateProgressStatus(req.user.id, req.params.id, req.body.status);
    if (!progress) throw new AppError('Progression introuvable', 404, 'PROGRESS_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Progression mise à jour', data: { progress } });
  } catch (error) { next(error); }
};

// =========================================================================
//  Carnet de prière
// =========================================================================

const createPrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const prayer = await service.createPrayer(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Sujet de prière ajouté', data: { prayer } });
  } catch (error) { next(error); }
};

const listPrayers = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { prayers, total } = await service.listPrayers(req.user.id, {
      status: req.query.status || null,
      category: req.query.category || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { prayers, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const getPrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const prayer = await service.getPrayerById(req.params.id, req.user.id);
    if (!prayer) throw new AppError('Sujet de prière introuvable', 404, 'PRAYER_NOT_FOUND');
    return res.status(200).json({ success: true, data: { prayer } });
  } catch (error) { next(error); }
};

const updatePrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const prayer = await service.updatePrayer(req.params.id, req.user.id, req.body);
    if (!prayer) throw new AppError('Sujet de prière introuvable', 404, 'PRAYER_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Sujet de prière mis à jour', data: { prayer } });
  } catch (error) { next(error); }
};

const deletePrayer = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeletePrayer(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Sujet de prière introuvable', 404, 'PRAYER_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Sujet de prière supprimé', data: {} });
  } catch (error) { next(error); }
};

// =========================================================================
//  Versets
// =========================================================================

const createVerse = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const verse = await service.createVerse(req.body);
    return res.status(201).json({ success: true, message: 'Verset ajouté', data: { verse } });
  } catch (error) { next(error); }
};

const getVerseOfTheDay = async (req, res, next) => {
  try {
    const verse = await service.getVerseOfTheDay(req.user.id);
    if (!verse) throw new AppError('Aucun verset disponible', 404, 'NO_VERSE_AVAILABLE');
    return res.status(200).json({ success: true, data: { verse } });
  } catch (error) { next(error); }
};

const setVerseFavorite = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const interaction = await service.setVerseFavorite(req.user.id, req.params.id, req.body.is_favorite);
    if (!interaction) throw new AppError('Verset introuvable', 404, 'VERSE_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Favori mis à jour', data: { interaction } });
  } catch (error) { next(error); }
};

const listFavoriteVerses = async (req, res, next) => {
  try {
    const verses = await service.listFavoriteVerses(req.user.id);
    return res.status(200).json({ success: true, data: { verses } });
  } catch (error) { next(error); }
};

// =========================================================================
//  Journal spirituel
// =========================================================================

const createEntry = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const entry = await service.createEntry(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Entrée ajoutée', data: { entry } });
  } catch (error) { next(error); }
};

const listEntries = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { page, limit, offset } = getPagination(req.query);
    const { entries, total } = await service.listEntries(req.user.id, {
      entry_type: req.query.entry_type || null,
      from: req.query.from || null,
      to: req.query.to || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { entries, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const getEntry = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const entry = await service.getEntryById(req.params.id, req.user.id);
    if (!entry) throw new AppError('Entrée introuvable', 404, 'ENTRY_NOT_FOUND');
    return res.status(200).json({ success: true, data: { entry } });
  } catch (error) { next(error); }
};

const updateEntry = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const entry = await service.updateEntry(req.params.id, req.user.id, req.body);
    if (!entry) throw new AppError('Entrée introuvable', 404, 'ENTRY_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Entrée mise à jour', data: { entry } });
  } catch (error) { next(error); }
};

const deleteEntry = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeleteEntry(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Entrée introuvable', 404, 'ENTRY_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Entrée supprimée', data: {} });
  } catch (error) { next(error); }
};

// =========================================================================
//  Louange
// =========================================================================

const createSong = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const song = await service.createSong(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Chant ajouté', data: { song } });
  } catch (error) { next(error); }
};

const listSongs = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { songs, total } = await service.listSongs(req.user.id, {
      q: req.query.q || null,
      category: req.query.category || null,
      limit, offset,
    });
    return res.status(200).json({
      success: true,
      data: { songs, pagination: formatPagination(page, limit, total) },
    });
  } catch (error) { next(error); }
};

const getSong = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const song = await service.getSongById(req.params.id, req.user.id);
    if (!song) throw new AppError('Chant introuvable', 404, 'SONG_NOT_FOUND');
    return res.status(200).json({ success: true, data: { song } });
  } catch (error) { next(error); }
};

const createPlaylist = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const playlist = await service.createPlaylist(req.user.id, req.body);
    return res.status(201).json({ success: true, message: 'Playlist créée', data: { playlist } });
  } catch (error) { next(error); }
};

const listPlaylists = async (req, res, next) => {
  try {
    const playlists = await service.listPlaylists(req.user.id);
    return res.status(200).json({ success: true, data: { playlists } });
  } catch (error) { next(error); }
};

const getPlaylist = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const playlist = await service.getPlaylistById(req.params.id, req.user.id);
    if (!playlist) throw new AppError('Playlist introuvable', 404, 'PLAYLIST_NOT_FOUND');
    return res.status(200).json({ success: true, data: { playlist } });
  } catch (error) { next(error); }
};

const updatePlaylist = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const playlist = await service.updatePlaylist(req.params.id, req.user.id, req.body);
    if (!playlist) throw new AppError('Playlist introuvable', 404, 'PLAYLIST_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Playlist mise à jour', data: { playlist } });
  } catch (error) { next(error); }
};

const deletePlaylist = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const deleted = await service.softDeletePlaylist(req.params.id, req.user.id);
    if (!deleted) throw new AppError('Playlist introuvable', 404, 'PLAYLIST_NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Playlist supprimée', data: {} });
  } catch (error) { next(error); }
};

const addSongToPlaylist = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const item = await service.addSongToPlaylist(req.params.id, req.user.id, req.body);
    if (!item) throw new AppError("Playlist introuvable ou vous n'en êtes pas le propriétaire", 404, 'PLAYLIST_NOT_FOUND');
    return res.status(201).json({ success: true, message: 'Chant ajouté à la playlist', data: { item } });
  } catch (error) { next(error); }
};

const removeSongFromPlaylist = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const removed = await service.removeSongFromPlaylist(req.params.id, req.user.id, req.params.songId);
    if (!removed) throw new AppError('Chant ou playlist introuvable', 404, 'NOT_FOUND');
    return res.status(200).json({ success: true, message: 'Chant retiré de la playlist', data: {} });
  } catch (error) { next(error); }
};

module.exports = {
  listPlans, createPlan, getPlan, addPlanDay,
  startPlan, listProgress, completeDay, listLogs, updateProgress,
  createPrayer, listPrayers, getPrayer, updatePrayer, deletePrayer,
  createVerse, getVerseOfTheDay, setVerseFavorite, listFavoriteVerses,
  createEntry, listEntries, getEntry, updateEntry, deleteEntry,
  createSong, listSongs, getSong,
  createPlaylist, listPlaylists, getPlaylist, updatePlaylist, deletePlaylist,
  addSongToPlaylist, removeSongFromPlaylist,
};
