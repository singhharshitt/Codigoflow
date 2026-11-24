import { getDb } from '../database';
import { asRow } from '../utils/dbCast';

/**
 * Backend-managed application settings (SQLite `app_settings`).
 * Never store credentials here: API keys and tokens stay in server env.
 */
export function getSetting<T>(key: string, fallback: T): T {
  try {
    const row = asRow<{ value: string } | undefined>(
      getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key),
    );
    if (!row) return fallback;
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value));
}
