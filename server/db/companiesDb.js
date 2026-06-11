/**
 * SQLite database layer for Companies management.
 * Central registry of tracked competitor companies.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR  = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'companies.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT UNIQUE NOT NULL,
    meta_search_terms TEXT,
    youtube_channel_id TEXT,
    youtube_handle    TEXT,
    instagram_handle  TEXT,
    active            INTEGER DEFAULT 1,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed data ────────────────────────────────────────────────────────────────

const count = db.prepare('SELECT COUNT(*) as c FROM companies').get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO companies (name, meta_search_terms, youtube_channel_id, youtube_handle, instagram_handle)
    VALUES (@name, @meta_search_terms, @youtube_channel_id, @youtube_handle, @instagram_handle)
  `);

  const seed = db.transaction((companies) => {
    for (const c of companies) insert.run(c);
  });

  seed([
    { name: 'Little Joys',       meta_search_terms: 'Little Joys',    youtube_channel_id: null, youtube_handle: null, instagram_handle: 'littlejoys' },
    { name: 'Gritzo',            meta_search_terms: 'Gritzo',         youtube_channel_id: null, youtube_handle: null, instagram_handle: 'gritzo' },
    { name: 'Slurrp Farm',       meta_search_terms: 'Slurrp Farm',    youtube_channel_id: null, youtube_handle: null, instagram_handle: 'slurrpfarm' },
    { name: 'Whole Truth Foods', meta_search_terms: 'The Whole Truth', youtube_channel_id: null, youtube_handle: null, instagram_handle: 'thewholetruthfoods' },
    { name: 'PediaSure',         meta_search_terms: 'PediaSure',      youtube_channel_id: null, youtube_handle: null, instagram_handle: 'pediasure_india' },
    { name: 'Bournvita',         meta_search_terms: 'Bournvita',      youtube_channel_id: null, youtube_handle: null, instagram_handle: 'bournvita' },
    { name: 'Horlicks',          meta_search_terms: 'Horlicks',       youtube_channel_id: null, youtube_handle: null, instagram_handle: 'horlicks' },
  ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function getAllCompanies() {
  return db.prepare('SELECT * FROM companies ORDER BY name ASC').all();
}

function getActiveCompanies() {
  return db.prepare('SELECT * FROM companies WHERE active = 1 ORDER BY name ASC').all();
}

function getCompany(id) {
  return db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
}

function addCompany(data) {
  const stmt = db.prepare(`
    INSERT INTO companies (name, meta_search_terms, youtube_channel_id, youtube_handle, instagram_handle, active)
    VALUES (@name, @meta_search_terms, @youtube_channel_id, @youtube_handle, @instagram_handle, @active)
  `);
  const result = stmt.run({
    name:               data.name,
    meta_search_terms:  data.meta_search_terms  || null,
    youtube_channel_id: data.youtube_channel_id || null,
    youtube_handle:     data.youtube_handle     || null,
    instagram_handle:   data.instagram_handle   || null,
    active:             data.active !== undefined ? data.active : 1,
  });
  return getCompany(result.lastInsertRowid);
}

function updateCompany(id, data) {
  const fields = [];
  const params = {};

  if (data.name              !== undefined) { fields.push('name = @name');                           params.name               = data.name; }
  if (data.meta_search_terms !== undefined) { fields.push('meta_search_terms = @meta_search_terms'); params.meta_search_terms  = data.meta_search_terms; }
  if (data.youtube_channel_id !== undefined){ fields.push('youtube_channel_id = @youtube_channel_id'); params.youtube_channel_id = data.youtube_channel_id; }
  if (data.youtube_handle    !== undefined) { fields.push('youtube_handle = @youtube_handle');       params.youtube_handle     = data.youtube_handle; }
  if (data.instagram_handle  !== undefined) { fields.push('instagram_handle = @instagram_handle');   params.instagram_handle   = data.instagram_handle; }
  if (data.active            !== undefined) { fields.push('active = @active');                       params.active             = data.active; }

  if (!fields.length) return getCompany(id);

  params.id = id;
  db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = @id`).run(params);
  return getCompany(id);
}

function deleteCompany(id) {
  db.prepare('DELETE FROM companies WHERE id = ?').run(id);
}

module.exports = {
  getAllCompanies,
  getActiveCompanies,
  getCompany,
  addCompany,
  updateCompany,
  deleteCompany,
};
