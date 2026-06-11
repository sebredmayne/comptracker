require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const metaRoutes      = require('./routes/metaRoutes');
const youtubeRoutes   = require('./routes/youtubeRoutes');
const instagramRoutes = require('./routes/instagramRoutes');

const { scheduleMetaTracker }      = require('./schedule/metaCron');
const { scheduleYouTubeTracker }   = require('./schedule/youtubeCron');
const { scheduleInstagramTracker } = require('./schedule/instagramCron');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/meta',      metaRoutes);
app.use('/api/youtube',   youtubeRoutes);
app.use('/api/instagram', instagramRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      meta:      !!process.env.META_ACCESS_TOKEN,
      youtube:   !!process.env.YOUTUBE_API_KEY,
      instagram: !!process.env.APIFY_TOKEN,
    },
  });
});

// ─── Serve React build in production ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`\n🔑 API keys loaded:`);
  console.log(`   Meta:      ${process.env.META_ACCESS_TOKEN ? '✅' : '❌ Missing META_ACCESS_TOKEN'}`);
  console.log(`   YouTube:   ${process.env.YOUTUBE_API_KEY   ? '✅' : '❌ Missing YOUTUBE_API_KEY'}`);
  console.log(`   Instagram: ${process.env.APIFY_TOKEN       ? '✅' : '❌ Missing APIFY_TOKEN'}`);

  // ─── Start scheduled jobs ─────────────────────────────────────────────────
  scheduleMetaTracker();       // daily 8 AM IST
  scheduleYouTubeTracker();    // daily 9 AM IST
  scheduleInstagramTracker();  // daily 10 AM IST

  console.log(`\n⏰ Cron jobs scheduled (all times IST):`);
  console.log(`   Meta:      8:00 AM daily`);
  console.log(`   YouTube:   9:00 AM daily`);
  console.log(`   Instagram: 10:00 AM daily`);
  console.log(`\n✅ Ready.\n`);
});
