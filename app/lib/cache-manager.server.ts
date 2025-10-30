// File-based cache storage using cache-manager with fs-hash store
import { DiskStore } from 'cache-manager-fs-hash';

// Cache configuration
const CACHE_VERSION = '2'; // Increment to invalidate all caches
const CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours in ms (cron runs every 24h)
const MAX_ITEMS = 100; // Prevent unbounded growth

// Initialize file-based cache using DiskStore directly
const cache = new DiskStore({
  path: './cache',
  ttl: CACHE_TTL,
  hash: true, // Use hashed filenames for better filesystem performance
  zip: false, // Don't compress files (prioritize speed over disk space)
});

// Type for versioned cache data
type VersionedData<T> = {
  version: string;
  data: T;
};

/**
 * Get or set cache with automatic handling
 * @param key Cache key
 * @param fetchFn Function to fetch data if not cached
 * @param customTTL Optional custom TTL in milliseconds
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  customTTL?: number
): Promise<T> {
  // Try to get from cache using our versioning-aware helper
  const cached = await getCached<T>(key);
  if (cached !== undefined) {
    console.log(`[Cache Manager] Hit for key: ${key}`);
    return cached;
  }

  // Cache miss - fetch and store
  console.log(`[Cache Manager] Miss for key: ${key} - fetching...`);
  const data = await fetchFn();
  await setCache(key, data, customTTL);

  return data;
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
 * Manually set cache with versioning
 */
export async function setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
  const versionedData: VersionedData<T> = {
    version: CACHE_VERSION,
    data,
  };
  await cache.set(key, versionedData, ttl || CACHE_TTL);
  console.log(`[Cache Manager] Set for key: ${key} (version: ${CACHE_VERSION})`);
}

/**
 * Clear specific cache key
 */
export async function clearCache(key: string): Promise<void> {
  await cache.del(key);
  console.log(`[Cache Manager] Cleared key: ${key}`);
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  await cache.reset();
  console.log('[Cache Manager] Cleared all cache');
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  const keys = await cache.keys();
  return {
    size: keys.length,
    maxItems: MAX_ITEMS,
    type: 'file-system',
    ttl: CACHE_TTL,
    keys: keys,
  };
}

/**
 * Force refresh cache (for cron job)
 * Bypasses cache and fetches fresh data
 */
export async function forceRefreshCache<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  console.log(`[Cache Manager] Force refreshing key: ${key}`);
  const data = await fetchFn();
  await setCache(key, data);
  return data;
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

console.log('[Cache Manager] Initialized file-based cache with TTL:', CACHE_TTL, 'ms, Max items:', MAX_ITEMS, 'Path: ./cache');
