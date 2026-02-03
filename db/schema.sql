-- ProteinT-OS starter schema (for Postgres)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_zh TEXT,
  role TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  tier TEXT NOT NULL,
  department TEXT,
  status TEXT,
  milestone TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_updates (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  owner TEXT NOT NULL,
  tier TEXT NOT NULL,
  current_milestone TEXT NOT NULL,
  progress TEXT NOT NULL,
  evidence_link TEXT NOT NULL,
  next_milestone TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  blockers TEXT,
  decision_needed TEXT,
  decision_summary TEXT,
  cost TEXT,
  expected_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_memos (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  context TEXT NOT NULL,
  decisions TEXT,
  actions TEXT,
  risks TEXT,
  follow_ups TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  project TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_link TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  owner TEXT,
  summary TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  actor TEXT,
  project TEXT,
  target TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
