/**
 * Instagram tracker cron.
 * Add to server/index.js:
 *   const { scheduleInstagramTracker } = require('./schedule/instagramCron');
 *   scheduleInstagramTracker();
 *
 * NOTE: Instagram runs are slower than YouTube (Apify needs to spin up
 * browser actors). Budget ~5-10 mins for a full 8-account run.
 * Running daily at 10 AM IST keeps it well within Apify's free $5/month credit
 * (~$6/month for daily runs at 30 reels/account).
 */

const cron = require('node-cron');
const { runInstagramTracker } = require('../trackers/instagramTracker');

function scheduleInstagramTracker() {
  // Daily at 10:00 AM IST (4:30 AM UTC)
  cron.schedule('30 4 * * *', async () => {
    console.log('[Instagram Cron] Starting scheduled run...');
    try {
      await runInstagramTracker();
    } catch (err) {
      console.error('[Instagram Cron] Failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[Instagram Cron] Scheduled: daily at 10:00 AM IST');
}

module.exports = { scheduleInstagramTracker };
