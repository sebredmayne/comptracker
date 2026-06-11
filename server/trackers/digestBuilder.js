/**
 * Digest Builder
 * Compiles a weekly summary for a company by querying all three tracker DBs.
 */

const metaDb      = require('../db/metaDb');
const youtubeDb   = require('../db/youtubeDb');
const instagramDb = require('../db/instagramDb');
const digestDb    = require('../db/digestDb');
const companiesDb = require('../db/companiesDb');

async function buildDigest(companyName, daysBack = 7) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString();
  const weekStart = sinceStr.split('T')[0];
  const weekEnd   = new Date().toISOString().split('T')[0];

  const companies = companiesDb.getAllCompanies();
  const company   = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
  if (!company) return { error: `Company "${companyName}" not found` };

  const digest = {
    company:      company.name,
    period:       { from: weekStart, to: weekEnd, days: daysBack },
    meta:         null,
    youtube:      null,
    instagram:    null,
    summary:      '',
    generated_at: new Date().toISOString(),
  };

  // ─── Meta Ads section ─────────────────────────────────────────────────────

  try {
    const topAds  = metaDb.getTopAdsByBrand(company.name, 10);
    const newAds  = metaDb.getNewAds(50).filter(a => a.brand_name === company.name);
    const summary = metaDb.getBrandSummary().find(b => b.brand_name === company.name);

    digest.meta = {
      total_ads:       summary?.total_ads       || 0,
      new_this_week:   summary?.new_this_week   || 0,
      max_impressions: summary?.max_impressions || 0,
      avg_impressions: Math.round(summary?.avg_impressions || 0),
      top_ads:         topAds.slice(0, 5).map(a => ({
        hook:            a.hook,
        impressions:     a.impression_midpoint,
        days_running:    a.days_running,
        platforms:       a.platforms,
        snapshot_url:    a.snapshot_url,
      })),
      new_ads_sample:  newAds.slice(0, 3).map(a => ({
        hook:         a.hook,
        first_seen:   a.first_seen,
        platforms:    a.platforms,
        snapshot_url: a.snapshot_url,
      })),
    };
  } catch (err) {
    digest.meta = { error: err.message };
  }

  // ─── YouTube section ──────────────────────────────────────────────────────

  try {
    const allVideos   = youtubeDb.getAllVideos({ brand: company.name, limit: 20, sort: 'published_at' });
    const viralVideos = youtubeDb.getViralVideos({ brand: company.name, limit: 10 });
    const collabs     = youtubeDb.getCollabVideos({ brand: company.name, limit: 5 });
    const ytSummary   = youtubeDb.getBrandSummary().find(b => b.brand_name === company.name);

    // Filter to period
    const recentVideos = allVideos.filter(v => v.published_at >= sinceStr);
    const recentViral  = viralVideos.filter(v => v.published_at >= sinceStr);

    digest.youtube = {
      total_videos:   ytSummary?.total_videos  || 0,
      viral_count:    ytSummary?.viral_count   || 0,
      collab_count:   ytSummary?.collab_count  || 0,
      max_views:      ytSummary?.max_views     || 0,
      recent_videos:  recentVideos.slice(0, 5).map(v => ({
        title:        v.title,
        views:        v.view_count,
        likes:        v.like_count,
        published_at: v.published_at,
        is_viral:     !!v.is_viral,
        is_collab:    !!v.is_collab,
      })),
      viral_this_period: recentViral.length,
      top_collabs:    collabs.slice(0, 3).map(v => ({
        title:         v.title,
        views:         v.view_count,
        collab_signals: v.collab_signals,
      })),
    };
  } catch (err) {
    digest.youtube = { error: err.message };
  }

  // ─── Instagram section ────────────────────────────────────────────────────

  try {
    const allReels    = instagramDb.getAllReels({ brand: company.name, limit: 20, sort: 'posted_at' });
    const viralReels  = instagramDb.getViralReels({ brand: company.name, limit: 10 });
    const collabReels = instagramDb.getCollabReels({ brand: company.name, limit: 5 });
    const igSummary   = instagramDb.getBrandSummary().find(b => b.brand_name === company.name);

    const recentReels = allReels.filter(r => r.posted_at >= sinceStr);
    const recentViral = viralReels.filter(r => r.posted_at >= sinceStr);

    digest.instagram = {
      total_reels:    igSummary?.total_reels    || 0,
      viral_count:    igSummary?.viral_count    || 0,
      collab_count:   igSummary?.collab_count   || 0,
      sponsored_count: igSummary?.sponsored_count || 0,
      max_views:      igSummary?.max_views      || 0,
      recent_reels:   recentReels.slice(0, 5).map(r => ({
        caption:      (r.caption || '').slice(0, 150),
        views:        r.view_count,
        likes:        r.like_count,
        posted_at:    r.posted_at,
        is_viral:     !!r.is_viral,
        is_collab:    !!r.is_collab,
        reel_url:     r.reel_url,
      })),
      viral_this_period: recentViral.length,
      top_collabs:    collabReels.slice(0, 3).map(r => ({
        caption:       (r.caption || '').slice(0, 150),
        views:         r.view_count,
        collab_signals: r.collab_signals,
      })),
    };
  } catch (err) {
    digest.instagram = { error: err.message };
  }

  // ─── Text summary ─────────────────────────────────────────────────────────

  const lines = [];
  lines.push(`# Weekly Digest: ${company.name}`);
  lines.push(`**Period:** ${weekStart} to ${weekEnd} (${daysBack} days)\n`);

  // Meta
  lines.push('## Meta Ads');
  if (digest.meta?.error) {
    lines.push(`_Error: ${digest.meta.error}_`);
  } else if (digest.meta) {
    lines.push(`- Total active ads: **${digest.meta.total_ads}**`);
    lines.push(`- New this week: **${digest.meta.new_this_week}**`);
    lines.push(`- Max impressions (midpoint): **${(digest.meta.max_impressions || 0).toLocaleString()}**`);
    if (digest.meta.top_ads?.length) {
      lines.push('\n**Top Ads (by impressions):**');
      digest.meta.top_ads.forEach((a, i) => {
        lines.push(`${i + 1}. "${a.hook || '(no hook)'}" — ~${(a.impressions || 0).toLocaleString()} impressions, ${a.days_running} days running`);
      });
    }
  }

  // YouTube
  lines.push('\n## YouTube');
  if (digest.youtube?.error) {
    lines.push(`_Error: ${digest.youtube.error}_`);
  } else if (digest.youtube) {
    lines.push(`- Total videos tracked: **${digest.youtube.total_videos}**`);
    lines.push(`- Viral videos total: **${digest.youtube.viral_count}**`);
    lines.push(`- Viral in this period: **${digest.youtube.viral_this_period}**`);
    lines.push(`- Collab videos: **${digest.youtube.collab_count}**`);
    if (digest.youtube.recent_videos?.length) {
      lines.push('\n**Recent Videos:**');
      digest.youtube.recent_videos.forEach((v, i) => {
        const flags = [v.is_viral ? '🔥 viral' : null, v.is_collab ? '🤝 collab' : null].filter(Boolean).join(', ');
        lines.push(`${i + 1}. "${v.title}" — ${(v.views || 0).toLocaleString()} views${flags ? ` (${flags})` : ''}`);
      });
    }
  }

  // Instagram
  lines.push('\n## Instagram');
  if (digest.instagram?.error) {
    lines.push(`_Error: ${digest.instagram.error}_`);
  } else if (digest.instagram) {
    lines.push(`- Total reels tracked: **${digest.instagram.total_reels}**`);
    lines.push(`- Viral reels total: **${digest.instagram.viral_count}**`);
    lines.push(`- Viral in this period: **${digest.instagram.viral_this_period}**`);
    lines.push(`- Sponsored reels: **${digest.instagram.sponsored_count}**`);
    if (digest.instagram.recent_reels?.length) {
      lines.push('\n**Recent Reels:**');
      digest.instagram.recent_reels.forEach((r, i) => {
        const flags = [r.is_viral ? '🔥 viral' : null, r.is_collab ? '🤝 collab' : null].filter(Boolean).join(', ');
        lines.push(`${i + 1}. "${r.caption || '(no caption)'}" — ${(r.views || 0).toLocaleString()} views${flags ? ` (${flags})` : ''}`);
      });
    }
  }

  digest.summary = lines.join('\n');

  // ─── Cache in digestDb ────────────────────────────────────────────────────

  try {
    digestDb.saveDigest(company.name, weekStart, weekEnd, digest);
  } catch (err) {
    console.error('[digestBuilder] Failed to cache digest:', err.message);
  }

  return digest;
}

module.exports = { buildDigest };
