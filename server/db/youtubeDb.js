/**
 * SQLite database layer for YouTube tracker.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR  = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'youtube_tracker.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS yt_videos (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id          TEXT UNIQUE NOT NULL,
    brand_name        TEXT NOT NULL,
    channel_id        TEXT NOT NULL,
    channel_name      TEXT,
    title             TEXT,
    description       TEXT,
    thumbnail_url     TEXT,
    published_at      TEXT,
    duration_seconds  INTEGER DEFAULT 0,
    view_count        INTEGER DEFAULT 0,
    like_count        INTEGER DEFAULT 0,
    comment_count     INTEGER DEFAULT 0,
    channel_avg_views INTEGER DEFAULT 0,
    viral_multiple    REAL DEFAULT 0,
    is_viral          INTEGER DEFAULT 0,   -- 1 = 3x+ avg views
    is_collab         INTEGER DEFAULT 0,   -- 1 = collab signals detected
    collab_signals    TEXT,                -- which keywords triggered it
    is_paid_boost     INTEGER DEFAULT 0,   -- 1 = low engagement ratio (likely boosted)
    boost_reason      TEXT,
    subscriber_count  INTEGER DEFAULT 0,
    tags              TEXT,
    first_seen        TEXT NOT NULL,
    last_seen         TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_yt_brand        ON yt_videos(brand_name);
  CREATE INDEX IF NOT EXISTS idx_yt_viral        ON yt_videos(is_viral DESC);
  CREATE INDEX IF NOT EXISTS idx_yt_collab       ON yt_videos(is_collab DESC);
  CREATE INDEX IF NOT EXISTS idx_yt_views        ON yt_videos(view_count DESC);
  CREATE INDEX IF NOT EXISTS idx_yt_published    ON yt_videos(published_at DESC);

  CREATE TABLE IF NOT EXISTS yt_channels (
    channel_id       TEXT PRIMARY KEY,
    brand_name       TEXT NOT NULL,
    channel_name     TEXT,
    subscriber_count INTEGER DEFAULT 0,
    avg_views        INTEGER DEFAULT 0,
    total_videos     INTEGER DEFAULT 0,
    last_checked     TEXT
  );

  CREATE TABLE IF NOT EXISTS yt_tracker_runs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ran_at           TEXT NOT NULL,
    channels_checked INTEGER DEFAULT 0,
    viral_found      INTEGER DEFAULT 0,
    collabs_found    INTEGER DEFAULT 0,
    errors           TEXT
  );
`);

// ─── Statements ───────────────────────────────────────────────────────────────

const stmtUpsertVideo = db.prepare(`
  INSERT INTO yt_videos (
    video_id, brand_name, channel_id, channel_name, title, description,
    thumbnail_url, published_at, duration_seconds, view_count, like_count,
    comment_count, channel_avg_views, viral_multiple, is_viral, is_collab,
    collab_signals, is_paid_boost, boost_reason, subscriber_count, tags,
    first_seen, last_seen
  ) VALUES (
    @video_id, @brand_name, @channel_id, @channel_name, @title, @description,
    @thumbnail_url, @published_at, @duration_seconds, @view_count, @like_count,
    @comment_count, @channel_avg_views, @viral_multiple, @is_viral, @is_collab,
    @collab_signals, @is_paid_boost, @boost_reason, @subscriber_count, @tags,
    @first_seen, @last_seen
  )
  ON CONFLICT(video_id) DO UPDATE SET
    view_count        = excluded.view_count,
    like_count        = excluded.like_count,
    comment_count     = excluded.comment_count,
    channel_avg_views = excluded.channel_avg_views,
    viral_multiple    = excluded.viral_multiple,
    is_viral          = excluded.is_viral,
    is_paid_boost     = excluded.is_paid_boost,
    boost_reason      = excluded.boost_reason,
    last_seen         = excluded.last_seen
`);

const stmtUpsertChannel = db.prepare(`
  INSERT INTO yt_channels (channel_id, brand_name, channel_name, subscriber_count, avg_views, total_videos, last_checked)
  VALUES (@channel_id, @brand_name, @channel_name, @subscriber_count, @avg_views, @total_videos, @last_checked)
  ON CONFLICT(channel_id) DO UPDATE SET
    subscriber_count = excluded.subscriber_count,
    avg_views        = excluded.avg_views,
    total_videos     = excluded.total_videos,
    last_checked     = excluded.last_checked
`);

const stmtLogRun = db.prepare(`
  INSERT INTO yt_tracker_runs (ran_at, channels_checked, viral_found, collabs_found, errors)
  VALUES (@ran_at, @channels_checked, @viral_found, @collabs_found, @errors)
`);

// ─── Query helpers ────────────────────────────────────────────────────────────

function upsertVideo(video) {
  const existing = db.prepare('SELECT id FROM yt_videos WHERE video_id = ?').get(video.video_id);
  stmtUpsertVideo.run(video);
  return !existing;
}

function upsertChannel(ch) { stmtUpsertChannel.run(ch); }
function logRun(run) { stmtLogRun.run(run); }

function getViralVideos({ brand, limit = 20 } = {}) {
  if (brand) {
    return db.prepare(`
      SELECT * FROM yt_videos WHERE is_viral = 1 AND brand_name = ?
      ORDER BY viral_multiple DESC, view_count DESC LIMIT ?
    `).all(brand, limit);
  }
  return db.prepare(`
    SELECT * FROM yt_videos WHERE is_viral = 1
    ORDER BY viral_multiple DESC, view_count DESC LIMIT ?
  `).all(limit);
}

function getCollabVideos({ brand, limit = 20 } = {}) {
  if (brand) {
    return db.prepare(`
      SELECT * FROM yt_videos WHERE is_collab = 1 AND brand_name = ?
      ORDER BY published_at DESC LIMIT ?
    `).all(brand, limit);
  }
  return db.prepare(`
    SELECT * FROM yt_videos WHERE is_collab = 1
    ORDER BY published_at DESC LIMIT ?
  `).all(limit);
}

function getAllVideos({ brand, limit = 30, sort = 'view_count' } = {}) {
  const allowed = ['view_count', 'published_at', 'viral_multiple', 'like_count'];
  const col = allowed.includes(sort) ? sort : 'view_count';
  if (brand) {
    return db.prepare(`
      SELECT * FROM yt_videos WHERE brand_name = ?
      ORDER BY ${col} DESC LIMIT ?
    `).all(brand, limit);
  }
  return db.prepare(`
    SELECT * FROM yt_videos ORDER BY ${col} DESC LIMIT ?
  `).all(limit);
}

function getChannels() {
  return db.prepare('SELECT * FROM yt_channels ORDER BY avg_views DESC').all();
}

function getBrandSummary() {
  return db.prepare(`
    SELECT
      brand_name,
      COUNT(*) as total_videos,
      MAX(view_count) as max_views,
      AVG(view_count) as avg_views,
      SUM(is_viral) as viral_count,
      SUM(is_collab) as collab_count,
      SUM(is_paid_boost) as boost_count,
      MAX(published_at) as latest_video
    FROM yt_videos
    GROUP BY brand_name
    ORDER BY max_views DESC
  `).all();
}

function getRecentRuns() {
  return db.prepare('SELECT * FROM yt_tracker_runs ORDER BY ran_at DESC LIMIT 10').all();
}

function getStats() {
  const total     = db.prepare('SELECT COUNT(*) as c FROM yt_videos').get();
  const viral     = db.prepare('SELECT COUNT(*) as c FROM yt_videos WHERE is_viral = 1').get();
  const collabs   = db.prepare('SELECT COUNT(*) as c FROM yt_videos WHERE is_collab = 1').get();
  const boosted   = db.prepare('SELECT COUNT(*) as c FROM yt_videos WHERE is_paid_boost = 1').get();
  const brands    = db.prepare('SELECT COUNT(DISTINCT brand_name) as c FROM yt_videos').get();
  const lastRun   = db.prepare('SELECT ran_at FROM yt_tracker_runs ORDER BY ran_at DESC LIMIT 1').get();
  return {
    totalVideos:    total.c,
    viralVideos:    viral.c,
    collabVideos:   collabs.c,
    boostedVideos:  boosted.c,
    brandsTracked:  brands.c,
    lastRun:        lastRun?.ran_at || null,
  };
}

module.exports = {
  upsertVideo, upsertChannel, logRun,
  getViralVideos, getCollabVideos, getAllVideos,
  getChannels, getBrandSummary, getRecentRuns, getStats,
};
