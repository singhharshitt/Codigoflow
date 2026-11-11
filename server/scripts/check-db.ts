import { initDatabase, closeDatabase, getDb } from '../src/database';

initDatabase();
const db = getDb();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log('tables', tables);
const mig = db.prepare('SELECT id FROM schema_migrations').all();
console.log('migrations', mig);
closeDatabase();
