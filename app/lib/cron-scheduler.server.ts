import cron from 'node-cron';
import { forceRefreshCache } from './cache-manager.server';
import { fetchAffiliateData } from './affiliate-api.server';

let isInitialized = false;
let cronTask: cron.ScheduledTask | null = null;
let retryTask: cron.ScheduledTask | null = null;

/**
 * Schedule a retry in 3 hours
 */
function scheduleRetryIn3Hours() {
  // Clear any existing retry task
  if (retryTask) {
    retryTask.stop();
    retryTask = null;
  }

  const retryTime = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
  const minutes = retryTime.getMinutes();
  const hours = retryTime.getHours();

  console.log(`[Cron Scheduler] Scheduling retry at ${hours}:${minutes.toString().padStart(2, '0')}`);

  // Create a cron expression for the specific time
  // Format: minute hour * * *
  retryTask = cron.schedule(`${minutes} ${hours} * * *`, async () => {
    console.log('[Cron Scheduler] Running retry refresh...');

    try {
      await forceRefreshCache('affiliate-data', fetchAffiliateData);
      console.log('[Cron Scheduler] ✅ Retry refresh successful');

      // Stop and clear the retry task since it succeeded
      if (retryTask) {
        retryTask.stop();
        retryTask = null;
      }
    } catch (error) {
      console.error('[Cron Scheduler] ❌ Retry refresh failed:', error);
      // Schedule another retry in 3 hours
      scheduleRetryIn3Hours();
    }
  });
}

/**
 * Initialize cron job for affiliate data refresh
 * Runs every 24 hours at 3:00 AM
 */
export function initializeCronJobs() {
  // Prevent multiple initializations
  if (isInitialized) {
    console.log('[Cron Scheduler] Already initialized, skipping...');
    return;
  }

  // Check if we should run cron jobs
  const enableCron = process.env.ENABLE_CRON !== 'false';
  const isProduction = process.env.NODE_ENV === 'production';

  if (!enableCron && !isProduction) {
    console.log('[Cron Scheduler] Disabled in development (set ENABLE_CRON=true to enable)');
    return;
  }

  console.log('[Cron Scheduler] Initializing cron jobs...');

  // Schedule: Every day at 3:00 AM
  // Cron format: minute hour day month weekday
  // '0 3 * * *' = At 3:00 AM every day
  cronTask = cron.schedule('0 3 * * *', async () => {
    console.log('[Cron Scheduler] Running scheduled affiliate data refresh...');

    try {
      await forceRefreshCache('affiliate-data', fetchAffiliateData);
      console.log('[Cron Scheduler] ✅ Affiliate data refreshed successfully');

      // Clear any pending retry task since main refresh succeeded
      if (retryTask) {
        retryTask.stop();
        retryTask = null;
      }
    } catch (error) {
      console.error('[Cron Scheduler] ❌ Failed to refresh affiliate data:', error);
      // Schedule a retry in 3 hours
      scheduleRetryIn3Hours();
    }
  });

  isInitialized = true;
  console.log('[Cron Scheduler] ✅ Cron job scheduled: Daily at 3:00 AM');
}

/**
 * Stop all cron jobs (for testing or shutdown)
 */
export function stopCronJobs() {
  if (cronTask) {
    cronTask.stop();
    console.log('[Cron Scheduler] Main cron job stopped');
  }
  if (retryTask) {
    retryTask.stop();
    console.log('[Cron Scheduler] Retry task stopped');
  }
  cronTask = null;
  retryTask = null;
  isInitialized = false;
}

/**
 * Manually trigger the cron job (for testing)
 */
export async function triggerManualRefresh() {
  console.log('[Cron Scheduler] Manual refresh triggered...');
  try {
    await forceRefreshCache('affiliate-data', fetchAffiliateData);
    console.log('[Cron Scheduler] ✅ Manual refresh completed');
  } catch (error) {
    console.error('[Cron Scheduler] ❌ Manual refresh failed:', error);
    throw error;
  }
}
