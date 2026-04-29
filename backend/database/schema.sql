CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  name                TEXT NOT NULL,
  reset_token         TEXT,
  reset_token_expiry  INTEGER,
  created_at          INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS incidents (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_ref          TEXT UNIQUE NOT NULL,
  title                 TEXT NOT NULL,
  summary               TEXT NOT NULL,
  category              TEXT NOT NULL,
  severity              TEXT NOT NULL,
  status                TEXT DEFAULT 'New',
  primary_department    TEXT NOT NULL,
  root_cause_suggestion TEXT,
  llm_confidence        REAL,
  is_duplicate          INTEGER DEFAULT 0,
  duplicate_reason      TEXT,
  sla_hours             INTEGER NOT NULL,
  sla_deadline          INTEGER,
  is_overdue            INTEGER DEFAULT 0,
  created_at            INTEGER DEFAULT (unixepoch()),
  updated_at            INTEGER DEFAULT (unixepoch()),
  resolved_at           INTEGER,
  closed_at             INTEGER
);

CREATE TABLE IF NOT EXISTS raw_inputs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  filename            TEXT,
  file_path           TEXT,
  source_type         TEXT NOT NULL,
  content_type        TEXT,
  raw_text            TEXT,
  ocr_confidence      REAL,
  processing_status   TEXT DEFAULT 'pending',
  incident_id         INTEGER,
  error_message       TEXT,
  uploaded_at         INTEGER DEFAULT (unixepoch()),
  processed_at        INTEGER,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS department_tasks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id      INTEGER NOT NULL,
  department       TEXT NOT NULL,
  role             TEXT NOT NULL,
  task_description TEXT NOT NULL,
  task_status      TEXT DEFAULT 'Not Started',
  assigned_at      INTEGER DEFAULT (unixepoch()),
  updated_at       INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS audit_trail (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id    INTEGER NOT NULL,
  actor          TEXT NOT NULL,
  action         TEXT NOT NULL,
  previous_value TEXT,
  new_value      TEXT,
  notes          TEXT,
  created_at     INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);
