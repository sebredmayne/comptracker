/**
 * Meta tracker cron schedule.
 * Add this to your existing server/index.js
 *
 * Usage:
 *   const { scheduleMetaTracker } = require('./schedule/metaCron');
 *   scheduleMetaTracker();
 */

const cron = require('node-cron');
const { runMetaTracker } = require('../trackers/metaAds');

function scheduleMetaTracker() {
  // Run every day at 8:00 AM IST (2:30 AM UTC)
  // Meta Ad Library refreshes daily, so daily polling is sufficient
  cron.schedule('30 2 * * *', async () => {
    console.log('[Meta Cron] Starting scheduled run...');
    try {
      await runMetaTracker();
    } catch (err) {
      console.error('[Meta Cron] Failed:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('[Meta Cron] Scheduled: daily at 8:00 AM IST');
}

module.exports = { scheduleMetaTracker };
