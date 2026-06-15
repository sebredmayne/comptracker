/**
 * YouTube Partnership Tracker
 * Searches YouTube for influencer/creator videos that mention or promote
 * competitor brands — NOT the brands' own channel uploads.
 *
 * Strategy: For each brand, run multiple search queries:
 *   - "<brand> review"
 *   - "<brand> sponsored"
 *   - "<brand> #ad"
 *   - "<brand> collab"
 * Then filter out the brand's own channel (if known), detect sponsorship
 * signals in title/description, and flag high-view videos.
 *
 * API Docs: https://developers.google.com/youtube/v3/docs/search
 * Requires: YOUTUBE_API_KEY in .env
 * Quota cost: ~100 units per search query. With 7 brands × 4 queries = 2800 units/run.
 * Free quota: 10,000 units/day — safe for one daily run.
 */

const axios = require('axios');
const db = require('../db/youtubeDb');
const companiesDb = require('../db/companiesDb');

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// Search queries appended to each brand name
const SEARCH_SUFFIXES = [
  'review',
  '#ad sponsored',
  'collab gifted',
  'honest opinion',
];

// Sponsorship/collab signals to detect in title + description
const SPONSOR_KEYWORDS = [
  '#ad', '#sponsored', '#gifted', '#collab', '#brandpartner',
  'sponsored by', 'gifted by', 'in partnership with', 'paid partnership',
  'this video is sponsored', 'thank you to', 'use code', 'use my code',
  'discount code', 'affiliate', 'ambassador',
];

// High-confidence sponsorship — these alone are enough
const STRONG_SIGNALS = ['#ad', '#sponsored', 'paid partnership', 'sponsored by', 'gifted by'];

// Views threshold to be worth tracking (filters out tiny channels)
const MIN_VIEWS = 5000;

// How far back to search (days)
const LOOKBACK_DAYS = 14;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function detectSponsorship(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const found = SPONSOR_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));
  const isStrong = STRONG_SIGNALS.some(kw => text.includes(kw.toLowerCase()));
  return {
    isSponsored: found.length > 0,
    isConfirmed: isStrong,
    signals: found,
  };
}

function publishedAfter(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString();
}

/**
 * Search YouTube for videos mentioning a brand, returns video IDs.
 * Excludes the brand's own channel if youtube_channel_id is known.
 */
async function searchVideosForBrand(brandName, searchQuery, excludeChannelId, apiKey) {
  try {
    const params = {
      key:            apiKey,
      part:           'id',
      q:              searchQuery,
      type:           'video',
      order:          'relevance',
      maxResults:     25,
      publishedAfter: publishedAfter(LOOKBACK_DAYS),
      relevanceLanguage: 'en',
      regionCode:     'IN',
    };

    const res = await axios.get(`${YT_BASE}/search`, { params });
    let ids = (res.data.items || []).map(i => i.id.videoId);

    // Remove brand's own channel videos if we know the channel ID
    if (excludeChannelId && excludeChannelId !== 'UCxxxxxxxxxxxxxxxxxxxxxxxx') {
      // We'd need channelId per result — search only returns videoId in 'id' part
      // We'll filter after fetching details
    }

    return ids;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`[YouTube Tracker] Search error for "${searchQuery}": ${msg}`);
    return [];
  }
}

/**
 * Fetch full stats + metadata for up to 50 video IDs.
 */
async function fetchVideoDetails(videoIds, apiKey) {
  if (!videoIds.length) return [];
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50));

  const all = [];
  for (const chunk of chunks) {
    try {
      const res = await axios.get(`${YT_BASE}/videos`, {
        params: { key: apiKey, id: chunk.join(','), part: 'snippet,statistics,contentDetails' },
      });
      all.push(...(res.data.items || []));
      await sleep(200);
    } catch (err) {
      console.error('[YouTube Tracker] fetchVideoDetails error:', err.message);
    }
  }
  return all;
}

// ─── Main tracker ─────────────────────────────────────────────────────────────

async function runYouTubeTracker() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[YouTube Tracker] YOUTUBE_API_KEY not set in .env');
    return { error: 'YOUTUBE_API_KEY missing' };
  }

  console.log('[YouTube Tracker] Starting partnership search run...');
  const results = { brands: [], videosFound: 0, sponsoredFound: 0, errors: [] };

  const brands = companiesDb.getActiveCompanies()
    .filter(c => c.meta_search_terms?.trim()); // use meta_search_terms as the brand name to search

  for (const brand of brands) {
    const brandName = brand.name;
    const searchName = brand.meta_search_terms?.split(',')[0]?.trim() || brandName;
    const excludeChannelId = brand.youtube_channel_id;

    console.log(`[YouTube Tracker] Searching for "${searchName}" partnerships...`);
    const seenVideoIds = new Set();
    let brandVideosFound = 0;

    for (const suffix of SEARCH_SUFFIXES) {
      const query = `${searchName} ${suffix}`;
      const videoIds = await searchVideosForBrand(brandName, query, excludeChannelId, apiKey);

      // Deduplicate across queries
      const newIds = videoIds.filter(id => !seenVideoIds.has(id));
      newIds.forEach(id => seenVideoIds.add(id));

      if (!newIds.length) { await sleep(500); continue; }

      const videos = await fetchVideoDetails(newIds, apiKey);

      for (const video of videos) {
        const views    = parseInt(video.statistics.viewCount    || 0);
        const likes    = parseInt(video.statistics.likeCount    || 0);
        const comments = parseInt(video.statistics.commentCount || 0);

        // Skip low-view videos and the brand's own channel
        if (views < MIN_VIEWS) continue;
        if (excludeChannelId && video.snippet.channelId === excludeChannelId) continue;

        const { isSponsored, isConfirmed, signals } = detectSponsorship(
          video.snippet.title,
          video.snippet.description,
        );

        const record = {
          video_id:          video.id,
          brand_name:        brandName,
          channel_id:        video.snippet.channelId,
          channel_name:      video.snippet.channelTitle,
          title:             video.snippet.title,
          description:       (video.snippet.description || '').slice(0, 1000),
          thumbnail_url:     video.snippet.thumbnails?.medium?.url || null,
          published_at:      video.snippet.publishedAt,
          duration_seconds:  0,
          view_count:        views,
          like_count:        likes,
          comment_count:     comments,
          channel_avg_views: 0,
          viral_multiple:    0,
          is_viral:          views >= 100000 ? 1 : 0,  // 100K+ views = notable
          is_collab:         isSponsored ? 1 : 0,
          collab_signals:    signals.join(', ') || null,
          is_paid_boost:     isConfirmed ? 1 : 0,       // repurpose field: confirmed sponsorship
          boost_reason:      isConfirmed ? 'confirmed sponsorship' : null,
          subscriber_count:  0,
          tags:              (video.snippet.tags || []).slice(0, 20).join(', '),
          first_seen:        new Date().toISOString(),
          last_seen:         new Date().toISOString(),
        };

        db.upsertVideo(record);
        brandVideosFound++;
        results.videosFound++;
        if (isSponsored) results.sponsoredFound++;
      }

      await sleep(1000); // quota breathing room between searches
    }

    results.brands.push({ brand: brandName, videosFound: brandVideosFound });
    console.log(`[YouTube Tracker] ${brandName}: ${brandVideosFound} influencer videos found`);
    await sleep(1500);
  }

  db.logRun({
    ran_at:           new Date().toISOString(),
    channels_checked: brands.length,
    viral_found:      results.videosFound,
    collabs_found:    results.sponsoredFound,
    errors:           results.errors.join('; ') || null,
  });

  console.log(`[YouTube Tracker] Done. Videos: ${results.videosFound}, Sponsored: ${results.sponsoredFound}`);
  return results;
}

module.exports = { runYouTubeTracker };
