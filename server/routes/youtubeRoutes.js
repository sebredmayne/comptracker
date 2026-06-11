/**
 * Express routes for YouTube tracker.
 * Mount in server/index.js:
 *   const ytRoutes = require('./routes/youtubeRoutes');
 *   app.use('/api/youtube', ytRoutes);
 */

const express = require('express');
const router  = express.Router();
const { runYouTubeTracker, TRACKED_CHANNELS } = require('../trackers/youtubeTracker');
const db = require('../db/youtubeDb');

let isRunning = false;

// GET /api/youtube/stats
router.get('/stats', (req, res) => {
  try { res.json(db.getStats()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/youtube/brands
router.get('/brands', (req, res) => {
  try { res.json(db.getBrandSummary()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/youtube/brands/list
router.get('/brands/list', (req, res) => {
  res.json(TRACKED_CHANNELS.map(c => c.brand));
});

// GET /api/youtube/channels
router.get('/channels', (req, res) => {
  try { res.json(db.getChannels()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/youtube/videos?brand=Gritzo&limit=30&sort=view_count
router.get('/videos', (req, res) => {
  try {
    const { brand, limit = 30, sort = 'view_count' } = req.query;
    res.json(db.getAllVideos({ brand, limit: parseInt(limit), sort }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/youtube/viral?brand=Gritzo&limit=20
router.get('/viral', (req, res) => {
  try {
    const { brand, limit = 20 } = req.query;
    res.json(db.getViralVideos({ brand, limit: parseInt(limit) }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/youtube/collabs?brand=Gritzo&limit=20
router.get('/collabs', (req, res) => {
  try {
    const { brand, limit = 20 } = req.query;
    res.json(db.getCollabVideos({ brand, limit: parseInt(limit) }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/youtube/runs
router.get('/runs', (req, res) => {
  try { res.json(db.getRecentRuns()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/youtube/status
router.get('/status', (req, res) => {
  res.json({ running: isRunning });
});

// POST /api/youtube/run
router.post('/run', async (req, res) => {
  if (isRunning) return res.status(409).json({ error: 'Tracker already running' });
  isRunning = true;
  res.json({ message: 'YouTube tracker started', startedAt: new Date().toISOString() });
  try { await runYouTubeTracker(); }
  catch (err) { console.error('[YouTube Routes] Run error:', err.message); }
  finally { isRunning = false; }
});

module.exports = router;
