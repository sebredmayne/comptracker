const express = require('express');
const router  = express.Router();
const { runYouTubeTracker } = require('../trackers/youtubeTracker');
const db = require('../db/youtubeDb');
const companiesDb = require('../db/companiesDb');

let isRunning = false;

router.get('/stats',   (req, res) => { try { res.json(db.getStats()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/brands',  (req, res) => { try { res.json(db.getBrandSummary()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/channels',(req, res) => { try { res.json(db.getChannels()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/runs',    (req, res) => { try { res.json(db.getRecentRuns()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/status',  (req, res) => { res.json({ running: isRunning }); });

router.get('/brands/list', (req, res) => {
  res.json(companiesDb.getActiveCompanies().map(c => c.name));
});

router.get('/videos', (req, res) => {
  try {
    const { brand, limit = 50, sort = 'published_at', days } = req.query;
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    res.json(db.getAllVideos({ brand, limit: parseInt(limit), sort, since }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/viral', (req, res) => {
  try {
    const { brand, limit = 20, days } = req.query;
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    res.json(db.getViralVideos({ brand, limit: parseInt(limit), since }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/collabs', (req, res) => {
  try {
    const { brand, limit = 20, days } = req.query;
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    res.json(db.getCollabVideos({ brand, limit: parseInt(limit), since }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/run', async (req, res) => {
  if (isRunning) return res.status(409).json({ error: 'Tracker already running' });
  isRunning = true;
  res.json({ message: 'YouTube partnership search started — scanning for influencer videos mentioning each brand', startedAt: new Date().toISOString() });
  try { await runYouTubeTracker(); }
  catch (err) { console.error('[YouTube Routes] Run error:', err.message); }
  finally { isRunning = false; }
});

module.exports = router;
