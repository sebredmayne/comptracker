/**
 * Instagram Partnership Tracker
 * Searches Instagram hashtags to find influencer/creator posts mentioning
 * competitor brands — NOT the brands' own account posts.
 *
 * For each brand, searches hashtags like #gritzo, #slurrpfarm etc.
 * Then detects sponsored signals (#ad, #gifted, #sponsored, paid partnership).
 *
 * Actor: apify/instagram-hashtag-scraper
 * Requires: APIFY_TOKEN in .env
 */

const axios = require('axios');
const db    = require('../db/instagramDb');
const companiesDb = require('../db/companiesDb');

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID   = 'apify~instagram-hashtag-scraper';

const POSTS_PER_HASHTAG = 30;
const MIN_VIEWS         = 1000;
const LOOKBACK_DAYS     = 14;

const SPONSOR_KEYWORDS = [
  '#ad', '#sponsored', '#gifted', '#collab', '#collaboration',
  '#brandpartner', '#paidpartnership', '#brandambassador',
  'paid partnership', 'gifted by', 'sponsored by', 'in partnership with',
  'use code', 'use my code', 'discount code', 'affiliate',
];

const STRONG_SIGNALS = ['#ad', '#sponsored', 'paid partnership', 'gifted by', 'sponsored by'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function detectSponsorship(caption = '') {
  const text = caption.toLowerCase();
  const found = SPONSOR_KEYWORDS.filter(kw => text.includes(kw));
  const isConfirmed = STRONG_SIGNALS.some(kw => text.includes(kw));
  return { isSponsored: found.length > 0, isConfirmed, signals: found };
}

function buildHashtags(brandName, searchTerms) {
  // Build hashtag variants from brand name
  const base = (searchTerms || brandName).split(',')[0].trim();
  const noSpaces = base.replace(/\s+/g, '').toLowerCase();
  const withUnder = base.replace(/\s+/g, '_').toLowerCase();
  const tags = new Set([noSpaces]);
  if (withUnder !== noSpaces) tags.add(withUnder);
  return [...tags];
}

async function scrapeHashtag(hashtag, token) {
  try {
    // Start Apify actor run
    const runRes = await axios.post(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`,
      {
        hashtags: [hashtag],
        resultsLimit: POSTS_PER_HASHTAG,
        onlyPostsNewerThan: `${LOOKBACK_DAYS} days`,
      },
      { timeout: 10000 }
    );

    const runId = runRes.data.data?.id;
    if (!runId) return [];

    // Poll for completion (max 3 min)
    for (let i = 0; i < 36; i++) {
      await sleep(5000);
      const statusRes = await axios.get(
        `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
      );
      const status = statusRes.data.data?.status;
      if (status === 'SUCCEEDED') break;
      if (status === 'FAILED' || status === 'ABORTED') return [];
    }

    // Fetch results
    const dataRes = await axios.get(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=${POSTS_PER_HASHTAG}`
    );
    return dataRes.data || [];
  } catch (err) {
    console.error(`[Instagram Tracker] Hashtag #${hashtag} error: ${err.message}`);
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

  console.log('[Instagram Tracker] Starting hashtag partnership search...');
  const results = { brands: [], postsFound: 0, sponsoredFound: 0, errors: [] };

  const brands = companiesDb.getActiveCompanies();

  for (const brand of brands) {
    const hashtags = buildHashtags(brand.name, brand.meta_search_terms);
    console.log(`[Instagram Tracker] Searching #${hashtags.join(', #')} for ${brand.name}...`);
    let brandPostsFound = 0;

    for (const hashtag of hashtags) {
      const posts = await scrapeHashtag(hashtag, token);

      for (const post of posts) {
        const caption  = post.caption || post.text || '';
        const views    = post.videoViewCount || post.videoPlayCount || 0;
        const likes    = post.likesCount || 0;
        const comments = post.commentsCount || 0;
        const postedAt = post.timestamp || post.takenAt || new Date().toISOString();

        // Skip brand's own posts
        const username = (post.ownerUsername || post.username || '').toLowerCase();
        const ownHandle = (brand.instagram_handle || '').toLowerCase().replace(/^@/, '');
        if (ownHandle && username === ownHandle) continue;

        if (views < MIN_VIEWS && likes < 500) continue;

        const { isSponsored, isConfirmed, signals } = detectSponsorship(caption);

        const record = {
          reel_id:        post.id || post.shortCode || String(Date.now()),
          brand_name:     brand.name,
          username:       post.ownerUsername || post.username || 'unknown',
          caption:        caption.slice(0, 1000),
          reel_url:       post.url || `https://instagram.com/p/${post.shortCode}`,
          thumbnail_url:  post.displayUrl || post.thumbnailUrl || null,
          view_count:     views,
          like_count:     likes,
          comment_count:  comments,
          share_count:    post.sharesCount || 0,
          posted_at:      typeof postedAt === 'number'
                            ? new Date(postedAt * 1000).toISOString()
                            : postedAt,
          is_viral:       views >= 100000 ? 1 : 0,
          viral_multiple: 0,
          is_collab:      isSponsored ? 1 : 0,
          collab_signals: signals.join(', ') || `found via #${hashtag}`,
          is_sponsored:   isConfirmed ? 1 : 0,
          is_paid_boost:  0,
          boost_reason:   null,
          music_name:     post.musicInfo?.musicName || null,
          mentioned_accounts: JSON.stringify(post.taggedUsers || []),
          coauthors:      null,
          first_seen:     new Date().toISOString(),
          last_seen:      new Date().toISOString(),
        };

        try { db.upsertReel(record); } catch (_) {}
        brandPostsFound++;
        results.postsFound++;
        if (isSponsored) results.sponsoredFound++;
      }

      await sleep(2000);
    }

    results.brands.push({ brand: brand.name, postsFound: brandPostsFound });
    console.log(`[Instagram Tracker] ${brand.name}: ${brandPostsFound} influencer posts found`);
  }

  db.logRun({
    ran_at:           new Date().toISOString(),
    accounts_checked: brands.length,
    viral_found:      results.postsFound,
    new_collabs:      results.sponsoredFound,
    errors:           results.errors.join('; ') || null,
  });

  console.log(`[Instagram Tracker] Done. Posts: ${results.postsFound}, Sponsored: ${results.sponsoredFound}`);
  return results;
}

module.exports = { runInstagramTracker };
