/**
 * SQLite database layer for weekly digests.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR  = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'digest.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS digests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    week_start   TEXT NOT NULL,
    week_end     TEXT NOT NULL,
    digest_json  TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(company_name, week_start)
  );
`);

// ─── Public API ───────────────────────────────────────────────────────────────

function saveDigest(company_name, week_start, week_end, digest_json) {
  const json = typeof digest_json === 'string' ? digest_json : JSON.stringify(digest_json);
  db.prepare(`
    INSERT INTO digests (company_name, week_start, week_end, digest_json)
    VALUES (@company_name, @week_start, @week_end, @digest_json)
    ON CONFLICT(company_name, week_start) DO UPDATE SET
      week_end     = excluded.week_end,
      digest_json  = excluded.digest_json,
      generated_at = datetime('now')
  `).run({ company_name, week_start, week_end, digest_json: json });
}

function getDigest(company_name, week_start) {
  const row = db.prepare(
    'SELECT * FROM digests WHERE company_name = ? AND week_start = ?'
  ).get(company_name, week_start);
  if (!row) return null;
  try { row.digest_json = JSON.parse(row.digest_json); } catch (_) {}
  return row;
}

function getLatestDigest(company_name) {
  const row = db.prepare(
    'SELECT * FROM digests WHERE company_name = ? ORDER BY week_start DESC LIMIT 1'
  ).get(company_name);
  if (!row) return null;
  try { row.digest_json = JSON.parse(row.digest_json); } catch (_) {}
  return row;
}

module.exports = { saveDigest, getDigest, getLatestDigest };
