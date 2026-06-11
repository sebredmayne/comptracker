/**
 * SQLite database layer for Meta Ad Library tracker.
 * Uses the same better-sqlite3 pattern as your existing server.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'meta_tracker.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS meta_ads (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_id               TEXT UNIQUE NOT NULL,
    brand_name          TEXT NOT NULL,
    page_name           TEXT,
    hook                TEXT,          -- first line of ad copy
    body                TEXT,          -- full ad copy
    link_title          TEXT,
    link_description    TEXT,
    snapshot_url        TEXT,          -- link to view creative on Meta Ad Library
    platforms           TEXT,          -- 'facebook', 'instagram', 'facebook,instagram'
    impression_lower    INTEGER DEFAULT 0,
    impression_upper    INTEGER DEFAULT 0,
    impression_midpoint INTEGER DEFAULT 0,
    spend_lower         INTEGER DEFAULT 0,
    spend_upper         INTEGER DEFAULT 0,
    start_date          TEXT,
    stop_date           TEXT,
    days_running        INTEGER DEFAULT 0,
    first_seen          TEXT NOT NULL,
    last_seen           TEXT NOT NULL,
    is_new              INTEGER DEFAULT 1   -- 1 = spotted this week, 0 = seen before
  );

  CREATE INDEX IF NOT EXISTS idx_meta_ads_brand ON meta_ads(brand_name);
  CREATE INDEX IF NOT EXISTS idx_meta_ads_impression ON meta_ads(impression_midpoint DESC);
  CREATE INDEX IF NOT EXISTS idx_meta_ads_first_seen ON meta_ads(first_seen DESC);

  CREATE TABLE IF NOT EXISTS meta_tracker_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ran_at          TEXT NOT NULL,
    new_ads         INTEGER DEFAULT 0,
    updated_ads     INTEGER DEFAULT 0,
    brands_checked  INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS meta_hook_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_id       TEXT NOT NULL,
    brand_name  TEXT NOT NULL,
    hook        TEXT,
    captured_at TEXT NOT NULL
  );
`);

// ─── Prepared statements ──────────────────────────────────────────────────────

const stmtUpsert = db.prepare(`
  INSERT INTO meta_ads (
    ad_id, brand_name, page_name, hook, body, link_title, link_description,
    snapshot_url, platforms, impression_lower, impression_upper,
    impression_midpoint, spend_lower, spend_upper, start_date, stop_date,
    days_running, first_seen, last_seen, is_new
  ) VALUES (
    @ad_id, @brand_name, @page_name, @hook, @body, @link_title, @link_description,
    @snapshot_url, @platforms, @impression_lower, @impression_upper,
    @impression_midpoint, @spend_lower, @spend_upper, @start_date, @stop_date,
    @days_running, @first_seen, @last_seen, 1
  )
  ON CONFLICT(ad_id) DO UPDATE SET
    impression_lower    = excluded.impression_lower,
    impression_upper    = excluded.impression_upper,
    impression_midpoint = excluded.impression_midpoint,
    spend_lower         = excluded.spend_lower,
    spend_upper         = excluded.spend_upper,
    days_running        = excluded.days_running,
    last_seen           = excluded.last_seen,
    stop_date           = excluded.stop_date,
    is_new              = 0
`);

const stmtGetTopByBrand = db.prepare(`
  SELECT * FROM meta_ads
  WHERE brand_name = ?
  ORDER BY impression_midpoint DESC, days_running DESC
  LIMIT ?
`);

const stmtGetAllTopAds = db.prepare(`
  SELECT * FROM meta_ads
  ORDER BY impression_midpoint DESC, days_running DESC
  LIMIT ?
`);

const stmtGetNewAds = db.prepare(`
  SELECT * FROM meta_ads
  WHERE is_new = 1
  ORDER BY first_seen DESC
  LIMIT ?
`);

const stmtGetTopHooks = db.prepare(`
  SELECT hook, brand_name, impression_midpoint, days_running, snapshot_url, platforms
  FROM meta_ads
  WHERE hook IS NOT NULL
  ORDER BY impression_midpoint DESC, days_running DESC
  LIMIT ?
`);

const stmtGetBrandSummary = db.prepare(`
  SELECT
    brand_name,
    COUNT(*) as total_ads,
    MAX(impression_midpoint) as max_impressions,
    AVG(impression_midpoint) as avg_impressions,
    SUM(CASE WHEN is_new = 1 THEN 1 ELSE 0 END) as new_this_week,
    MAX(last_seen) as last_updated
  FROM meta_ads
  GROUP BY brand_name
  ORDER BY max_impressions DESC
`);

const stmtGetRecentRuns = db.prepare(`
  SELECT * FROM meta_tracker_runs ORDER BY ran_at DESC LIMIT 10
`);

const stmtLogRun = db.prepare(`
  INSERT INTO meta_tracker_runs (ran_at, new_ads, updated_ads, brands_checked)
  VALUES (@ran_at, @new_ads, @updated_ads, @brands_checked)
`);

const stmtResetNewFlags = db.prepare(`
  UPDATE meta_ads SET is_new = 0 WHERE is_new = 1
`);

const stmtGetAdsByBrandAndPlatform = db.prepare(`
  SELECT * FROM meta_ads
  WHERE brand_name = ? AND platforms LIKE ?
  ORDER BY impression_midpoint DESC
  LIMIT ?
`);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upsert an ad. Returns true if it was newly inserted, false if updated.
 */
function upsertAd(ad) {
  const existing = db.prepare('SELECT id FROM meta_ads WHERE ad_id = ?').get(ad.ad_id);
  stmtUpsert.run(ad);
  return !existing; // true = new
}

function getTopAdsByBrand(brandName, limit = 10) {
  return stmtGetTopByBrand.all(brandName, limit);
}

function getAllTopAds(limit = 50) {
  return stmtGetAllTopAds.all(limit);
}

function getNewAds(limit = 20) {
  return stmtGetNewAds.all(limit);
}

/**
 * Top N hooks across all brands, ranked by estimated impressions.
 */
function getTopHooks(limit = 10) {
  return stmtGetTopHooks.all(limit);
}

function getBrandSummary() {
  return stmtGetBrandSummary.all();
}

function getRecentRuns() {
  return stmtGetRecentRuns.all();
}

function logRun(run) {
  stmtLogRun.run(run);
}

/**
 * Call this before each run to reset "new this week" flags.
 * Only call if you want a clean weekly slate.
 */
function resetNewFlags() {
  stmtResetNewFlags.run();
}

function getAdsByPlatform(brandName, platform, limit = 20) {
  return stmtGetAdsByBrandAndPlatform.all(brandName, `%${platform}%`, limit);
}

function getStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM meta_ads').get();
  const brands = db.prepare('SELECT COUNT(DISTINCT brand_name) as count FROM meta_ads').get();
  const newThisWeek = db.prepare('SELECT COUNT(*) as count FROM meta_ads WHERE is_new = 1').get();
  const lastRun = db.prepare('SELECT ran_at FROM meta_tracker_runs ORDER BY ran_at DESC LIMIT 1').get();
  return {
    totalAds: total.count,
    brandsTracked: brands.count,
    newThisWeek: newThisWeek.count,
    lastRun: lastRun?.ran_at || null,
  };
}

module.exports = {
  upsertAd,
  getTopAdsByBrand,
  getAllTopAds,
  getNewAds,
  getTopHooks,
  getBrandSummary,
  getRecentRuns,
  logRun,
  resetNewFlags,
  getAdsByPlatform,
  getStats,
};
