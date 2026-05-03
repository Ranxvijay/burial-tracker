import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/tracker.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS techs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    uploaded_at TEXT DEFAULT (datetime('now')),
    job_count INTEGER DEFAULT 0,
    date_range_start TEXT,
    date_range_end TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tech_id TEXT NOT NULL,
    address TEXT NOT NULL,
    job_date TEXT NOT NULL,
    upload_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tech_id) REFERENCES techs(id),
    FOREIGN KEY (upload_id) REFERENCES uploads(id)
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_tech_id ON jobs(tech_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_job_date ON jobs(job_date);
  CREATE INDEX IF NOT EXISTS idx_jobs_upload_id ON jobs(upload_id);
`);

export default db;
