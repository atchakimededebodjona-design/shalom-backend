// src/modules/bible/bible.service.js
// Lecture seule du texte biblique — plusieurs versions/traductions possibles
// (bible_versions), chargées via src/db/seed-bible.js.

const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

const DEFAULT_VERSION_CODE = 'LSG';

const resolveVersionId = async (code) => {
  const { rows } = await query('SELECT id FROM bible_versions WHERE code = $1', [
    (code || DEFAULT_VERSION_CODE).toUpperCase(),
  ]);
  if (!rows[0]) {
    throw new AppError('Version biblique introuvable', 404, 'BIBLE_VERSION_NOT_FOUND');
  }
  return rows[0].id;
};

const listVersions = async () => {
  const { rows } = await query(
    `SELECT id, code, name, language, is_default
     FROM bible_versions
     ORDER BY is_default DESC, name ASC`
  );
  return rows;
};

const listBooks = async () => {
  const { rows } = await query(
    `SELECT id, testament, name, book_order, chapter_count
     FROM bible_books
     ORDER BY book_order ASC`
  );
  return rows;
};

const getChapter = async (bookId, chapterNumber, versionCode) => {
  const versionId = await resolveVersionId(versionCode);

  const bookResult = await query(
    'SELECT id, testament, name, book_order, chapter_count FROM bible_books WHERE id = $1',
    [bookId]
  );
  const book = bookResult.rows[0];
  if (!book) {
    throw new AppError('Livre introuvable', 404, 'BIBLE_BOOK_NOT_FOUND');
  }
  if (chapterNumber < 1 || chapterNumber > book.chapter_count) {
    throw new AppError('Chapitre introuvable', 404, 'BIBLE_CHAPTER_NOT_FOUND');
  }

  const versesResult = await query(
    `SELECT verse_number, text
     FROM bible_verses
     WHERE book_id = $1 AND chapter_number = $2 AND version_id = $3
     ORDER BY verse_number ASC`,
    [bookId, chapterNumber, versionId]
  );

  return { book, chapter_number: chapterNumber, verses: versesResult.rows };
};

const search = async (queryText, versionCode) => {
  const versionId = await resolveVersionId(versionCode);
  const { rows } = await query(
    `SELECT v.chapter_number, v.verse_number, v.text,
            b.id AS book_id, b.name AS book_name
     FROM bible_verses v
     JOIN bible_books b ON b.id = v.book_id
     WHERE v.version_id = $2 AND to_tsvector('simple', v.text) @@ plainto_tsquery('simple', $1)
     ORDER BY b.book_order ASC, v.chapter_number ASC, v.verse_number ASC
     LIMIT 50`,
    [queryText, versionId]
  );
  return rows;
};

module.exports = { listVersions, listBooks, getChapter, search };
