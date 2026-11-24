-- 003: user accounts, server-side sessions, app settings, AI conversations

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name   TEXT,
  password_hash  TEXT NOT NULL,             -- scrypt$N$r$p$salt$hash
  role           TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  last_login_at  INTEGER
);

-- Server-side session registry: lets logout/expiry actually revoke a cookie.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,             -- the token jti
  user_id     TEXT,                         -- NULL for DEVOPS_API_TOKEN admin fallback
  role        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Backend-managed settings (never credentials; API keys stay in env).
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  title       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at);

-- Only the visible conversation is stored: prompts and answers, plus a short
-- label of which context was attached. Raw repository files/logs are not saved.
CREATE TABLE IF NOT EXISTS ai_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  provider         TEXT,
  model            TEXT,
  context_label    TEXT,
  error_code       TEXT,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, created_at);
