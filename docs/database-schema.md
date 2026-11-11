# Database Schema

SQLite file: `DATABASE_PATH` (default `./data/codigoflow.db`).

Migrations live in `server/src/database/migrations/` and are recorded in `schema_migrations`.

## Tables

- **repositories** — registered local Git repos (`id`, `name`, `path`, `remote_url`, `default_branch`, GitHub fields, timestamps)
- **jobs** — automation jobs (`status`: queued/running/succeeded/failed/cancelled)
- **job_logs** — sanitized per-job log lines
- **operation_history** — legacy/simple history entries
- **workflows** — React Flow definitions as `workflow_json`
- **workflow_runs** — future execution records

Foreign keys are enabled (`PRAGMA foreign_keys = ON`). WAL mode is used for local concurrency.
