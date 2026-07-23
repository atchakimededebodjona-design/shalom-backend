// src/db/seed-bible.js
// Charge un texte biblique (domaine public / licence libre) dans les tables
// bible_versions / bible_books / bible_verses, depuis un fichier JSON
// { version, language, verses: [...], books?: [...] } de src/db/seed-data/.
// Idempotent (ON CONFLICT DO NOTHING) — peut être relancé sans dupliquer.
//
// Usage : node src/db/seed-bible.js [fichier] [code] [nom] [langue]
//   node src/db/seed-bible.js
//     -> seed par défaut : Louis Segond (LSG)
//   node src/db/seed-bible.js seed-data/bible-ewe.json EWE "Eʋegbe Biblia" ee
//     -> seed d'une version supplémentaire (les livres doivent déjà exister)

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const [, , fileArg, codeArg, nameArg, langArg] = process.argv;
const DATA_FILE = path.resolve(__dirname, fileArg || 'seed-data/bible-lsg.json');
const VERSION_CODE = (codeArg || 'LSG').toUpperCase();
const VERSION_NAME = nameArg || 'Louis Segond (1910)';
const VERSION_LANGUAGE = langArg || 'fr';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH_SIZE = 500;

const insertVersesBatch = async (client, versionId, bookIdByOrder, batch) => {
  const values = [];
  const params = [];
  batch.forEach((v, i) => {
    const base = i * 5;
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
    params.push(versionId, bookIdByOrder.get(v.book_order), v.chapter_number, v.verse_number, v.text);
  });
  await client.query(
    `INSERT INTO bible_verses (version_id, book_id, chapter_number, verse_number, text)
     VALUES ${values.join(',')}
     ON CONFLICT (version_id, book_id, chapter_number, verse_number) DO NOTHING`,
    params
  );
};

const main = async () => {
  const { books, verses, version } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`Chargement de la Bible ${version || VERSION_CODE} (${VERSION_CODE}) : ${verses.length} versets...`);

  const client = await pool.connect();
  try {
    const versionRes = await client.query(
      `INSERT INTO bible_versions (code, name, language)
       VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, language = EXCLUDED.language
       RETURNING id`,
      [VERSION_CODE, VERSION_NAME, VERSION_LANGUAGE]
    );
    const versionId = versionRes.rows[0].id;

    // bible_books est partagé entre versions (canon commun) : on ne crée les
    // lignes que si elles n'existent pas encore (DO NOTHING), pour ne jamais
    // écraser les noms canoniques déjà en place avec ceux d'une autre langue.
    if (Array.isArray(books) && books.length > 0) {
      for (const book of books) {
        await client.query(
          `INSERT INTO bible_books (testament, name, book_order, chapter_count)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (book_order) DO NOTHING`,
          [book.testament, book.name, book.book_order, book.chapter_count]
        );
      }
      console.log(`✅ Livres vérifiés/insérés.`);
    }

    const { rows: bookRows } = await client.query('SELECT id, book_order FROM bible_books');
    if (bookRows.length === 0) {
      throw new Error("bible_books est vide — seedez d'abord une version avec la liste des livres (ex: bible-lsg.json).");
    }
    const bookIdByOrder = new Map(bookRows.map((b) => [b.book_order, b.id]));

    for (let i = 0; i < verses.length; i += BATCH_SIZE) {
      const batch = verses.slice(i, i + BATCH_SIZE);
      await insertVersesBatch(client, versionId, bookIdByOrder, batch);
      process.stdout.write(`\r  versets : ${Math.min(i + BATCH_SIZE, verses.length)}/${verses.length}`);
    }
    console.log('\n✅ Versets insérés.');

    const { rows } = await client.query('SELECT COUNT(*) FROM bible_verses WHERE version_id = $1', [versionId]);
    console.log(`Total en base pour ${VERSION_CODE} : ${rows[0].count} versets.`);
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((err) => {
  console.error('❌ Erreur seed Bible :', err);
  process.exit(1);
});
