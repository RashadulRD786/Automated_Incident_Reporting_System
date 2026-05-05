const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/dhl_incidents.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migrations — add new columns to existing tables safely
const migrations = [
  // incidents
  "ALTER TABLE incidents ADD COLUMN root_cause_hypothesis TEXT",
  "ALTER TABLE incidents ADD COLUMN root_cause_evidence TEXT",
  "ALTER TABLE incidents ADD COLUMN root_cause_confidence REAL",
  "ALTER TABLE incidents ADD COLUMN sentiment_score TEXT",
  "ALTER TABLE incidents ADD COLUMN processed_via_fallback INTEGER DEFAULT 0",
  "ALTER TABLE incidents ADD COLUMN sla_state TEXT DEFAULT 'ON_TRACK'",
  "ALTER TABLE incidents ADD COLUMN first_response_at INTEGER",
  // raw_inputs
  "ALTER TABLE raw_inputs ADD COLUMN detected_language TEXT",
  "ALTER TABLE raw_inputs ADD COLUMN missing_fields TEXT",
  "ALTER TABLE raw_inputs ADD COLUMN queue_item_id TEXT",
  // department_tasks
  "ALTER TABLE department_tasks ADD COLUMN problem_statement TEXT",
  "ALTER TABLE department_tasks ADD COLUMN action_required TEXT",
  "ALTER TABLE department_tasks ADD COLUMN expected_output TEXT",
];

for (const sql of migrations) {
  try { db.prepare(sql).run(); } catch { /* column already exists */ }
}

module.exports = db;
