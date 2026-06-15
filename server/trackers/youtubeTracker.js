/**
 * YouTube Tracker — two modes combined:
 * 1. Brand's own channel: fetches their recent uploads (paid/organic content)
 * 2. Partnership search: finds influencer videos mentioning the brand
 *
 * Channel IDs are auto-discovered via YouTube search if not stored in DB.
 *
 * Requires: YOUTUBE_API_KEY in .env
 * Quota: ~100 units/search + ~1 unit/video detail. Safe within 10K/day free quota.
 */

const axios = require('axios');
const db = require('../db/youtubeDb');
const companiesDb = require('../db/companiesDb');

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

const LOOKBACK_DAYS     = 14;
const MAX_OWN_VIDEOS    = 20;
const VIRAL_MULTIPLIER  = 3.0;
const MIN_PARTNER_VIEWS = 5000;

// Search suffixes for partnership detection
const PARTNER_QUERIES = ['review', '#ad sponsored', 'collab gifted', 'honest opinion'];

// Sponsorship signals
const SPONSOR_KEYWORDS = [
  '#ad', '#sponsored', '#gifted', '#collab', '#brandpartner',
  'sponsored by', 'gifted by', 'in partnership with', 'paid partnership',
  'this video is sponsored', 'use code', 'use my code', 'discount code', 'affiliate',
];
const STRONG_SIGNALS = ['#ad', '#sponsored', 'paid partnership', 'sponsored by', 'gifted by'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function publishedAfter(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function detectSponsorship(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const found = SPONSOR_KEYWORDS.filter(kw => text.includes(kw));
  return {
    isSponsored: found.length > 0,
    isConfirmed: STRONG_SIGNALS.some(kw => text.includes(kw)),
    signals: found,
  };
}

function parseDuration(iso8601) {
  const m = iso8601?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

// ─── YouTube API helpers ──────────────────────────────────────────────────────

async function fetchVideoDetails(videoIds, apiKey) {
  if (!videoIds.length) return [];
  const all = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    try {
      const res = await axios.get(`${YT_BASE}/videos`, {
        params: { key: apiKey, id: chunk.join(','), part: 'snippet,statistics,contentDetails' },
      });
      all.push(...(res.data.items || []));
      await sleep(200);
    } catch (e) { console.error('[YT] fetchVideoDetails:', e.message); }
  }
  return all;
}

/**
 * Auto-discover a brand's YouTube channel ID by searching for it.
 * Saves result back to companiesDb so it's only done once.
 */
async function discoverChannelId(brand, searchName, apiKey) {
  try {
    const res = await axios.get(`${YT_BASE}/search`, {
      params: {
        key: apiKey,
        part: 'snippet',
        q: `${searchName} official`,
        type: 'channel',
        maxResults: 3,
        regionCode: 'IN',
      },
    });
    const channel = res.data.items?.[0];
    if (!channel) return null;
    const channelId = channel.id.channelId;
    // Save it so we don't search again
    companiesDb.updateCompany(brand.id, { youtube_channel_id: channelId, youtube_handle: `@${channel.snippet.channelTitle}` });
    console.log(`[YT] Auto-discovered channel for ${brand.name}: ${channelId}`);
    return channelId;
  } catch (e) {
    console.error(`[YT] Channel discovery failed for ${brand.name}:`, e.message);
    return null;
  }
}

/**
 * Fetch brand's own recent uploads.
 */
async function fetchOwnChannelVideos(channelId, apiKey) {
  const uploadsPlaylistId = 'UU' + channelId.slice(2);
  try {
    const res = await axios.get(`${YT_BASE}/playlistItems`, {
      params: { key: apiKey, playlistId: uploadsPlaylistId, part: 'contentDetails', maxResults: MAX_OWN_VIDEOS },
    });
    const ids = (res.data.items || []).map(i => i.contentDetails.videoId);
    return fetchVideoDetails(ids, apiKey);
  } catch (e) {
    console.error(`[YT] fetchOwnChannelVideos error:`, e.message);
    return [];
  }
}

/**
 * Search YouTube for influencer/creator videos mentioning the brand.
 */
async function searchPartnerVideos(searchName, excludeChannelId, apiKey) {
  const allIds = new Set();
  for (const suffix of PARTNER_QUERIES) {
    try {
      const res = await axios.get(`${YT_BASE}/search`, {
        params: {
          key: apiKey, part: 'id', type: 'video',
          q: `${searchName} ${suffix}`,
          order: 'relevance', maxResults: 15,
          publishedAfter: publishedAfter(LOOKBACK_DAYS),
          regionCode: 'IN',
        },
      });
      (res.data.items || []).forEach(i => allIds.add(i.id.videoId));
      await sleep(500);
    } catch (e) { console.error(`[YT] search error "${searchName} ${suffix}":`, e.message); }
  }
  const videos = await fetchVideoDetails([...allIds], apiKey);
  // Filter out brand's own channel
  return videos.filter(v => !excludeChannelId || v.snippet.channelId !== excludeChannelId);
}

// ─── Main tracker ─────────────────────────────────────────────────────────────

async function runYouTubeTracker() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[YouTube Tracker] YOUTUBE_API_KEY not set');
    return { error: 'YOUTUBE_API_KEY missing' };
  }

  console.log('[YouTube Tracker] Starting run (own channel + partnerships)...');
  const results = { brands: [], ownVideos: 0, partnerVideos: 0, errors: [] };
  const brands = companiesDb.getActiveCompanies();

  for (const brand of brands) {
    const searchName = brand.meta_search_terms?.split(',')[0]?.trim() || brand.name;
    console.log(`[YouTube Tracker] Processing ${brand.name}...`);

    // ── 1. Get / discover channel ID ────────────────────────────────────────
    let channelId = brand.youtube_channel_id;
    const isPlaceholder = !channelId || channelId.includes('UCxxxxxxx');
    if (isPlaceholder) {
      channelId = await discoverChannelId(brand, searchName, apiKey);
      await sleep(500);
    }

    // ── 2. Own channel uploads ───────────────────────────────────────────────
    if (channelId) {
      const ownVideos = await fetchOwnChannelVideos(channelId, apiKey);
      const views = ownVideos.map(v => parseInt(v.statistics.viewCount || 0)).filter(Boolean);
      const avgViews = views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : 0;

      for (const video of ownVideos) {
        const viewCount = parseInt(video.statistics.viewCount || 0);
        const viralMultiple = avgViews > 0 ? viewCount / avgViews : 0;
        const { isSponsored, signals } = detectSponsorship(video.snippet.title, video.snippet.description);

        db.upsertVideo({
          video_id:          video.id,
          brand_name:        brand.name,
          channel_id:        channelId,
          channel_name:      video.snippet.channelTitle,
          title:             video.snippet.title,
          description:       (video.snippet.description || '').slice(0, 1000),
          thumbnail_url:     video.snippet.thumbnails?.medium?.url || null,
          published_at:      video.snippet.publishedAt,
          duration_seconds:  parseDuration(video.contentDetails?.duration),
          view_count:        viewCount,
          like_count:        parseInt(video.statistics.likeCount || 0),
          comment_count:     parseInt(video.statistics.commentCount || 0),
          channel_avg_views: avgViews,
          viral_multiple:    Math.round(viralMultiple * 100) / 100,
          is_viral:          viralMultiple >= VIRAL_MULTIPLIER ? 1 : 0,
          is_collab:         isSponsored ? 1 : 0,
          collab_signals:    signals.join(', ') || null,
          is_paid_boost:     0,
          boost_reason:      'own channel',
          subscriber_count:  0,
          tags:              (video.snippet.tags || []).slice(0, 20).join(', '),
          first_seen:        new Date().toISOString(),
          last_seen:         new Date().toISOString(),
        });
        results.ownVideos++;
      }
      await sleep(1000);
    }

    // ── 3. Partnership / influencer search ───────────────────────────────────
    const partnerVideos = await searchPartnerVideos(searchName, channelId, apiKey);
    for (const video of partnerVideos) {
      const viewCount = parseInt(video.statistics.viewCount || 0);
      if (viewCount < MIN_PARTNER_VIEWS) continue;
      const { isSponsored, isConfirmed, signals } = detectSponsorship(video.snippet.title, video.snippet.description);

      db.upsertVideo({
        video_id:          video.id,
        brand_name:        brand.name,
        channel_id:        video.snippet.channelId,
        channel_name:      video.snippet.channelTitle,
        title:             video.snippet.title,
        description:       (video.snippet.description || '').slice(0, 1000),
        thumbnail_url:     video.snippet.thumbnails?.medium?.url || null,
        published_at:      video.snippet.publishedAt,
        duration_seconds:  parseDuration(video.contentDetails?.duration),
        view_count:        viewCount,
        like_count:        parseInt(video.statistics.likeCount || 0),
        comment_count:     parseInt(video.statistics.commentCount || 0),
        channel_avg_views: 0,
        viral_multiple:    0,
        is_viral:          viewCount >= 100000 ? 1 : 0,
        is_collab:         isSponsored ? 1 : 0,
        collab_signals:    signals.join(', ') || 'found via partnership search',
        is_paid_boost:     isConfirmed ? 1 : 0,
        boost_reason:      isConfirmed ? 'confirmed sponsorship' : null,
        subscriber_count:  0,
        tags:              (video.snippet.tags || []).slice(0, 20).join(', '),
        first_seen:        new Date().toISOString(),
        last_seen:         new Date().toISOString(),
      });
      results.partnerVideos++;
    }

    results.brands.push({ brand: brand.name });
    await sleep(1500);
  }

  db.logRun({
    ran_at: new Date().toISOString(),
    channels_checked: brands.length,
    viral_found: results.ownVideos,
    collabs_found: results.partnerVideos,
    errors: results.errors.join('; ') || null,
  });

  console.log(`[YouTube Tracker] Done. Own: ${results.ownVideos}, Partnerships: ${results.partnerVideos}`);
  return results;
}

module.exports = { runYouTubeTracker };
