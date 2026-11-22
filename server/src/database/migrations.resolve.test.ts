import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { resolveMigrationsDir, runMigrations } from './migrations';

describe('SQL migration packaging', () => {
  it('resolves a migrations directory that contains .sql files', () => {
    const dir = resolveMigrationsDir();
    expect(fs.existsSync(dir)).toBe(true);
    const sql = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
    expect(sql).toEqual(expect.arrayContaining(['001_initial.sql', '002_devops.sql']));
  });

  it('creates repositories table on a fresh database without deleting other files', () => {
    const tmp = path.join(os.tmpdir(), `cf-migrate-${Date.now()}.db`);
    const db = new DatabaseSync(tmp);
    db.exec('PRAGMA foreign_keys = ON');
    try {
      runMigrations(db);
      const tables = (
        db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]
      ).map((r) => r.name);
      expect(tables).toEqual(expect.arrayContaining(['repositories', 'jobs', 'schema_migrations']));
      const count = db.prepare('SELECT COUNT(*) AS c FROM repositories').get() as { c: number };
      expect(count.c).toBe(0);
    } finally {
      db.close();
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });
});
