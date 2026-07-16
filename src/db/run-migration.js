// src/db/run-migration.js
// Runner de migrations SQL pour SHALOM.
//
// Joue les migrations du dossier ./migrations dans l'ordre alphabétique et
// mémorise celles déjà appliquées dans la table `schema_migrations`, afin de ne
// jamais rejouer une migration (les fichiers existants ne sont pas idempotents).
//
// Usage :
//   node src/db/run-migration.js              # applique toutes les migrations en attente
//   node src/db/run-migration.js <fichier.sql># applique une migration précise
//   node src/db/run-migration.js --status     # liste appliquées / en attente (lecture seule)
//   node src/db/run-migration.js --baseline   # marque TOUTES les migrations comme appliquées
//                                             #   SANS les exécuter (réconcilie une base déjà en place)
//   node src/db/run-migration.js --force <f>  # rejoue un fichier même s'il est déjà marqué appliqué

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Helpers ---------------------------------------------------------------

const listMigrationFiles = () =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // ordre lexicographique : 000_ < 001_ < 002_ < 003_ ...

const tableExists = async () => {
  const { rows } = await pool.query("SELECT to_regclass('public.schema_migrations') AS t");
  return rows[0].t !== null;
};

const ensureTable = () =>
  pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

const getApplied = async () => {
  if (!(await tableExists())) return new Set();
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
};

// Exécute un fichier dans une transaction, puis l'enregistre.
const applyFile = async (file) => {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [file]
    );
    await client.query('COMMIT');
    console.log(`  ✅ ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Échec sur ${file} : ${err.message}`);
  } finally {
    client.release();
  }
};

// --- Commandes -------------------------------------------------------------

const cmdStatus = async () => {
  const files = listMigrationFiles();
  const applied = await getApplied();
  console.log('Migrations :');
  files.forEach((f) => console.log(`  ${applied.has(f) ? '✅ appliquée ' : '⏳ en attente'}  ${f}`));
  const pending = files.filter((f) => !applied.has(f));
  console.log(`\n${applied.size} appliquée(s), ${pending.length} en attente.`);
  if (!(await tableExists())) {
    console.log("⚠️  Table `schema_migrations` absente : lance --baseline si la base est déjà en place.");
  }
};

const cmdBaseline = async () => {
  await ensureTable();
  const files = listMigrationFiles();
  for (const f of files) {
    await pool.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [f]
    );
  }
  console.log(`Baseline : ${files.length} migration(s) marquée(s) comme appliquée(s) (sans exécution).`);
};

const cmdRunPending = async () => {
  await ensureTable();
  const applied = await getApplied();
  const pending = listMigrationFiles().filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('Aucune migration en attente. Base à jour.');
    return;
  }
  console.log(`${pending.length} migration(s) à appliquer :`);
  for (const f of pending) await applyFile(f);
  console.log('Terminé.');
};

const cmdRunOne = async (file, force) => {
  if (!fs.existsSync(path.join(MIGRATIONS_DIR, file))) {
    throw new Error(`Fichier introuvable : migrations/${file}`);
  }
  await ensureTable();
  const applied = await getApplied();
  if (applied.has(file) && !force) {
    console.log(`Déjà appliquée : ${file} (utilise --force pour rejouer).`);
    return;
  }
  await applyFile(file);
  console.log('Terminé.');
};

// --- Point d'entrée --------------------------------------------------------

(async () => {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--status')) {
      await cmdStatus();
    } else if (args.includes('--baseline')) {
      await cmdBaseline();
    } else {
      const force = args.includes('--force');
      const file = args.find((a) => !a.startsWith('--'));
      if (file) await cmdRunOne(file, force);
      else await cmdRunPending();
    }
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
