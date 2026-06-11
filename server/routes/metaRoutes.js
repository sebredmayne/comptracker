/**
 * Express routes for Meta Ad Library tracker.
 * Mount in your main server/index.js as:
 *   const metaRoutes = require('./routes/metaRoutes');
 *   app.use('/api/meta', metaRoutes);
 */

const express = require('express');
const router = express.Router();
const { runMetaTracker, TRACKED_BRANDS } = require('../trackers/metaAds');
const db = require('../db/metaDb');

// ─── Status & Stats ───────────────────────────────────────────────────────────

// GET /api/meta/stats
// Overall stats: total ads, brands tracked, new this week, last run time
router.get('/stats', (req, res) => {
  try {
    res.json(db.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/runs
// Last 10 tracker runs
router.get('/runs', (req, res) => {
  try {
    res.json(db.getRecentRuns());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Ads ─────────────────────────────────────────────────────────────────────

// GET /api/meta/ads?brand=Gritzo&limit=20&platform=instagram
// Get ads filtered by brand and/or platform
router.get('/ads', (req, res) => {
  try {
    const { brand, limit = 20, platform } = req.query;
    let ads;
    if (brand && platform) {
      ads = db.getAdsByPlatform(brand, platform, parseInt(limit));
    } else if (brand) {
      ads = db.getTopAdsByBrand(brand, parseInt(limit));
    } else {
      ads = db.getAllTopAds(parseInt(limit));
    }
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/ads/new
// Ads seen for the first time in the most recent run
router.get('/ads/new', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    res.json(db.getNewAds(parseInt(limit)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Hooks ───────────────────────────────────────────────────────────────────

// GET /api/meta/hooks?limit=10
// Top hooks ranked by estimated impressions across all brands
router.get('/hooks', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    res.json(db.getTopHooks(parseInt(limit)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Brand Summary ────────────────────────────────────────────────────────────

// GET /api/meta/brands
// Per-brand summary: total ads, max impressions, new this week
router.get('/brands', (req, res) => {
  try {
    res.json(db.getBrandSummary());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/brands/list
// Just the list of tracked brand names (for UI dropdowns)
router.get('/brands/list', (req, res) => {
  res.json(TRACKED_BRANDS.map(b => b.name));
});

// ─── Manual Trigger ───────────────────────────────────────────────────────────

// POST /api/meta/run
// Manually trigger a tracker run (same as the scheduled one)
let isRunning = false;

router.post('/run', async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: 'Tracker already running' });
  }
  isRunning = true;
  try {
    // Respond immediately, run in background
    res.json({ message: 'Meta tracker started', startedAt: new Date().toISOString() });
    await runMetaTracker();
  } catch (err) {
    console.error('[Meta Routes] Run error:', err.message);
  } finally {
    isRunning = false;
  }
});

// GET /api/meta/status
// Is a run currently in progress?
router.get('/status', (req, res) => {
  res.json({ running: isRunning });
});

module.exports = router;
