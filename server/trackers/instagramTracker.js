/**
 * Instagram Tracker — two modes combined:
 * 1. Brand's own account: scrapes their recent reels/posts
 * 2. Hashtag search: finds influencer posts mentioning the brand
 *
 * Actor for own account: apify/instagram-reel-scraper
 * Actor for hashtag: apify/instagram-hashtag-scraper
 *
 * Requires: APIFY_TOKEN in .env
 */

const axios = require('axios');
const db    = require('../db/instagramDb');
const companiesDb = require('../db/companiesDb');

const APIFY_BASE          = 'https://api.apify.com/v2';
const ACCOUNT_ACTOR       = 'apify~instagram-reel-scraper';
const HASHTAG_ACTOR       = 'apify~instagram-hashtag-scraper';

const REELS_PER_ACCOUNT   = 20;
const POSTS_PER_HASHTAG   = 20;
const VIRAL_MULTIPLIER    = 3.0;
const LOOKBACK_FOR_AVG    = 15;
const LOOKBACK_DAYS       = 14;
const MIN_VIEWS           = 1000;

const SPONSOR_KEYWORDS = [
  '#ad', '#sponsored', '#gifted', '#collab', '#collaboration',
  '#brandpartner', '#paidpartnership', '#brandambassador',
  'paid partnership', 'gifted by', 'sponsored by', 'in partnership with',
  'use code', 'discount code', 'affiliate',
];
const STRONG_SIGNALS = ['#ad', '#sponsored', 'paid partnership', 'gifted by', 'sponsored by'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function detectSponsorship(caption = '') {
  const text = caption.toLowerCase();
  const found = SPONSOR_KEYWORDS.filter(kw => text.includes(kw));
  return {
    isSponsored: found.length > 0,
    isConfirmed: STRONG_SIGNALS.some(kw => text.includes(kw)),
    signals: found,
  };
}

function buildHashtags(brandName, searchTerms) {
  const base = (searchTerms || brandName).split(',')[0].trim();
  const noSpaces = base.replace(/\s+/g, '').toLowerCase();
  const withUnder = base.replace(/\s+/g, '_').toLowerCase();
  return [...new Set([noSpaces, withUnder])];
}

// ─── Apify runner ─────────────────────────────────────────────────────────────

async function runApifyActor(actorId, input, token, maxWaitSecs = 300) {
  try {
    const runRes = await axios.post(
      `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
      input,
      { timeout: 15000 }
    );
    const runId = runRes.data.data?.id;
    if (!runId) return [];

    // Poll for completion
    const maxPolls = Math.ceil(maxWaitSecs / 5);
    for (let i = 0; i < maxPolls; i++) {
      await sleep(5000);
      const statusRes = await axios.get(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
      const status = statusRes.data.data?.status;
      if (status === 'SUCCEEDED') break;
      if (status === 'FAILED' || status === 'ABORTED') return [];
    }

    const dataRes = await axios.get(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=100`
    );
    return dataRes.data || [];
  } catch (err) {
    console.error(`[Instagram Tracker] Apify actor ${actorId} error: ${err.message}`);
    return [];
  }
}

function normalizePost(post, brandName, source) {
  const caption   = post.caption || post.text || '';
  const views     = post.videoViewCount || post.videoPlayCount || 0;
  const likes     = post.likesCount || 0;
  const comments  = post.commentsCount || 0;
  const postedAt  = post.timestamp || post.takenAt || new Date().toISOString();
  const { isSponsored, isConfirmed, signals } = detectSponsorship(caption);

  return {
    reel_id:            post.id || post.shortCode || String(Date.now() + Math.random()),
    brand_name:         brandName,
    username:           post.ownerUsername || post.username || 'unknown',
    caption:            caption.slice(0, 1000),
    reel_url:           post.url || `https://instagram.com/p/${post.shortCode}`,
    thumbnail_url:      post.displayUrl || post.thumbnailUrl || null,
    view_count:         views,
    like_count:         likes,
    comment_count:      comments,
    share_count:        post.sharesCount || 0,
    posted_at:          typeof postedAt === 'number'
                          ? new Date(postedAt * 1000).toISOString()
                          : postedAt,
    is_viral:           views >= 100000 ? 1 : 0,
    viral_multiple:     0,
    is_collab:          isSponsored ? 1 : 0,
    collab_signals:     signals.join(', ') || `source:${source}`,
    is_sponsored:       isConfirmed ? 1 : 0,
    is_paid_boost:      0,
    boost_reason:       source,
    music_name:         post.musicInfo?.musicName || null,
    mentioned_accounts: JSON.stringify(post.taggedUsers || []),
    coauthors:          null,
    first_seen:         new Date().toISOString(),
    last_seen:          new Date().toISOString(),
  };
}

// ─── Main tracker ─────────────────────────────────────────────────────────────

async function runInstagramTracker() {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error('[Instagram Tracker] APIFY_TOKEN not set in .env');
    return { error: 'APIFY_TOKEN missing' };
  }

  console.log('[Instagram Tracker] Starting run (own accounts + hashtag partnerships)...');
  const results = { brands: [], ownPosts: 0, partnerPosts: 0, errors: [] };
  const brands = companiesDb.getActiveCompanies();

  for (const brand of brands) {
    console.log(`[Instagram Tracker] Processing ${brand.name}...`);
    let brandOwn = 0, brandPartner = 0;

    // ── 1. Brand's own account ───────────────────────────────────────────────
    if (brand.instagram_handle) {
      const handle = brand.instagram_handle.replace(/^@/, '');
      console.log(`  Scraping own account @${handle}...`);

      const posts = await runApifyActor(ACCOUNT_ACTOR, {
        directUrls: [`https://www.instagram.com/${handle}/`],
        resultsType: 'posts',
        resultsLimit: REELS_PER_ACCOUNT,
      }, token);

      // Compute avg views for viral detection
      const viewList = posts.map(p => p.videoViewCount || p.videoPlayCount || 0).filter(Boolean);
      const avgViews = viewList.length
        ? Math.round(viewList.slice(0, LOOKBACK_FOR_AVG).reduce((a, b) => a + b, 0) / Math.min(viewList.length, LOOKBACK_FOR_AVG))
        : 0;

      for (const post of posts) {
        const record = normalizePost(post, brand.name, 'own_account');
        const views = record.view_count;
        const viralMultiple = avgViews > 0 ? views / avgViews : 0;
        record.viral_multiple = Math.round(viralMultiple * 100) / 100;
        record.is_viral = viralMultiple >= VIRAL_MULTIPLIER ? 1 : 0;
        try { db.upsertReel(record); brandOwn++; results.ownPosts++; } catch (_) {}
      }
      await sleep(2000);
    }

    // ── 2. Hashtag search for influencer partnerships ────────────────────────
    const hashtags = buildHashtags(brand.name, brand.meta_search_terms);
    console.log(`  Searching hashtags #${hashtags.join(', #')}...`);

    const hashtagPosts = await runApifyActor(HASHTAG_ACTOR, {
      hashtags,
      resultsLimit: POSTS_PER_HASHTAG,
      onlyPostsNewerThan: `${LOOKBACK_DAYS} days`,
    }, token);

    for (const post of hashtagPosts) {
      const username = (post.ownerUsername || post.username || '').toLowerCase();
      const ownHandle = (brand.instagram_handle || '').toLowerCase().replace(/^@/, '');
      // Skip brand's own posts (already captured above)
      if (ownHandle && username === ownHandle) continue;

      const views = post.videoViewCount || post.videoPlayCount || 0;
      const likes = post.likesCount || 0;
      if (views < MIN_VIEWS && likes < 500) continue;

      const record = normalizePost(post, brand.name, 'hashtag_search');
      try { db.upsertReel(record); brandPartner++; results.partnerPosts++; } catch (_) {}
    }

    results.brands.push({ brand: brand.name, own: brandOwn, partner: brandPartner });
    console.log(`  ${brand.name}: ${brandOwn} own posts, ${brandPartner} influencer posts`);
    await sleep(2000);
  }

  db.logRun({
    ran_at:           new Date().toISOString(),
    accounts_checked: brands.length,
    viral_found:      results.ownPosts,
    new_collabs:      results.partnerPosts,
    errors:           results.errors.join('; ') || null,
  });

  console.log(`[Instagram Tracker] Done. Own: ${results.ownPosts}, Partnerships: ${results.partnerPosts}`);
  return results;
}

module.exports = { runInstagramTracker };
