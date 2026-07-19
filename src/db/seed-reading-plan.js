// src/db/seed-reading-plan.js
// Crée (ou met à jour) le plan public « La Bible en un an » : répartit les
// 1189 chapitres de la Bible (module bible) sur 365 jours, dans l'ordre
// canonique, sans trou ni chevauchement. Idempotent — peut être relancé.
//
// Usage : node src/db/seed-reading-plan.js

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PLAN_TITLE = 'La Bible en un an';
const TOTAL_DAYS = 365;

// Fusionne les chapitres consécutifs d'un même livre en segments lisibles,
// ex: [{Genèse,48},{Genèse,49},{Genèse,50},{Exode,1}] → "Genèse 48-50; Exode 1".
const formatPassages = (entries) => {
  const segments = [];
  let cur = null;
  for (const e of entries) {
    if (cur && cur.book_name === e.book_name && e.chapter_number === cur.end + 1) {
      cur.end = e.chapter_number;
    } else {
      if (cur) segments.push(cur);
      cur = { book_name: e.book_name, start: e.chapter_number, end: e.chapter_number };
    }
  }
  if (cur) segments.push(cur);
  return segments
    .map((s) => (s.start === s.end ? `${s.book_name} ${s.start}` : `${s.book_name} ${s.start}-${s.end}`))
    .join('; ');
};

const main = async () => {
  const client = await pool.connect();
  try {
    const booksRes = await client.query(
      'SELECT id, name, chapter_count FROM bible_books ORDER BY book_order ASC'
    );
    if (booksRes.rows.length === 0) {
      throw new Error("bible_books est vide — lancez d'abord node src/db/seed-bible.js");
    }

    // Liste à plat de tous les chapitres, dans l'ordre canonique.
    const flat = [];
    for (const book of booksRes.rows) {
      for (let ch = 1; ch <= book.chapter_count; ch++) {
        flat.push({ book_id: book.id, book_name: book.name, chapter_number: ch });
      }
    }
    const totalChapters = flat.length;
    console.log(`Livres : ${booksRes.rows.length}, chapitres : ${totalChapters}`);

    // Bornes cumulatives : jour i couvre flat[boundaries[i] .. boundaries[i+1]).
    const boundaries = Array.from({ length: TOTAL_DAYS + 1 }, (_, i) =>
      Math.round((i * totalChapters) / TOTAL_DAYS)
    );

    let planRes = await client.query('SELECT id FROM bible_reading_plans WHERE title = $1', [PLAN_TITLE]);
    let planId = planRes.rows[0]?.id;
    if (!planId) {
      const inserted = await client.query(
        `INSERT INTO bible_reading_plans (title, description, duration_type, total_days, is_public, created_by)
         VALUES ($1, $2, 'annual', $3, true, NULL)
         RETURNING id`,
        [PLAN_TITLE, 'Lisez toute la Bible en 365 jours, dans l\'ordre canonique.', TOTAL_DAYS]
      );
      planId = inserted.rows[0].id;
      console.log('Plan créé :', planId);
    } else {
      console.log('Plan existant réutilisé :', planId);
    }

    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const entries = flat.slice(boundaries[day - 1], boundaries[day]);
      const passages = formatPassages(entries);
      const first = entries[0];
      await client.query(
        `INSERT INTO bible_reading_plan_days (plan_id, day_number, passages, start_book_id, start_chapter)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (plan_id, day_number)
         DO UPDATE SET passages = EXCLUDED.passages, start_book_id = EXCLUDED.start_book_id, start_chapter = EXCLUDED.start_chapter`,
        [planId, day, passages, first.book_id, first.chapter_number]
      );
    }
    console.log(`✅ ${TOTAL_DAYS} jours écrits pour le plan « ${PLAN_TITLE} ».`);
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((err) => {
  console.error('❌ Erreur seed plan de lecture :', err);
  process.exit(1);
});
