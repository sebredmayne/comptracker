/**
 * SQLite database layer for Instagram organic tracker.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

const DB_DIR  = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'instagram_tracker.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ig_reels (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    reel_id             TEXT UNIQUE NOT NULL,
    brand_name          TEXT NOT NULL,
    username            TEXT NOT NULL,
    caption             TEXT,
    hashtags            TEXT,
    thumbnail_url       TEXT,
    reel_url            TEXT,
    short_code          TEXT,
    posted_at           TEXT,
    view_count          INTEGER DEFAULT 0,
    like_count          INTEGER DEFAULT 0,
    comment_count       INTEGER DEFAULT 0,
    share_count         INTEGER DEFAULT 0,
    account_avg_views   INTEGER DEFAULT 0,
    viral_multiple      REAL    DEFAULT 0,
    is_viral            INTEGER DEFAULT 0,
    is_collab           INTEGER DEFAULT 0,
    collab_signals      TEXT,
    coauthors           TEXT,
    mentioned_accounts  TEXT,
    is_paid_boost       INTEGER DEFAULT 0,
    boost_reason        TEXT,
    is_sponsored        INTEGER DEFAULT 0,   -- Meta's own sponsored flag
    music_name          TEXT,
    duration_seconds    INTEGER DEFAULT 0,
    follower_count      INTEGER DEFAULT 0,
    first_seen          TEXT NOT NULL,
    last_seen           TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ig_brand     ON ig_reels(brand_name);
  CREATE INDEX IF NOT EXISTS idx_ig_viral     ON ig_reels(is_viral DESC);
  CREATE INDEX IF NOT EXISTS idx_ig_collab    ON ig_reels(is_collab DESC);
  CREATE INDEX IF NOT EXISTS idx_ig_views     ON ig_reels(view_count DESC);
  CREATE INDEX IF NOT EXISTS idx_ig_posted    ON ig_reels(posted_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ig_sponsored ON ig_reels(is_sponsored DESC);

  CREATE TABLE IF NOT EXISTS ig_accounts (
    username       TEXT PRIMARY KEY,
    brand_name     TEXT NOT NULL,
    avg_views      INTEGER DEFAULT 0,
    reels_fetched  INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    last_checked   TEXT
  );

  CREATE TABLE IF NOT EXISTS ig_tracker_runs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ran_at           TEXT NOT NULL,
    accounts_checked INTEGER DEFAULT 0,
    viral_found      INTEGER DEFAULT 0,
    collabs_found    INTEGER DEFAULT 0,
    errors           TEXT
  );
`);

// ─── Statements ───────────────────────────────────────────────────────────────

const stmtUpsertReel = db.prepare(`
  INSERT INTO ig_reels (
    reel_id, brand_name, username, caption, hashtags, thumbnail_url, reel_url,
    short_code, posted_at, view_count, like_count, comment_count, share_count,
    account_avg_views, viral_multiple, is_viral, is_collab, collab_signals,
    coauthors, mentioned_accounts, is_paid_boost, boost_reason, is_sponsored,
    music_name, duration_seconds, follower_count, first_seen, last_seen
  ) VALUES (
    @reel_id, @brand_name, @username, @caption, @hashtags, @thumbnail_url, @reel_url,
    @short_code, @posted_at, @view_count, @like_count, @comment_count, @share_count,
    @account_avg_views, @viral_multiple, @is_viral, @is_collab, @collab_signals,
    @coauthors, @mentioned_accounts, @is_paid_boost, @boost_reason, @is_sponsored,
    @music_name, @duration_seconds, @follower_count, @first_seen, @last_seen
  )
  ON CONFLICT(reel_id) DO UPDATE SET
    view_count        = excluded.view_count,
    like_count        = excluded.like_count,
    comment_count     = excluded.comment_count,
    share_count       = excluded.share_count,
    account_avg_views = excluded.account_avg_views,
    viral_multiple    = excluded.viral_multiple,
    is_viral          = excluded.is_viral,
    is_paid_boost     = excluded.is_paid_boost,
    boost_reason      = excluded.boost_reason,
    last_seen         = excluded.last_seen
`);

const stmtUpsertAccount = db.prepare(`
  INSERT INTO ig_accounts (username, brand_name, avg_views, reels_fetched, follower_count, last_checked)
  VALUES (@username, @brand_name, @avg_views, @reels_fetched, @follower_count, @last_checked)
  ON CONFLICT(username) DO UPDATE SET
    avg_views      = excluded.avg_views,
    reels_fetched  = excluded.reels_fetched,
    follower_count = excluded.follower_count,
    last_checked   = excluded.last_checked
`);

// ─── Public API ───────────────────────────────────────────────────────────────

function upsertReel(reel) {
  const existing = db.prepare('SELECT id FROM ig_reels WHERE reel_id = ?').get(reel.reel_id);
  stmtUpsertReel.run(reel);
  return !existing;
}

function upsertAccount(acc) { stmtUpsertAccount.run(acc); }

function logRun(run) {
  db.prepare(`
    INSERT INTO ig_tracker_runs (ran_at, accounts_checked, viral_found, collabs_found, errors)
    VALUES (@ran_at, @accounts_checked, @viral_found, @collabs_found, @errors)
  `).run(run);
}

function getViralReels({ brand, limit = 20 } = {}) {
  if (brand) {
    return db.prepare(`SELECT * FROM ig_reels WHERE is_viral=1 AND brand_name=?
      ORDER BY viral_multiple DESC, view_count DESC LIMIT ?`).all(brand, limit);
  }
  return db.prepare(`SELECT * FROM ig_reels WHERE is_viral=1
    ORDER BY viral_multiple DESC, view_count DESC LIMIT ?`).all(limit);
}

function getCollabReels({ brand, limit = 20 } = {}) {
  if (brand) {
    return db.prepare(`SELECT * FROM ig_reels WHERE is_collab=1 AND brand_name=?
      ORDER BY posted_at DESC LIMIT ?`).all(brand, limit);
  }
  return db.prepare(`SELECT * FROM ig_reels WHERE is_collab=1
    ORDER BY posted_at DESC LIMIT ?`).all(limit);
}

function getSponsoredReels({ brand, limit = 20 } = {}) {
  if (brand) {
    return db.prepare(`SELECT * FROM ig_reels WHERE is_sponsored=1 AND brand_name=?
      ORDER BY posted_at DESC LIMIT ?`).all(brand, limit);
  }
  return db.prepare(`SELECT * FROM ig_reels WHERE is_sponsored=1
    ORDER BY posted_at DESC LIMIT ?`).all(limit);
}

function getAllReels({ brand, limit = 50, sort = 'posted_at', since } = {}) {
  const safe = ['view_count', 'posted_at', 'viral_multiple', 'like_count', 'share_count'];
  const col  = safe.includes(sort) ? sort : 'posted_at';
  const conditions = [];
  const params = [];
  if (brand)  { conditions.push('brand_name = ?'); params.push(brand); }
  if (since)  { conditions.push('posted_at >= ?'); params.push(since); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  return db.prepare(`SELECT * FROM ig_reels ${where} ORDER BY ${col} DESC LIMIT ?`).all(...params);
}

function getAccounts() {
  return db.prepare('SELECT * FROM ig_accounts ORDER BY avg_views DESC').all();
}

function getBrandSummary() {
  return db.prepare(`
    SELECT
      brand_name,
      COUNT(*) as total_reels,
      MAX(view_count) as max_views,
      AVG(view_count) as avg_views,
      SUM(is_viral) as viral_count,
      SUM(is_collab) as collab_count,
      SUM(is_sponsored) as sponsored_count,
      SUM(is_paid_boost) as boost_count,
      SUM(share_count) as total_shares,
      MAX(posted_at) as latest_post
    FROM ig_reels GROUP BY brand_name ORDER BY max_views DESC
  `).all();
}

function getTopCollabAccounts(limit = 20) {
  // Which external accounts appear most in competitor collab/mention signals?
  return db.prepare(`
    SELECT mentioned_accounts, coauthors, brand_name, COUNT(*) as appearances,
           MAX(view_count) as max_views
    FROM ig_reels
    WHERE is_collab = 1 AND (mentioned_accounts IS NOT NULL OR coauthors IS NOT NULL)
    GROUP BY mentioned_accounts, coauthors, brand_name
    ORDER BY appearances DESC
    LIMIT ?
  `).all(limit);
}

function getStats() {
  const total    = db.prepare('SELECT COUNT(*) as c FROM ig_reels').get();
  const viral    = db.prepare('SELECT COUNT(*) as c FROM ig_reels WHERE is_viral=1').get();
  const collab   = db.prepare('SELECT COUNT(*) as c FROM ig_reels WHERE is_collab=1').get();
  const sponsor  = db.prepare('SELECT COUNT(*) as c FROM ig_reels WHERE is_sponsored=1').get();
  const boost    = db.prepare('SELECT COUNT(*) as c FROM ig_reels WHERE is_paid_boost=1').get();
  const brands   = db.prepare('SELECT COUNT(DISTINCT brand_name) as c FROM ig_reels').get();
  const lastRun  = db.prepare('SELECT ran_at FROM ig_tracker_runs ORDER BY ran_at DESC LIMIT 1').get();
  return {
    totalReels:    total.c,
    viralReels:    viral.c,
    collabReels:   collab.c,
    sponsoredReels: sponsor.c,
    boostedReels:  boost.c,
    brandsTracked: brands.c,
    lastRun:       lastRun?.ran_at || null,
  };
}

function getRecentRuns() {
  return db.prepare('SELECT * FROM ig_tracker_runs ORDER BY ran_at DESC LIMIT 10').all();
}

module.exports = {
  upsertReel, upsertAccount, logRun,
  getViralReels, getCollabReels, getSponsoredReels, getAllReels,
  getAccounts, getBrandSummary, getTopCollabAccounts, getStats, getRecentRuns,
};
