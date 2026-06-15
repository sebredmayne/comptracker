/**
 * Instagram Organic Tracker
 * Uses Apify's official `apify/instagram-reel-scraper` actor ($1/1k reels)
 * to track competitor Instagram reels and posts without an Instagram login.
 *
 * Tracks:
 *  1. Reels/posts with 3x+ the account's average views (viral signal)
 *  2. Paid boost proxy: high views + low engagement ratio
 *  3. Influencer collabs: @mentions, #ad, sponsored keywords, coauthors
 *  4. New collab accounts appearing on competitor pages
 *
 * Apify actor docs: https://apify.com/apify/instagram-reel-scraper
 * Requires: APIFY_TOKEN in .env
 * Cost estimate: 7 brands × 30 reels = 210 reels/run ≈ $0.21/run ≈ $6/month daily
 */

const axios = require('axios');
const db    = require('../db/instagramDb');
const companiesDb = require('../db/companiesDb');

const APIFY_BASE   = 'https://api.apify.com/v2';
const ACTOR_ID     = 'apify~instagram-reel-scraper'; // official Apify actor

// TRACKED_ACCOUNTS is now loaded at runtime from companiesDb.
// Kept here for reference / manual override only.
const TRACKED_ACCOUNTS = [];

// ─── Config ───────────────────────────────────────────────────────────────────

const REELS_PER_ACCOUNT   = 30;   // fetch last 30 reels per account per run
const VIRAL_MULTIPLIER    = 3.0;  // flag at 3x channel avg views
const LOOKBACK_FOR_AVG    = 20;   // use last 20 reels to compute avg

// Collab/sponsorship detection
const COLLAB_KEYWORDS = [
  '#ad', '#sponsored', '#collab', '#collaboration', '#gifted',
  '#brandpartner', '#paidpartnership', 'ft.', 'feat.', 'featuring',
  'in collaboration with', 'partnered with', 'thanks to', 'coauthor',
];

// Paid boost proxy thresholds (same logic as YouTube tracker)
const PAID_BOOST_LIKE_VIEW_RATIO    = 0.02;  // below 2% likes/views for IG (higher bar than YT)
const PAID_BOOST_COMMENT_VIEW_RATIO = 0.001; // below 0.1% comments/views

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function detectCollab(caption = '', coauthors = [], mentions = []) {
  const haystack = (caption || '').toLowerCase();
  const signals  = [];

  COLLAB_KEYWORDS.forEach(kw => {
    if (haystack.includes(kw.toLowerCase())) signals.push(kw);
  });

  // Coauthors = Instagram's native "Collab" post feature — very strong signal
  if (coauthors && coauthors.length > 0) {
    signals.push(`coauthor:${coauthors.map(c => c.username || c).join(',')}`);
  }

  // @mentions of external accounts in caption
  const captionMentions = (caption.match(/@[\w.]+/g) || []);
  if (captionMentions.length > 0) {
    signals.push(`mentions:${captionMentions.slice(0, 5).join(',')}`);
  }

  return {
    isCollab:      signals.length > 0,
    collabSignals: signals.join(' | '),
    coauthors:     coauthors.map(c => c.username || String(c)).join(', ') || null,
    mentionedAccounts: captionMentions.slice(0, 10).join(', ') || null,
  };
}

function detectPaidBoost(views, likes, comments) {
  if (!views || views < 5000) return { isPaidBoost: false, reason: null };
  const likeRatio    = (likes    || 0) / views;
  const commentRatio = (comments || 0) / views;
  const signals      = [];

  if (likeRatio    < PAID_BOOST_LIKE_VIEW_RATIO)    signals.push(`low like ratio (${(likeRatio * 100).toFixed(2)}%)`);
  if (commentRatio < PAID_BOOST_COMMENT_VIEW_RATIO) signals.push(`low comment ratio (${(commentRatio * 100).toFixed(3)}%)`);

  return {
    isPaidBoost: signals.length >= 1,
    reason:      signals.join(', ') || null,
  };
}

// ─── Apify API calls ──────────────────────────────────────────────────────────

/**
 * Start an Apify actor run and wait for it to finish.
 * Returns the dataset items array.
 */
async function runApifyActor(input, token) {
  // 1. Start the run
  const startRes = await axios.post(
    `${APIFY_BASE}/acts/${ACTOR_ID}/runs`,
    input,
    {
      params: { token },
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const runId = startRes.data.data.id;
  console.log(`  [Apify] Run started: ${runId}`);

  // 2. Poll until finished (SUCCEEDED or FAILED)
  let status = 'RUNNING';
  let pollCount = 0;
  while (status === 'RUNNING' || status === 'READY') {
    await sleep(5000); // poll every 5 seconds
    const statusRes = await axios.get(
      `${APIFY_BASE}/actor-runs/${runId}`,
      { params: { token } }
    );
    status = statusRes.data.data.status;
    pollCount++;

    if (pollCount > 120) { // 10 minute timeout
      throw new Error(`Apify run ${runId} timed out after 10 minutes`);
    }
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${runId} finished with status: ${status}`);
  }

  // 3. Fetch dataset items
  const datasetId = startRes.data.data.defaultDatasetId;
  const dataRes   = await axios.get(
    `${APIFY_BASE}/datasets/${datasetId}/items`,
    { params: { token, format: 'json', clean: true } }
  );

  return dataRes.data || [];
}

/**
 * Fetch reels for a single Instagram account via Apify.
 */
async function fetchReelsForAccount(username, token) {
  const input = {
    username: [username],
    resultsLimit: REELS_PER_ACCOUNT,
    // Only reels newer than 90 days to keep data fresh
    onlyPostsNewerThan: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };

  try {
    return await runApifyActor(input, token);
  } catch (err) {
    console.error(`  [Apify] Failed for @${username}: ${err.message}`);
    return [];
  }
}

// ─── Main tracker ─────────────────────────────────────────────────────────────

async function runInstagramTracker() {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error('[Instagram Tracker] APIFY_TOKEN not set in .env');
    return { error: 'APIFY_TOKEN missing' };
  }

  console.log('[Instagram Tracker] Starting run...');
  const results = { accounts: [], viralReels: 0, newCollabs: 0, errors: [] };

  const trackedAccounts = companiesDb.getActiveCompanies()
    .filter(c => c.instagram_handle && c.instagram_handle.trim())
    .map(c => ({ brand: c.name, username: c.instagram_handle.trim().replace(/^@/, '') }));

  for (const account of trackedAccounts) {
    console.log(`[Instagram Tracker] Fetching @${account.username} (${account.brand})...`);

    try {
      const reels = await fetchReelsForAccount(account.username, token);

      if (!reels.length) {
        console.log(`  No reels found for @${account.username}`);
        continue;
      }

      // Compute average views from the lookback window
      const recentViews = reels
        .slice(0, LOOKBACK_FOR_AVG)
        .map(r => r.videoPlayCount || r.viewsCount || r.likesCount * 10 || 0) // fallback chain
        .filter(v => v > 0);

      const avgViews = recentViews.length > 0
        ? Math.round(recentViews.reduce((a, b) => a + b, 0) / recentViews.length)
        : 0;

      let accountViral  = 0;
      let accountCollab = 0;

      for (const reel of reels) {
        const views    = reel.videoPlayCount || reel.viewsCount || 0;
        const likes    = reel.likesCount  || 0;
        const comments = reel.commentsCount || 0;
        const shares   = reel.sharesCount || 0;

        const viralMultiple = avgViews > 0 ? Math.round((views / avgViews) * 100) / 100 : 0;
        const isViral       = viralMultiple >= VIRAL_MULTIPLIER;

        const { isCollab, collabSignals, coauthors, mentionedAccounts } = detectCollab(
          reel.caption,
          reel.coauthorProducers || [],
          reel.mentions || [],
        );

        const { isPaidBoost, reason: boostReason } = detectPaidBoost(views, likes, comments);

        // Extract hashtags from caption
        const hashtags = (reel.caption || '').match(/#[\w]+/g)?.slice(0, 20).join(', ') || null;

        const record = {
          reel_id:           reel.id || reel.shortCode,
          brand_name:        account.brand,
          username:          account.username,
          caption:           (reel.caption || '').slice(0, 1000),
          hashtags,
          thumbnail_url:     reel.displayUrl || reel.thumbnailUrl || null,
          reel_url:          reel.url || `https://www.instagram.com/p/${reel.shortCode}/`,
          short_code:        reel.shortCode || null,
          posted_at:         reel.timestamp || reel.takenAtTimestamp
                               ? new Date((reel.timestamp || reel.takenAtTimestamp) * 1000).toISOString()
                               : null,
          view_count:        views,
          like_count:        likes,
          comment_count:     comments,
          share_count:       shares,
          account_avg_views: avgViews,
          viral_multiple:    viralMultiple,
          is_viral:          isViral ? 1 : 0,
          is_collab:         isCollab ? 1 : 0,
          collab_signals:    collabSignals || null,
          coauthors:         coauthors || null,
          mentioned_accounts: mentionedAccounts || null,
          is_paid_boost:     isPaidBoost ? 1 : 0,
          boost_reason:      boostReason || null,
          is_sponsored:      reel.isSponsored ? 1 : 0,   // Apify extracts this field
          music_name:        reel.musicName || reel.audioName || null,
          duration_seconds:  reel.videoDuration || 0,
          follower_count:    reel.ownerFollowersCount || 0,
          first_seen:        new Date().toISOString(),
          last_seen:         new Date().toISOString(),
        };

        const isNew = db.upsertReel(record);
        if (isViral)          { results.viralReels++; accountViral++; }
        if (isCollab && isNew){ results.newCollabs++; accountCollab++; }
      }

      // Update account summary
      db.upsertAccount({
        username:      account.username,
        brand_name:    account.brand,
        avg_views:     avgViews,
        reels_fetched: reels.length,
        follower_count: reels[0]?.ownerFollowersCount || 0,
        last_checked:  new Date().toISOString(),
      });

      results.accounts.push({
        brand:         account.brand,
        username:      account.username,
        reelsFetched:  reels.length,
        avgViews,
        viralCount:    accountViral,
        collabCount:   accountCollab,
      });

      console.log(`  ✓ ${account.brand}: ${reels.length} reels, avg ${avgViews.toLocaleString()} views, ${accountViral} viral, ${accountCollab} new collabs`);

    } catch (err) {
      console.error(`[Instagram Tracker] Error for ${account.brand}:`, err.message);
      results.errors.push(`${account.brand}: ${err.message}`);
    }

    // Pause between accounts — Apify handles rate limits but let's be gentle
    await sleep(2000);
  }

  db.logRun({
    ran_at:           new Date().toISOString(),
    accounts_checked: results.accounts.length,
    viral_found:      results.viralReels,
    collabs_found:    results.newCollabs,
    errors:           results.errors.join('; ') || null,
  });

  console.log(`[Instagram Tracker] Done. Viral: ${results.viralReels}, New collabs: ${results.newCollabs}`);
  return results;
}

module.exports = { runInstagramTracker, TRACKED_ACCOUNTS };
