// SQLite-based cache storage using keyv with SQLite adapter
import Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';

// Cache configuration
const CACHE_VERSION = '2'; // Increment to invalidate all caches
const CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours in ms (cron runs every 24h)
const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // Consider data stale after 24 hours

// Cache key constants to prevent typos and improve maintainability
export const CACHE_KEYS = {
  PARTNERADS: 'partnerads-data',
  ADTRACTION: 'adtraction-data',
} as const;

// Type for cache keys
export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

// Initialize SQLite-based cache using keyv with KeyvSqlite adapter
// SQLite provides better performance (O(log n) vs O(n)), ACID guarantees,
// and superior concurrency handling with WAL mode
const cache = new Keyv({
  store: new KeyvSqlite({
    uri: 'sqlite://./cache/cache.sqlite', // SQLite database file
    busyTimeout: 10000, // 10 second timeout for locked database (handles concurrent access)
  }),
  ttl: CACHE_TTL, // Default TTL for all entries
});

// Handle cache errors gracefully
cache.on('error', (error) => {
  console.error('[Cache Manager] Cache error:', error);
});

// Type for versioned cache data
type VersionedData<T> = {
  version: string;
  data: T;
  timestamp: number; // When this data was cached
};

// Cache metrics tracking
type CacheMetrics = {
  hits: number;
  misses: number;
  refreshes: number;
  errors: number;
  lastRefresh: Record<string, number>; // key -> timestamp
  fetchTimes: Record<string, number[]>; // key -> array of fetch times
};

const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  refreshes: 0,
  errors: 0,
  lastRefresh: {},
  fetchTimes: {},
};

// In-flight request tracking for deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// Mutex for preventing concurrent refresh operations
const refreshLocks = new Set<string>();

/**
 * Get cache metrics for monitoring
 */
export function getCacheMetrics(): CacheMetrics {
  return { ...metrics };
}

/**
 * Get cache hit rate as a percentage (0-100)
 */
export function getCacheHitRate(): number {
  const total = metrics.hits + metrics.misses;
  if (total === 0) return 0;
  return (metrics.hits / total) * 100;
}

/**
 * Reset cache metrics (useful for testing)
 */
export function resetCacheMetrics(): void {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.refreshes = 0;
  metrics.errors = 0;
  metrics.lastRefresh = {};
  metrics.fetchTimes = {};
}

/**
 * Get or set cache with automatic handling and request deduplication
 * @param key Cache key
 * @param fetchFn Function to fetch data if not cached
 * @param customTTL Optional custom TTL in milliseconds
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  customTTL?: number
): Promise<T> {
  // Check if there's already a request in flight for this key (deduplication)
  const inFlight = inFlightRequests.get(key);
  if (inFlight) {
    console.log(`[Cache Manager] Deduplicating request for key: ${key}`);
    return inFlight;
  }

  // Try to get from cache using our versioning-aware helper
  const cached = await getCached<T>(key);
  if (cached !== undefined) {
    metrics.hits++;
    console.log(`[Cache Manager] Hit for key: ${key} (total hits: ${metrics.hits})`);
    return cached;
  }

  // Cache miss - fetch and store with deduplication
  metrics.misses++;
  console.log(`[Cache Manager] Miss for key: ${key} - fetching... (total misses: ${metrics.misses})`);

  const fetchPromise = (async () => {
    try {
      const startTime = Date.now();
      const data = await fetchFn();
      const fetchTime = Date.now() - startTime;

      // Track fetch time
      if (!metrics.fetchTimes[key]) {
        metrics.fetchTimes[key] = [];
      }
      metrics.fetchTimes[key].push(fetchTime);
      // Keep only last 10 fetch times
      if (metrics.fetchTimes[key].length > 10) {
        metrics.fetchTimes[key].shift();
      }

      await setCache(key, data, customTTL);
      console.log(`[Cache Manager] Fetched ${key} in ${fetchTime}ms`);

      return data;
    } catch (error) {
      metrics.errors++;
      console.error(`[Cache Manager] Error fetching ${key}:`, error);
      throw error;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Stale-while-revalidate: Return stale data immediately, refresh in background
 * @param key Cache key
 * @param fetchFn Function to fetch data
 * @param customTTL Optional custom TTL
 * @returns Stale data immediately if available, otherwise fetches fresh data
 */
export async function getCachedOrFetchStale<T>(
  key: string,
  fetchFn: () => Promise<T>,
  customTTL?: number
): Promise<T> {
  // Check for any cached data (even stale)
  const staleData = await getCachedIgnoreVersion<T>(key);
  const cachedMetadata = await getCachedMetadata(key);

  // If we have stale data and it's older than threshold, start background refresh
  if (staleData && cachedMetadata) {
    const age = Date.now() - cachedMetadata.timestamp;
    if (age > STALE_THRESHOLD) {
      console.log(`[Cache Manager] Serving stale data for ${key} (age: ${Math.round(age / 1000 / 60)}min), refreshing in background`);

      // Start background refresh (don't await)
      refreshInBackground(key, fetchFn, customTTL).catch((error) => {
        console.error(`[Cache Manager] Background refresh failed for ${key}:`, error);
      });

      return staleData;
    }
  }

  // No stale data or data is fresh enough - use normal flow
  return getCachedOrFetch(key, fetchFn, customTTL);
}

/**
 * Refresh cache in background without blocking
 */
async function refreshInBackground<T>(
  key: string,
  fetchFn: () => Promise<T>,
  customTTL?: number
): Promise<void> {
  // Check if refresh is already in progress
  if (refreshLocks.has(key)) {
    console.log(`[Cache Manager] Refresh already in progress for ${key}, skipping`);
    return;
  }

  refreshLocks.add(key);
  try {
    const startTime = Date.now();
    const data = await fetchFn();
    const fetchTime = Date.now() - startTime;

    await setCache(key, data, customTTL);
    metrics.refreshes++;
    metrics.lastRefresh[key] = Date.now();

    console.log(`[Cache Manager] Background refresh completed for ${key} in ${fetchTime}ms`);
  } finally {
    refreshLocks.delete(key);
  }
}

/**
 * Get cached data without fetching
 * Validates cache version and returns undefined if version mismatch
 */
export async function getCached<T>(key: string): Promise<T | undefined> {
  const cached = await cache.get<VersionedData<T> | T>(key);

  if (!cached) {
    return undefined;
  }

  // Check if this is versioned data
  if (typeof cached === 'object' && cached !== null && 'version' in cached && 'data' in cached) {
    const versionedData = cached as VersionedData<T>;
    if (versionedData.version === CACHE_VERSION) {
      return versionedData.data;
    } else {
      console.log(`[Cache Manager] Version mismatch for key: ${key} (cached: ${versionedData.version}, current: ${CACHE_VERSION})`);
      return undefined;
    }
  }

  // Legacy data without versioning - return undefined to force refresh
  console.log(`[Cache Manager] Legacy cache data found for key: ${key}, forcing refresh`);
  return undefined;
}

/**
 * Get cached metadata (timestamp, version)
 */
async function getCachedMetadata(key: string): Promise<Pick<VersionedData<any>, 'timestamp' | 'version'> | undefined> {
  const cached = await cache.get<VersionedData<any>>(key);

  if (!cached) {
    return undefined;
  }

  if (typeof cached === 'object' && cached !== null && 'version' in cached && 'timestamp' in cached) {
    return {
      version: cached.version,
      timestamp: cached.timestamp,
    };
  }

  return undefined;
}

/**
 * Manually set cache with versioning
 */
export async function setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
  const versionedData: VersionedData<T> = {
    version: CACHE_VERSION,
    data,
    timestamp: Date.now(),
  };
  await cache.set(key, versionedData, ttl || CACHE_TTL);
  console.log(`[Cache Manager] Set for key: ${key} (version: ${CACHE_VERSION})`);
}

/**
 * Clear specific cache key
 */
export async function clearCache(key: string): Promise<void> {
  await cache.delete(key);
  console.log(`[Cache Manager] Cleared key: ${key}`);
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  await cache.clear();
  console.log('[Cache Manager] Cleared all cache');
}

/**
 * Get cached data ignoring version checks (for stale cache fallback)
 * Returns data even if version is mismatched - used as last resort during API failures
 */
export async function getCachedIgnoreVersion<T>(key: string): Promise<T | undefined> {
  const cached = await cache.get<VersionedData<T> | T>(key);

  if (!cached) {
    return undefined;
  }

  // Check if this is versioned data - extract data regardless of version
  if (typeof cached === 'object' && cached !== null && 'version' in cached && 'data' in cached) {
    const versionedData = cached as VersionedData<T>;
    console.log(`[Cache Manager] Using stale cache for key: ${key} (version: ${versionedData.version})`);
    return versionedData.data;
  }

  // Legacy data without versioning - return it as-is
  console.log(`[Cache Manager] Using legacy cache data for key: ${key}`);
  return cached as T;
}

/**
 * Force refresh cache (for cron job) with mutex to prevent concurrent refreshes
 * Bypasses cache and fetches fresh data
 */
export async function forceRefreshCache<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Check if refresh is already in progress
  if (refreshLocks.has(key)) {
    console.log(`[Cache Manager] Refresh already in progress for ${key}, waiting...`);
    // Wait for existing refresh to complete
    while (refreshLocks.has(key)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Return cached data after refresh completes
    const cached = await getCached<T>(key);
    if (cached) {
      return cached;
    }
  }

  refreshLocks.add(key);
  try {
    console.log(`[Cache Manager] Force refreshing key: ${key}`);
    const startTime = Date.now();
    const data = await fetchFn();
    const fetchTime = Date.now() - startTime;

    await setCache(key, data);
    metrics.refreshes++;
    metrics.lastRefresh[key] = Date.now();

    console.log(`[Cache Manager] Force refresh completed for ${key} in ${fetchTime}ms`);
    return data;
  } finally {
    refreshLocks.delete(key);
  }
}

/**
 * Warm up cache on server start
 * Only fetches if cache is empty, returns the cached or fetched data
 */
export async function warmupCache<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T | undefined> {
  const cached = await getCached<T>(key);
  if (!cached) {
    console.log(`[Cache Manager] Cache warmup for key: ${key}`);
    return await forceRefreshCache(key, fetchFn);
  } else {
    console.log(`[Cache Manager] Cache already warm for key: ${key}`);
    return cached;
  }
}

/**
 * Check if a refresh is currently in progress for a key
 */
export function isRefreshing(key: string): boolean {
  return refreshLocks.has(key);
}

/**
 * Get average fetch time for a key
 */
export function getAverageFetchTime(key: string): number | undefined {
  const times = metrics.fetchTimes[key];
  if (!times || times.length === 0) {
    return undefined;
  }
  return times.reduce((sum, time) => sum + time, 0) / times.length;
}

/**
 * Batch get multiple cache entries (more efficient than multiple getCached calls)
 */
export async function getCachedBatch<T>(keys: string[]): Promise<Map<string, T | undefined>> {
  const results = new Map<string, T | undefined>();

  // Use Promise.all for parallel fetches
  await Promise.all(
    keys.map(async (key) => {
      const value = await getCached<T>(key);
      results.set(key, value);
    })
  );

  return results;
}

/**
 * Batch set multiple cache entries (more efficient than multiple setCache calls)
 */
export async function setCacheBatch<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
  // Use Promise.all for parallel sets
  await Promise.all(
    Array.from(entries.entries()).map(([key, data]) => setCache(key, data, ttl))
  );
  console.log(`[Cache Manager] Batch set completed for ${entries.size} keys`);
}

console.log('[Cache Manager] Initialized keyv SQLite cache with TTL:', CACHE_TTL, 'ms, Path: ./cache/cache.sqlite');
