/**
 * Meta Ad Library Tracker
 * Polls Meta's Ad Library API for competitor ads on Facebook + Instagram.
 * Tracks: top ads by estimated impressions, hooks (first line of copy),
 * new creatives, long-running ads (proxy for top performers).
 *
 * API Docs: https://www.facebook.com/ads/library/api/
 * Requires: META_ACCESS_TOKEN in .env (a Facebook User or App token
 *           with the `ads_read` permission granted via Ad Library API access)
 */

const axios = require('axios');
const db = require('../db/metaDb');

const BASE_URL = 'https://graph.facebook.com/v19.0/ads_archive';

// Brands to track — add/remove as needed
const TRACKED_BRANDS = [
  { name: 'Gritzo',            search_terms: ['Gritzo'] },
  { name: 'Slurrp Farm',       search_terms: ['Slurrp Farm'] },
  { name: 'Whole Truth Foods', search_terms: ['The Whole Truth'] },
  { name: 'Tummy Friendly',    search_terms: ['Tummy Friendly Foods'] },
  { name: 'PediaSure',         search_terms: ['PediaSure'] },
  { name: 'Bournvita',         search_terms: ['Bournvita'] },
  { name: 'Horlicks',          search_terms: ['Horlicks'] },
  { name: 'Little Joys',       search_terms: ['Little Joys'] },  // track yourself too
];

// Fields to fetch from the API
const FIELDS = [
  'id',
  'ad_creative_body',
  'ad_creative_link_caption',
  'ad_creative_link_description',
  'ad_creative_link_title',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_snapshot_url',
  'currency',
  'impressions',          // returns { lower_bound, upper_bound } — estimated range
  'page_name',
  'publisher_platforms',  // ["facebook", "instagram", etc.]
  'spend',                // { lower_bound, upper_bound }
  'bylines',
  'estimated_audience_size',
].join(',');

/**
 * Extract the "hook" — first meaningful sentence/line of ad copy.
 */
function extractHook(body) {
  if (!body) return null;
  // Take text up to first newline, period, or emoji sequence (≤120 chars)
  const firstLine = body.split(/[\n.!?]/)[0].trim();
  return firstLine.length > 5 ? firstLine.slice(0, 150) : body.slice(0, 150);
}

/**
 * Convert Meta's impression range string to a sortable midpoint number.
 * Meta returns ranges like "1000-4999", "5000-9999", "≥10000"
 */
function impressionMidpoint(impressions) {
  if (!impressions) return 0;
  const { lower_bound, upper_bound } = impressions;
  const lo = parseInt(lower_bound) || 0;
  const hi = parseInt(upper_bound) || lo * 2;
  return Math.round((lo + hi) / 2);
}

/**
 * Calculate how many days an ad has been running (proxy for spend/performance).
 */
function daysRunning(startTime) {
  if (!startTime) return 0;
  const start = new Date(startTime);
  const now = new Date();
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

/**
 * Fetch all active ads for a given search term from Meta Ad Library.
 * Handles pagination automatically.
 */
async function fetchAdsForBrand(brandName, searchTerm, token) {
  const ads = [];
  let url = BASE_URL;
  let params = {
    access_token: token,
    search_terms: searchTerm,
    ad_reached_countries: ['IN'],   // India — change if needed
    ad_active_status: 'ACTIVE',
    ad_type: 'ALL',
    fields: FIELDS,
    limit: 50,
  };

  let pageCount = 0;
  const MAX_PAGES = 5; // cap at 250 ads per brand per run

  while (url && pageCount < MAX_PAGES) {
    try {
      const response = await axios.get(url, { params });
      const data = response.data;

      if (data.data) {
        ads.push(...data.data.map(ad => ({ ...ad, _brandName: brandName })));
      }

      // Follow pagination cursor
      url = data.paging?.next || null;
      params = {}; // next URL already has params baked in
      pageCount++;

      // Respect rate limits — Meta allows ~200 calls/hour for Ad Library
      await sleep(500);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.error(`[Meta Tracker] Error fetching ads for "${brandName}": ${msg}`);
      break;
    }
  }

  return ads;
}

/**
 * Main tracker function — call this on a schedule (e.g. daily via node-cron).
 */
async function runMetaTracker() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    console.error('[Meta Tracker] META_ACCESS_TOKEN not set in .env');
    return { error: 'META_ACCESS_TOKEN missing' };
  }

  console.log('[Meta Tracker] Starting run...');
  const results = { brands: [], newAds: 0, updatedAds: 0, errors: [] };

  for (const brand of TRACKED_BRANDS) {
    const brandResult = { name: brand.name, adsFound: 0, topAds: [] };

    for (const term of brand.search_terms) {
      const ads = await fetchAdsForBrand(brand.name, term, token);
      brandResult.adsFound += ads.length;

      for (const ad of ads) {
        const processed = {
          ad_id: ad.id,
          brand_name: brand.name,
          page_name: ad.page_name || brand.name,
          hook: extractHook(ad.ad_creative_body || ad.ad_creative_link_title),
          body: ad.ad_creative_body || null,
          link_title: ad.ad_creative_link_title || null,
          link_description: ad.ad_creative_link_description || null,
          snapshot_url: ad.ad_snapshot_url || null,
          platforms: ad.publisher_platforms ? ad.publisher_platforms.join(',') : 'unknown',
          impression_lower: ad.impressions?.lower_bound || 0,
          impression_upper: ad.impressions?.upper_bound || 0,
          impression_midpoint: impressionMidpoint(ad.impressions),
          spend_lower: ad.spend?.lower_bound || 0,
          spend_upper: ad.spend?.upper_bound || 0,
          start_date: ad.ad_delivery_start_time || null,
          stop_date: ad.ad_delivery_stop_time || null,
          days_running: daysRunning(ad.ad_delivery_start_time),
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        };

        const isNew = db.upsertAd(processed);
        if (isNew) {
          results.newAds++;
        } else {
          results.updatedAds++;
        }
      }

      // Small delay between brand searches
      await sleep(1000);
    }

    // Pull top 10 ads for this brand by impression midpoint
    brandResult.topAds = db.getTopAdsByBrand(brand.name, 10);
    results.brands.push(brandResult);
  }

  // Log the run
  db.logRun({
    ran_at: new Date().toISOString(),
    new_ads: results.newAds,
    updated_ads: results.updatedAds,
    brands_checked: TRACKED_BRANDS.length,
  });

  console.log(`[Meta Tracker] Done. New: ${results.newAds}, Updated: ${results.updatedAds}`);
  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { runMetaTracker, TRACKED_BRANDS };
