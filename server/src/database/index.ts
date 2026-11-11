// node:sqlite is built into Node.js 22.5+
// Requires the --experimental-sqlite flag (set via NODE_OPTIONS in package.json scripts)
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  const dbPath = path.resolve(config.DATABASE_PATH);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info({ dbDir }, 'Created database directory');
  }

  db = new DatabaseSync(dbPath);

  // WAL mode and foreign keys via exec
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  applySchema(db);
  logger.info({ dbPath }, 'Database initialized');
}

function applySchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      path        TEXT NOT NULL UNIQUE,
      description TEXT,
      remote_url  TEXT,
      github_owner TEXT,
      github_repo  TEXT,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id            TEXT PRIMARY KEY,
      operation     TEXT NOT NULL,
      repo_id       TEXT REFERENCES repositories(id) ON DELETE SET NULL,
      status        TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
      summary       TEXT,
      log_ref       TEXT,
      error_message TEXT,
      started_at    INTEGER,
      finished_at   INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_repo_id    ON jobs(repo_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

    CREATE TABLE IF NOT EXISTS operation_history (
      id          TEXT PRIMARY KEY,
      repo_id     TEXT REFERENCES repositories(id) ON DELETE SET NULL,
      operation   TEXT NOT NULL,
      details     TEXT,
      success     INTEGER NOT NULL DEFAULT 1,
      error       TEXT,
      executed_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_history_repo_id     ON operation_history(repo_id);
    CREATE INDEX IF NOT EXISTS idx_history_executed_at ON operation_history(executed_at DESC);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}
