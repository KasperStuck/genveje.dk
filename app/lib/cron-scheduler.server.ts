import cron, { type ScheduledTask } from 'node-cron';
import { forceRefreshCache, getCacheMetrics, CACHE_KEYS } from './cache-manager.server';
import { fetchPartnerAdsData } from './partnerads-api.server';
import { fetchAdtractionData } from './adtraction-api.server';

let isInitialized = false;
let cronTask: ScheduledTask | null = null;
let retryTimeout: NodeJS.Timeout | null = null;

// Track last refresh attempt
let lastRefreshAttempt: number | null = null;
let lastSuccessfulRefresh: number | null = null;

// Retry configuration
const MAX_CONSECUTIVE_RETRIES = 5; // Max retries before giving up until next scheduled run
let consecutiveFailures = 0;

/**
 * Core refresh logic extracted to avoid duplication
 * Refreshes both source caches
 * @param source Source of the refresh trigger (for logging)
 */
async function executeRefresh(source: 'cron' | 'retry' | 'manual'): Promise<void> {
  const startTime = Date.now();
  lastRefreshAttempt = startTime;

  console.log(`[Cron Scheduler] Starting ${source} refresh at ${new Date(startTime).toISOString()}`);

  try {
    // Refresh both sources in parallel
    // Note: forceRefreshCache now has mutex protection built-in
    await Promise.all([
      forceRefreshCache(CACHE_KEYS.PARTNERADS, fetchPartnerAdsData),
      forceRefreshCache(CACHE_KEYS.ADTRACTION, fetchAdtractionData),
    ]);

    const totalTime = Date.now() - startTime;

    lastSuccessfulRefresh = Date.now();
    consecutiveFailures = 0; // Reset failure counter on success

    // Log detailed metrics
    const metrics = getCacheMetrics();
    console.log(`[Cron Scheduler] ✅ ${source} refresh completed successfully in ${totalTime}ms`);
    console.log(`[Cron Scheduler] Cache stats: hits=${metrics.hits}, misses=${metrics.misses}, refreshes=${metrics.refreshes}`);

    // Clear any pending retry timeout since refresh succeeded
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
      console.log(`[Cron Scheduler] Cleared pending retry timeout after successful ${source} refresh`);
    }
  } catch (error) {
    const failTime = Date.now() - startTime;
    consecutiveFailures++;

    console.error(`[Cron Scheduler] ❌ ${source} refresh failed after ${failTime}ms (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_RETRIES}):`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Only schedule retry if we haven't exceeded max retries
    if (consecutiveFailures < MAX_CONSECUTIVE_RETRIES) {
      scheduleRetryIn3Hours();
    } else {
      console.error(`[Cron Scheduler] ❌ Max retries (${MAX_CONSECUTIVE_RETRIES}) reached, will wait for next scheduled refresh`);
      // Reset counter so next scheduled run can try again
      consecutiveFailures = 0;
    }

    throw error;
  }
}

/**
 * Schedule a retry in 3 hours using setTimeout (one-time execution)
 */
function scheduleRetryIn3Hours() {
  // Clear any existing retry timeout
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }

  const delayMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  const retryTime = new Date(Date.now() + delayMs);
  const hours = retryTime.getHours();
  const minutes = retryTime.getMinutes();

  console.log(`[Cron Scheduler] Scheduling one-time retry at ${hours}:${minutes.toString().padStart(2, '0')}`);

  // Use setTimeout for one-time delayed execution
  retryTimeout = setTimeout(async () => {
    console.log('[Cron Scheduler] Running retry refresh...');
    try {
      await executeRefresh('retry');
    } catch (error) {
      // Error already logged and retry handled in executeRefresh
    }
  }, delayMs);
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
      await executeRefresh('cron');
    } catch (error) {
      // Error already logged and retry scheduled in executeRefresh
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
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    console.log('[Cron Scheduler] Retry timeout cleared');
  }
  cronTask = null;
  retryTimeout = null;
  isInitialized = false;
}

/**
 * Manually trigger the cron job (for testing)
 */
export async function triggerManualRefresh(): Promise<void> {
  console.log('[Cron Scheduler] Manual refresh triggered...');
  await executeRefresh('manual');
}

/**
 * Get refresh status information
 */
export function getRefreshStatus() {
  return {
    lastAttempt: lastRefreshAttempt ? new Date(lastRefreshAttempt).toISOString() : null,
    lastSuccess: lastSuccessfulRefresh ? new Date(lastSuccessfulRefresh).toISOString() : null,
    retryScheduled: retryTimeout !== null,
    consecutiveFailures,
    maxRetries: MAX_CONSECUTIVE_RETRIES,
    isInitialized,
  };
}
