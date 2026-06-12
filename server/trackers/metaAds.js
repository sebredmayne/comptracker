/**
 * Meta Ad Library Tracker (via SearchAPI.io)
 * Uses SearchAPI's facebook_ad_library engine — no Meta developer app needed.
 *
 * Docs: https://www.searchapi.io/docs/facebook-ad-library
 * Requires: SEARCHAPI_KEY in .env
 */

const axios = require('axios');
const db = require('../db/metaDb');
const companiesDb = require('../db/companiesDb');

const SEARCHAPI_URL = 'https://www.searchapi.io/api/v1/search';

function extractHook(body) {
  if (!body) return null;
  const firstLine = body.split(/[\n.!?]/)[0].trim();
  return firstLine.length > 5 ? firstLine.slice(0, 150) : body.slice(0, 150);
}

function impressionMidpoint(lower, upper) {
  const lo = parseInt(lower) || 0;
  const hi = parseInt(upper) || lo * 2;
  return Math.round((lo + hi) / 2);
}

function daysRunning(startTime) {
  if (!startTime) return 0;
  return Math.floor((Date.now() - new Date(startTime)) / 86400000);
}

async function fetchAdsForBrand(brandName, searchTerm, apiKey) {
  const ads = [];
  let pageToken = null;
  let pageCount = 0;
  const MAX_PAGES = 5;

  while (pageCount < MAX_PAGES) {
    try {
      const params = {
        engine:       'facebook_ad_library',
        api_key:      apiKey,
        q:            searchTerm,
        country:      'IN',
        ad_type:      'ALL',
        ad_active_status: 'ACTIVE',
      };
      if (pageToken) params.page_token = pageToken;

      const { data } = await axios.get(SEARCHAPI_URL, { params });
      const results = data.ads || [];

      for (const ad of results) {
        ads.push({ ...ad, _brandName: brandName });
      }

      pageToken = data.pagination?.next_page_token || null;
      if (!pageToken) break;
      pageCount++;
      await sleep(600);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      console.error(`[Meta Tracker] Error fetching "${brandName}": ${msg}`);
      break;
    }
  }

  return ads;
}

async function runMetaTracker() {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) {
    console.error('[Meta Tracker] SEARCHAPI_KEY not set in .env');
    return { error: 'SEARCHAPI_KEY missing' };
  }

  console.log('[Meta Tracker] Starting run...');
  const results = { brands: [], newAds: 0, updatedAds: 0, errors: [] };

  const trackedBrands = companiesDb.getActiveCompanies()
    .filter(c => c.meta_search_terms?.trim())
    .map(c => ({
      name:         c.name,
      search_terms: c.meta_search_terms.split(',').map(t => t.trim()).filter(Boolean),
    }));

  for (const brand of trackedBrands) {
    const brandResult = { name: brand.name, adsFound: 0, topAds: [] };

    for (const term of brand.search_terms) {
      const ads = await fetchAdsForBrand(brand.name, term, apiKey);
      brandResult.adsFound += ads.length;

      for (const ad of ads) {
        // SearchAPI field mapping (differs from graph.facebook.com)
        const body     = ad.ad_creative_bodies?.[0] || ad.body || null;
        const title    = ad.ad_creative_link_titles?.[0] || ad.title || null;
        const platforms = Array.isArray(ad.publisher_platforms)
          ? ad.publisher_platforms.join(',')
          : (ad.publisher_platforms || 'unknown');

        const processed = {
          ad_id:              ad.id || ad.ad_archive_id || String(Date.now()),
          brand_name:         brand.name,
          page_name:          ad.page_name || brand.name,
          hook:               extractHook(body || title),
          body:               body,
          link_title:         title,
          link_description:   ad.ad_creative_link_descriptions?.[0] || null,
          snapshot_url:       ad.ad_snapshot_url || null,
          platforms:          platforms,
          impression_lower:   ad.impressions?.lower_bound || 0,
          impression_upper:   ad.impressions?.upper_bound || 0,
          impression_midpoint: impressionMidpoint(
            ad.impressions?.lower_bound,
            ad.impressions?.upper_bound
          ),
          spend_lower:        ad.spend?.lower_bound || 0,
          spend_upper:        ad.spend?.upper_bound || 0,
          start_date:         ad.ad_delivery_start_time || null,
          stop_date:          ad.ad_delivery_stop_time || null,
          days_running:       daysRunning(ad.ad_delivery_start_time),
          first_seen:         new Date().toISOString(),
          last_seen:          new Date().toISOString(),
        };

        const isNew = db.upsertAd(processed);
        if (isNew) results.newAds++;
        else results.updatedAds++;
      }

      await sleep(1000);
    }

    brandResult.topAds = db.getTopAdsByBrand(brand.name, 10);
    results.brands.push(brandResult);
  }

  db.logRun({
    ran_at:          new Date().toISOString(),
    new_ads:         results.newAds,
    updated_ads:     results.updatedAds,
    brands_checked:  trackedBrands.length,
  });

  console.log(`[Meta Tracker] Done. New: ${results.newAds}, Updated: ${results.updatedAds}`);
  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { runMetaTracker };
