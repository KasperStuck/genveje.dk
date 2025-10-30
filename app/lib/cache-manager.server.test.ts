import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AffiliateData } from './types';

/**
 * Cache manager tests
 *
 * Note: These tests verify the function contracts and behavior without mocking
 * the underlying SQLite store implementation. The actual database operations
 * are handled by @keyv/sqlite with better-sqlite3.
 *
 * We test the public API and ensure the functions work as expected.
 */

describe('cache-manager', () => {
  let cacheManager: typeof import('./cache-manager.server');

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Import the cache manager module
    cacheManager = await import('./cache-manager.server');

    // Clear all cache before each test
    await cacheManager.clearAllCache();
  });

  afterEach(async () => {
    // Clean up after tests
    await cacheManager.clearAllCache();
  });

  const mockData: AffiliateData = {
    categories: [
      {
        id: 1,
        name: 'Test Category',
        merchants: [
          {
            programid: '1',
            programnavn: 'Test Merchant',
            programurl: 'https://test.com',
            affiliatelink: 'https://affiliate.com',
            kategoriid: 1,
            status: 'approved',
            source: 'partnerads',
          },
        ],
      },
    ],
    lastUpdated: Date.now(),
  };

  describe('setCache and getCached', () => {
    it('should store and retrieve data', async () => {
      await cacheManager.setCache('test-key', mockData);

      const result = await cacheManager.getCached<AffiliateData>('test-key');
      expect(result).toEqual(mockData);
    });

    it('should return undefined for non-existent key', async () => {
      const result = await cacheManager.getCached('non-existent-key');

      expect(result).toBeUndefined();
    });
  });

  describe('getCachedOrFetch', () => {
    it('should fetch and cache data on cache miss', async () => {
      const fetchFn = vi.fn(async () => mockData);

      const result = await cacheManager.getCachedOrFetch('test-key-2', fetchFn);

      expect(fetchFn).toHaveBeenCalledOnce();
      expect(result).toEqual(mockData);

      // Verify it was cached
      const cached = await cacheManager.getCached<AffiliateData>('test-key-2');
      expect(cached).toEqual(mockData);
    });

    it('should use cached data on cache hit', async () => {
      // Pre-populate cache
      await cacheManager.setCache('test-key-3', mockData);

      const fetchFn = vi.fn(async () => mockData);
      const result = await cacheManager.getCachedOrFetch('test-key-3', fetchFn);

      // Should not call fetch function
      expect(fetchFn).not.toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should propagate errors from fetch function', async () => {
      const fetchFn = vi.fn(async () => {
        throw new Error('Fetch failed');
      });

      await expect(cacheManager.getCachedOrFetch('test-key-4', fetchFn)).rejects.toThrow(
        'Fetch failed'
      );
    });
  });

  describe('forceRefreshCache', () => {
    it('should fetch fresh data and update cache', async () => {
      const fetchFn = vi.fn(async () => mockData);

      const result = await cacheManager.forceRefreshCache('test-key-5', fetchFn);

      expect(fetchFn).toHaveBeenCalledOnce();
      expect(result).toEqual(mockData);

      // Verify it was cached
      const cached = await cacheManager.getCached<AffiliateData>('test-key-5');
      expect(cached).toEqual(mockData);
    });

    it('should overwrite existing cache', async () => {
      const oldData: AffiliateData = { ...mockData, lastUpdated: 1000 };
      const newData: AffiliateData = { ...mockData, lastUpdated: 2000 };

      await cacheManager.setCache('test-key-6', oldData);

      const fetchFn = vi.fn(async () => newData);
      await cacheManager.forceRefreshCache('test-key-6', fetchFn);

      const result = await cacheManager.getCached<AffiliateData>('test-key-6');
      expect(result?.lastUpdated).toBe(2000);
    });
  });

  describe('clearCache', () => {
    it('should remove specific cache key', async () => {
      await cacheManager.setCache('test-key-7', mockData);
      await cacheManager.clearCache('test-key-7');

      const result = await cacheManager.getCached('test-key-7');
      expect(result).toBeUndefined();
    });
  });

  describe('warmupCache', () => {
    it('should fetch data when cache is empty', async () => {
      const fetchFn = vi.fn(async () => mockData);

      await cacheManager.warmupCache('test-key-8', fetchFn);

      expect(fetchFn).toHaveBeenCalledOnce();

      // Verify it was cached
      const cached = await cacheManager.getCached<AffiliateData>('test-key-8');
      expect(cached).toEqual(mockData);
    });

    it('should not fetch data when cache exists', async () => {
      await cacheManager.setCache('test-key-9', mockData);

      const fetchFn = vi.fn(async () => mockData);
      await cacheManager.warmupCache('test-key-9', fetchFn);

      expect(fetchFn).not.toHaveBeenCalled();
    });
  });
});
