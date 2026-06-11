/**
 * YouTube Tracker
 * Uses the YouTube Data API v3 (free, generous quota) to:
 *  1. Fetch all recent videos from tracked competitor channels
 *  2. Detect videos with 3x+ the channel's average views (viral signal)
 *  3. Distinguish "paid boost" from "organic win" via engagement ratio
 *  4. Detect influencer collaborations via description/title/tag keywords
 *
 * API Docs: https://developers.google.com/youtube/v3
 * Requires: YOUTUBE_API_KEY in .env
 * Free quota: 10,000 units/day. Each video details fetch = 1 unit per video.
 */

const axios = require('axios');
const db = require('../db/youtubeDb');
const companiesDb = require('../db/companiesDb');

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// TRACKED_CHANNELS is now loaded at runtime from companiesDb.
// Kept here for reference / manual override only.
const TRACKED_CHANNELS = [];

// ─── Config ───────────────────────────────────────────────────────────────────

const VIRAL_MULTIPLIER = 3.0;     // flag videos at 3x channel avg views
const LOOKBACK_VIDEOS  = 30;      // use last 30 videos to compute avg
const MAX_RESULTS      = 50;      // videos to fetch per channel per run

// Collab detection keywords in title/description/tags
const COLLAB_KEYWORDS = [
  'collab', 'collaboration', 'ft.', 'feat.', 'featuring', 'with ',
  'ambassador', 'sponsored', 'gifted', '#ad', '#sponsored', '#collab',
  'partner', 'brand partner', 'paid partnership',
];

// Engagement ratio thresholds:
// Organic wins tend to have high like:view and comment:view ratios.
// Paid/boosted content often has high views but lower relative engagement.
const PAID_BOOST_LIKE_RATIO_THRESHOLD    = 0.005; // below 0.5% likes/views → likely boosted
const PAID_BOOST_COMMENT_RATIO_THRESHOLD = 0.0005; // below 0.05% comments/views → likely boosted

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseDuration(iso8601) {
  // Convert PT4M13S → seconds
  const match = iso8601?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || 0) * 3600) +
         (parseInt(match[2] || 0) * 60) +
         parseInt(match[3] || 0);
}

function detectCollab(title = '', description = '', tags = []) {
  const haystack = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  const found = COLLAB_KEYWORDS.filter(kw => haystack.includes(kw.toLowerCase()));
  return {
    isCollab: found.length > 0,
    collabSignals: found,
  };
}

/**
 * Guess whether a video was boosted with paid spend.
 * Signals: very high views but low engagement ratios.
 * Not definitive — YouTube doesn't expose this — but a useful flag.
 */
function detectPaidBoost(views, likes, comments) {
  if (!views || views < 10000) return { isPaidBoost: false, reason: null };
  const likeRatio    = (likes || 0) / views;
  const commentRatio = (comments || 0) / views;

  const signals = [];
  if (likeRatio    < PAID_BOOST_LIKE_RATIO_THRESHOLD)    signals.push(`low like ratio (${(likeRatio * 100).toFixed(2)}%)`);
  if (commentRatio < PAID_BOOST_COMMENT_RATIO_THRESHOLD) signals.push(`low comment ratio (${(commentRatio * 100).toFixed(3)}%)`);

  return {
    isPaidBoost: signals.length >= 1,
    reason: signals.join(', ') || null,
  };
}

// ─── YouTube API calls ────────────────────────────────────────────────────────

/**
 * Get channel metadata: subscriber count, total videos, thumbnails.
 */
async function fetchChannelInfo(channelId, apiKey) {
  const res = await axios.get(`${YT_BASE}/channels`, {
    params: {
      key: apiKey,
      id: channelId,
      part: 'snippet,statistics',
    },
  });
  return res.data.items?.[0] || null;
}

/**
 * Get the most recent N video IDs from a channel's uploads playlist.
 * YouTube channels have a special "uploads" playlist = 'UC...' → 'UU...'
 */
async function fetchRecentVideoIds(channelId, apiKey, maxResults = MAX_RESULTS) {
  const uploadsPlaylistId = 'UU' + channelId.slice(2); // UC → UU
  const ids = [];
  let pageToken = null;

  while (ids.length < maxResults) {
    const params = {
      key: apiKey,
      playlistId: uploadsPlaylistId,
      part: 'contentDetails',
      maxResults: Math.min(50, maxResults - ids.length),
    };
    if (pageToken) params.pageToken = pageToken;

    const res = await axios.get(`${YT_BASE}/playlistItems`, { params });
    const items = res.data.items || [];
    ids.push(...items.map(i => i.contentDetails.videoId));
    pageToken = res.data.nextPageToken;
    if (!pageToken || items.length === 0) break;
    await sleep(200);
  }

  return ids;
}

/**
 * Fetch full stats + metadata for up to 50 video IDs in one request.
 * (YouTube allows batching up to 50 IDs per call.)
 */
async function fetchVideoDetails(videoIds, apiKey) {
  if (!videoIds.length) return [];

  // Batch in chunks of 50
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const allItems = [];
  for (const chunk of chunks) {
    const res = await axios.get(`${YT_BASE}/videos`, {
      params: {
        key: apiKey,
        id: chunk.join(','),
        part: 'snippet,statistics,contentDetails',
      },
    });
    allItems.push(...(res.data.items || []));
    await sleep(200);
  }

  return allItems;
}

// ─── Main tracker ─────────────────────────────────────────────────────────────

async function runYouTubeTracker() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[YouTube Tracker] YOUTUBE_API_KEY not set in .env');
    return { error: 'YOUTUBE_API_KEY missing' };
  }

  console.log('[YouTube Tracker] Starting run...');
  const results = { channels: [], viralVideos: 0, newCollabs: 0, errors: [] };

  // Load channels dynamically from companies DB
  const trackedChannels = companiesDb.getActiveCompanies()
    .filter(c => c.youtube_channel_id && !c.youtube_channel_id.includes('UCxxxxxxxxx'))
    .map(c => ({
      brand:     c.name,
      channelId: c.youtube_channel_id,
      handle:    c.youtube_handle || '',
    }));

  for (const channel of trackedChannels) {
    console.log(`[YouTube Tracker] Processing ${channel.brand}...`);

    try {
      // 1. Fetch channel info
      const channelInfo = await fetchChannelInfo(channel.channelId, apiKey);
      if (!channelInfo) {
        results.errors.push(`Channel not found: ${channel.brand} (${channel.channelId})`);
        continue;
      }

      const subscriberCount = parseInt(channelInfo.statistics.subscriberCount || 0);

      // 2. Fetch recent video IDs
      const videoIds = await fetchRecentVideoIds(channel.channelId, apiKey, MAX_RESULTS);
      if (!videoIds.length) {
        console.log(`[YouTube Tracker] No videos found for ${channel.brand}`);
        continue;
      }

      // 3. Fetch full video details
      const videos = await fetchVideoDetails(videoIds, apiKey);

      // 4. Compute channel average views (from last LOOKBACK_VIDEOS videos)
      const recentViews = videos
        .slice(0, LOOKBACK_VIDEOS)
        .map(v => parseInt(v.statistics.viewCount || 0))
        .filter(v => v > 0);

      const avgViews = recentViews.length > 0
        ? Math.round(recentViews.reduce((a, b) => a + b, 0) / recentViews.length)
        : 0;

      // 5. Process each video
      for (const video of videos) {
        const views    = parseInt(video.statistics.viewCount    || 0);
        const likes    = parseInt(video.statistics.likeCount    || 0);
        const comments = parseInt(video.statistics.commentCount || 0);
        const duration = parseDuration(video.contentDetails.duration);

        const viralMultiple = avgViews > 0 ? views / avgViews : 0;
        const isViral       = viralMultiple >= VIRAL_MULTIPLIER;

        const { isCollab, collabSignals } = detectCollab(
          video.snippet.title,
          video.snippet.description,
          video.snippet.tags || [],
        );

        const { isPaidBoost, reason: boostReason } = detectPaidBoost(views, likes, comments);

        const record = {
          video_id:          video.id,
          brand_name:        channel.brand,
          channel_id:        channel.channelId,
          channel_name:      channelInfo.snippet.title,
          title:             video.snippet.title,
          description:       (video.snippet.description || '').slice(0, 1000),
          thumbnail_url:     video.snippet.thumbnails?.medium?.url || null,
          published_at:      video.snippet.publishedAt,
          duration_seconds:  duration,
          view_count:        views,
          like_count:        likes,
          comment_count:     comments,
          channel_avg_views: avgViews,
          viral_multiple:    Math.round(viralMultiple * 100) / 100,
          is_viral:          isViral ? 1 : 0,
          is_collab:         isCollab ? 1 : 0,
          collab_signals:    collabSignals.join(', ') || null,
          is_paid_boost:     isPaidBoost ? 1 : 0,
          boost_reason:      boostReason || null,
          subscriber_count:  subscriberCount,
          tags:              (video.snippet.tags || []).slice(0, 20).join(', '),
          first_seen:        new Date().toISOString(),
          last_seen:         new Date().toISOString(),
        };

        const isNew = db.upsertVideo(record);

        if (isViral)  results.viralVideos++;
        if (isCollab && isNew) results.newCollabs++;
      }

      // 6. Update channel summary
      db.upsertChannel({
        channel_id:       channel.channelId,
        brand_name:       channel.brand,
        channel_name:     channelInfo.snippet.title,
        subscriber_count: subscriberCount,
        avg_views:        avgViews,
        total_videos:     videos.length,
        last_checked:     new Date().toISOString(),
      });

      results.channels.push({
        brand: channel.brand,
        videosProcessed: videos.length,
        avgViews,
        viralCount: videos.filter((_, i) => {
          const v = parseInt(videos[i].statistics.viewCount || 0);
          return avgViews > 0 && v >= VIRAL_MULTIPLIER * avgViews;
        }).length,
      });

    } catch (err) {
      console.error(`[YouTube Tracker] Error for ${channel.brand}:`, err.message);
      results.errors.push(`${channel.brand}: ${err.message}`);
    }

    await sleep(1000); // be kind to quota between channels
  }

  // Log the run
  db.logRun({
    ran_at:         new Date().toISOString(),
    channels_checked: results.channels.length,
    viral_found:    results.viralVideos,
    collabs_found:  results.newCollabs,
    errors:         results.errors.join('; ') || null,
  });

  console.log(`[YouTube Tracker] Done. Viral: ${results.viralVideos}, New collabs: ${results.newCollabs}`);
  return results;
}

module.exports = { runYouTubeTracker, TRACKED_CHANNELS };
