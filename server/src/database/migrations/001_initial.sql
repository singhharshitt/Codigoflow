-- CódigoFlow initial schema

CREATE TABLE IF NOT EXISTS repositories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  path         TEXT NOT NULL UNIQUE,
  description  TEXT,
  remote_url   TEXT,
  default_branch TEXT,
  github_owner TEXT,
  github_repo  TEXT,
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id            TEXT PRIMARY KEY,
  operation     TEXT NOT NULL,
  type          TEXT,
  repo_id       TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  status        TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
  summary       TEXT,
  log_ref       TEXT,
  error_message TEXT,
  started_at    INTEGER,
  finished_at   INTEGER,
  duration_ms   INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_repo_id ON jobs(repo_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS job_logs (
  id         TEXT PRIMARY KEY,
  job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  timestamp  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  level      TEXT NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id);

CREATE TABLE IF NOT EXISTS operation_history (
  id          TEXT PRIMARY KEY,
  repo_id     TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  operation   TEXT NOT NULL,
  details     TEXT,
  success     INTEGER NOT NULL DEFAULT 1,
  error       TEXT,
  executed_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_history_repo_id ON operation_history(repo_id);
CREATE INDEX IF NOT EXISTS idx_history_executed_at ON operation_history(executed_at DESC);

CREATE TABLE IF NOT EXISTS workflows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  workflow_json  TEXT NOT NULL,
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at     INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id           TEXT PRIMARY KEY,
  workflow_id  TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
  started_at   INTEGER,
  completed_at INTEGER,
  result       TEXT,
  error_message TEXT,
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id         TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
