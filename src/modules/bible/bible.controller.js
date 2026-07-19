const service = require('./bible.service');
const { hasValidationErrors } = require('../../utils/validate');
const { AppError } = require('../../middlewares/error.middleware');

const listBooks = async (req, res, next) => {
  try {
    const books = await service.listBooks();
    return res.status(200).json({ success: true, data: { books } });
  } catch (error) {
    next(error);
  }
};

const getChapter = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const chapterNumber = parseInt(req.params.chapterNumber, 10);
    const result = await service.getChapter(req.params.bookId, chapterNumber);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const search = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const q = (req.query.q || '').trim();
    if (!q) {
      throw new AppError('Le paramètre de recherche q est requis', 400);
    }
    const results = await service.search(q);
    return res.status(200).json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
};

module.exports = { listBooks, getChapter, search };
