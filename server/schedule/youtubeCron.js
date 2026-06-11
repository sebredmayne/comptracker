/**
 * YouTube tracker cron schedule.
 * Add to server/index.js:
 *   const { scheduleYouTubeTracker } = require('./schedule/youtubeCron');
 *   scheduleYouTubeTracker();
 */

const cron = require('node-cron');
const { runYouTubeTracker } = require('../trackers/youtubeTracker');

function scheduleYouTubeTracker() {
  // Run every day at 9:00 AM IST (3:30 AM UTC)
  // YouTube metrics update frequently; daily is a good cadence
  cron.schedule('30 3 * * *', async () => {
    console.log('[YouTube Cron] Starting scheduled run...');
    try {
      await runYouTubeTracker();
    } catch (err) {
      console.error('[YouTube Cron] Failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[YouTube Cron] Scheduled: daily at 9:00 AM IST');
}

module.exports = { scheduleYouTubeTracker };
