// src/db/seed-bible.js
// Charge le texte biblique Louis Segond 1910 (domaine public) dans les tables
// bible_books / bible_verses, depuis src/db/seed-data/bible-lsg.json.
// Idempotent (ON CONFLICT DO NOTHING) — peut être relancé sans dupliquer.
//
// Usage : node src/db/seed-bible.js

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const DATA_FILE = path.resolve(__dirname, 'seed-data/bible-lsg.json');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH_SIZE = 500;

const insertVersesBatch = async (client, bookIdByOrder, batch) => {
  const values = [];
  const params = [];
  batch.forEach((v, i) => {
    const base = i * 4;
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4})`);
    params.push(bookIdByOrder.get(v.book_order), v.chapter_number, v.verse_number, v.text);
  });
  await client.query(
    `INSERT INTO bible_verses (book_id, chapter_number, verse_number, text)
     VALUES ${values.join(',')}
     ON CONFLICT (book_id, chapter_number, verse_number) DO NOTHING`,
    params
  );
};

const main = async () => {
  const { books, verses, version } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`Chargement de la Bible ${version} : ${books.length} livres, ${verses.length} versets...`);

  const client = await pool.connect();
  try {
    const bookIdByOrder = new Map();

    for (const book of books) {
      const { rows } = await client.query(
        `INSERT INTO bible_books (testament, name, book_order, chapter_count)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (book_order) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [book.testament, book.name, book.book_order, book.chapter_count]
      );
      bookIdByOrder.set(book.book_order, rows[0].id);
    }
    console.log(`✅ ${books.length} livres insérés.`);

    for (let i = 0; i < verses.length; i += BATCH_SIZE) {
      const batch = verses.slice(i, i + BATCH_SIZE);
      await insertVersesBatch(client, bookIdByOrder, batch);
      process.stdout.write(`\r  versets : ${Math.min(i + BATCH_SIZE, verses.length)}/${verses.length}`);
    }
    console.log('\n✅ Versets insérés.');

    const { rows } = await client.query('SELECT COUNT(*) FROM bible_verses');
    console.log(`Total en base : ${rows[0].count} versets.`);
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((err) => {
  console.error('❌ Erreur seed Bible :', err);
  process.exit(1);
});
