/**
 * Express routes for Instagram organic tracker.
 * Mount in server/index.js:
 *   const igRoutes = require('./routes/instagramRoutes');
 *   app.use('/api/instagram', igRoutes);
 */

const express = require('express');
const router  = express.Router();
const { runInstagramTracker } = require('../trackers/instagramTracker');
const companiesDb = require('../db/companiesDb');
const db = require('../db/instagramDb');

let isRunning = false;

router.get('/stats',   (req, res) => { try { res.json(db.getStats()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/brands',  (req, res) => { try { res.json(db.getBrandSummary()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/accounts',(req, res) => { try { res.json(db.getAccounts()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/runs',    (req, res) => { try { res.json(db.getRecentRuns()); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/status',  (req, res) => { res.json({ running: isRunning }); });

router.get('/brands/list', (req, res) => {
  res.json(companiesDb.getActiveCompanies().map(c => c.name));
});

router.get('/reels', (req, res) => {
  try {
    const { brand, limit = 50, sort = 'posted_at', days } = req.query;
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    res.json(db.getAllReels({ brand, limit: parseInt(limit), sort, since }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/viral', (req, res) => {
  try {
    const { brand, limit = 20 } = req.query;
    res.json(db.getViralReels({ brand, limit: parseInt(limit) }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/collabs', (req, res) => {
  try {
    const { brand, limit = 20 } = req.query;
    res.json(db.getCollabReels({ brand, limit: parseInt(limit) }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sponsored', (req, res) => {
  try {
    const { brand, limit = 20 } = req.query;
    res.json(db.getSponsoredReels({ brand, limit: parseInt(limit) }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/collab-accounts', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    res.json(db.getTopCollabAccounts(parseInt(limit)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/run', async (req, res) => {
  if (isRunning) return res.status(409).json({ error: 'Tracker already running' });
  isRunning = true;
  res.json({ message: 'Instagram tracker started', startedAt: new Date().toISOString() });
  try { await runInstagramTracker(); }
  catch (err) { console.error('[Instagram Routes] Run error:', err.message); }
  finally { isRunning = false; }
});

module.exports = router;
