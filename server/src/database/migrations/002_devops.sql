-- DevOps plan metadata and approvals (no raw state/secrets)

CREATE TABLE IF NOT EXISTS terraform_plans (
  id              TEXT PRIMARY KEY,
  project_path    TEXT NOT NULL,
  workspace       TEXT NOT NULL DEFAULT 'default',
  plan_hash       TEXT NOT NULL,
  plan_file_path  TEXT NOT NULL,
  summary_json    TEXT,
  status          TEXT NOT NULL CHECK(status IN ('created','approved','applied','expired','rejected')),
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  approved_at     INTEGER,
  approved_by     TEXT,
  applied_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tf_plans_project ON terraform_plans(project_path);

CREATE TABLE IF NOT EXISTS devops_approvals (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  approved     INTEGER NOT NULL,
  approved_by  TEXT,
  notes        TEXT,
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS workflow_node_runs (
  id            TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  node_id       TEXT NOT NULL,
  node_kind     TEXT NOT NULL,
  status        TEXT NOT NULL,
  started_at    INTEGER,
  finished_at   INTEGER,
  log_excerpt   TEXT,
  result_json   TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_run ON workflow_node_runs(workflow_run_id);
