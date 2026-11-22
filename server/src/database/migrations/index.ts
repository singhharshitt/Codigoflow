import fs from 'fs';
import path from 'path';
import type { DatabaseSync } from 'node:sqlite';
import { logger } from '../../utils/logger';

interface Migration {
  id: string;
  sql: string;
}

/**
 * Resolve the directory that contains *.sql migration files.
 *
 * Dev (tsx):   __dirname === server/src/database/migrations
 * Prod (tsc):  __dirname === server/dist/database/migrations
 *
 * `tsc` does not copy .sql assets, so production builds must either
 * copy them into dist (see package.json build) or fall back to src/.
 */
export function resolveMigrationsDir(): string {
  const candidates = [
    path.join(__dirname),
    path.join(__dirname, '..', '..', '..', 'src', 'database', 'migrations'),
    path.join(process.cwd(), 'src', 'database', 'migrations'),
    path.join(process.cwd(), 'dist', 'database', 'migrations'),
    path.join(process.cwd(), 'server', 'src', 'database', 'migrations'),
    path.join(process.cwd(), 'server', 'dist', 'database', 'migrations'),
  ];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) continue;
      const sqlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
      if (sqlFiles.length > 0) return path.resolve(dir);
    } catch {
      /* try next */
    }
  }

  throw new Error(
    'No SQL migration files found. Ensure *.sql files exist under src/database/migrations ' +
      '(and are copied to dist/database/migrations for production starts).',
  );
}

function loadSqlMigrations(): Migration[] {
  const dir = resolveMigrationsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(`Migration directory is empty: ${dir}`);
  }

  logger.debug({ migrationsDir: dir, files }, 'Loading SQL migrations');

  return files.map((file) => ({
    id: file.replace(/\.sql$/, ''),
    sql: fs.readFileSync(path.join(dir, file), 'utf8'),
  }));
}

/** Ensure migration bookkeeping exists, then apply pending SQL migrations. */
export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map(
      (r) => r.id,
    ),
  );

  const migrations = loadSqlMigrations();
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(migration.id);
      db.exec('COMMIT');
      logger.info({ migration: migration.id }, 'Applied database migration');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  // Additive upgrades for DBs created before migrations existed
  ensureColumn(db, 'repositories', 'default_branch', 'TEXT');
  ensureColumn(db, 'jobs', 'type', 'TEXT');
  ensureColumn(db, 'jobs', 'duration_ms', 'INTEGER');
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  typeSql: string,
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
    logger.info({ table, column }, 'Added missing column');
  }
}
