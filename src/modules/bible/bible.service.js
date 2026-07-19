// src/modules/bible/bible.service.js
// Lecture seule du texte biblique (Louis Segond 1910) — contenu de référence,
// chargé une fois via src/db/seed-bible.js.

const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

const listBooks = async () => {
  const { rows } = await query(
    `SELECT id, testament, name, book_order, chapter_count
     FROM bible_books
     ORDER BY book_order ASC`
  );
  return rows;
};

const getChapter = async (bookId, chapterNumber) => {
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
     WHERE book_id = $1 AND chapter_number = $2
     ORDER BY verse_number ASC`,
    [bookId, chapterNumber]
  );

  return { book, chapter_number: chapterNumber, verses: versesResult.rows };
};

const search = async (queryText) => {
  const { rows } = await query(
    `SELECT v.chapter_number, v.verse_number, v.text,
            b.id AS book_id, b.name AS book_name
     FROM bible_verses v
     JOIN bible_books b ON b.id = v.book_id
     WHERE to_tsvector('french', v.text) @@ plainto_tsquery('french', $1)
     ORDER BY b.book_order ASC, v.chapter_number ASC, v.verse_number ASC
     LIMIT 50`,
    [queryText]
  );
  return rows;
};

module.exports = { listBooks, getChapter, search };
