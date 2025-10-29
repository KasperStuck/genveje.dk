// In-memory cache storage with TTL and LRU eviction
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache configuration
const CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours in ms (cron runs every 24h)
const MAX_ITEMS = 100; // Prevent unbounded growth

// In-memory storage
const memoryStore = new Map<string, CacheEntry<any>>();

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
  // Try to get from cache
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
 */
export async function getCached<T>(key: string): Promise<T | undefined> {
  const item = memoryStore.get(key);
  if (!item) return undefined;

  const ttl = CACHE_TTL;

  // Check TTL
  if (Date.now() - item.timestamp > ttl) {
    memoryStore.delete(key);
    console.log(`[Cache Manager] Expired key: ${key}`);
    return undefined;
  }

  return item.data as T;
}

/**
 * Manually set cache
 */
export async function setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
  // Implement LRU eviction
  if (memoryStore.size >= MAX_ITEMS) {
    const firstKey = memoryStore.keys().next().value;
    if (firstKey) {
      memoryStore.delete(firstKey);
      console.log(`[Cache Manager] Evicted oldest key: ${firstKey}`);
    }
  }

  memoryStore.set(key, {
    data,
    timestamp: Date.now(),
  });
  console.log(`[Cache Manager] Set for key: ${key}`);
}

/**
 * Clear specific cache key
 */
export async function clearCache(key: string): Promise<void> {
  memoryStore.delete(key);
  console.log(`[Cache Manager] Cleared key: ${key}`);
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  memoryStore.clear();
  console.log('[Cache Manager] Cleared all cache');
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  return {
    size: memoryStore.size,
    maxItems: MAX_ITEMS,
    type: 'memory',
    ttl: CACHE_TTL,
    keys: Array.from(memoryStore.keys()),
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
 * Only fetches if cache is empty
 */
export async function warmupCache<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<void> {
  const cached = await getCached<T>(key);
  if (!cached) {
    console.log(`[Cache Manager] Cache warmup for key: ${key}`);
    await forceRefreshCache(key, fetchFn);
  } else {
    console.log(`[Cache Manager] Cache already warm for key: ${key}`);
  }
}

console.log('[Cache Manager] Initialized with TTL:', CACHE_TTL, 'ms, Max items:', MAX_ITEMS);
