import type { AffiliateData, Category, Merchant } from './types';

/**
 * Normalize a URL for comparison purposes
 * - Converts to lowercase
 * - Removes trailing slash
 * - Removes protocol and www prefix
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string for comparison
 *
 * @example
 * normalizeUrl("https://www.zalando.dk/") // Returns: "zalando.dk"
 * normalizeUrl("http://Zalando.dk") // Returns: "zalando.dk"
 */
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/^https?:\/\/(www\.)?/, '');
}

/**
 * Merge two AffiliateData objects into one.
 * Both inputs should already be in standardized format with:
 * - Normalized category names
 * - Hash-based category IDs (consistent across sources)
 * - Populated programurl fields (for both Partner-ads and Adtraction)
 *
 * Combines categories by name and deduplicates merchants by URL.
 *
 * @param partneradsData - Data from Partner-ads API (or null if unavailable)
 * @param adtractionData - Data from Adtraction API (or null if unavailable)
 * @returns Merged AffiliateData with deduplicated merchants
 */
export function mergeAffiliateData(
  partneradsData: AffiliateData | null,
  adtractionData: AffiliateData | null
): AffiliateData {
  const startTime = Date.now();

  // Handle edge case: both null
  if (!partneradsData && !adtractionData) {
    return {
      categories: [],
      lastUpdated: Date.now(),
    };
  }

  console.log('[Affiliate Merger] Merging Partner-ads and Adtraction data...');

  // Track stats for logging
  let totalInputMerchants = 0;
  let duplicatesRemoved = 0;

  // Create a map to combine categories by normalized name
  // Since both sources now use generateCategoryId(), categories with the same name
  // will have the same ID, making merging straightforward
  const categoryMap = new Map<string, Category>();

  // Add Partner-ads categories
  if (partneradsData) {
    for (const category of partneradsData.categories) {
      const key = category.name.toLowerCase().trim();
      totalInputMerchants += category.merchants.length;

      if (!categoryMap.has(key)) {
        // OPTIMIZED: Direct assignment instead of array spread (saves memory allocation)
        categoryMap.set(key, {
          id: category.id, // Hash-based ID from generateCategoryId()
          name: category.name,
          merchants: category.merchants,
        });
      } else {
        // Merge merchants if category already exists
        const existing = categoryMap.get(key)!;
        // OPTIMIZED: Direct push instead of spread (more efficient)
        existing.merchants.push(...category.merchants);
      }
    }
  }

  // Add Adtraction categories
  if (adtractionData) {
    for (const category of adtractionData.categories) {
      const key = category.name.toLowerCase().trim();
      totalInputMerchants += category.merchants.length;

      if (!categoryMap.has(key)) {
        // OPTIMIZED: Direct assignment instead of array spread
        categoryMap.set(key, {
          id: category.id, // Hash-based ID from generateCategoryId()
          name: category.name,
          merchants: category.merchants,
        });
      } else {
        // Merge merchants if category already exists
        const existing = categoryMap.get(key)!;
        existing.merchants.push(...category.merchants);
      }
    }
  }

  const mergeTime = Date.now() - startTime;

  // Deduplicate merchants within each category by normalized URL
  const dedupeStartTime = Date.now();

  for (const category of categoryMap.values()) {
    // OPTIMIZED: Use Map instead of Set for better performance with large datasets
    // Maps have O(1) lookup and we can store additional metadata if needed
    const seenUrls = new Map<string, boolean>();
    const uniqueMerchants: Merchant[] = [];

    for (const merchant of category.merchants) {
      // Both Partner-ads and Adtraction now populate programurl consistently
      const merchantUrl = merchant.programurl;

      // Skip merchants with no valid URL
      if (!merchantUrl || merchantUrl.trim() === '') {
        console.warn(
          `[Affiliate Merger] Skipping merchant with no URL: ${merchant.programnavn} (${merchant.source})`
        );
        continue;
      }

      const normalizedUrl = normalizeUrl(merchantUrl);

      // Skip merchants with invalid normalized URL
      if (!normalizedUrl || normalizedUrl.trim() === '') {
        console.warn(
          `[Affiliate Merger] Skipping merchant with invalid URL: ${merchant.programnavn} (${merchant.source})`
        );
        continue;
      }

      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.set(normalizedUrl, true);
        uniqueMerchants.push(merchant);
      } else {
        duplicatesRemoved++;
        // Only log duplicates in verbose mode to reduce noise
        if (process.env.VERBOSE_LOGGING === 'true') {
          console.log(
            `[Affiliate Merger] Duplicate: ${merchant.programnavn} (${merchant.source}) - ${normalizedUrl}`
          );
        }
      }
    }

    category.merchants = uniqueMerchants;
  }

  const dedupeTime = Date.now() - dedupeStartTime;

  // Convert map back to array, filter empty categories, and sort by category ID
  const sortStartTime = Date.now();
  const mergedCategories = Array.from(categoryMap.values())
    .filter(cat => cat.merchants.length > 0)
    .sort((a, b) => a.id - b.id);

  const sortTime = Date.now() - sortStartTime;
  const totalTime = Date.now() - startTime;

  const totalMerchants = mergedCategories.reduce((sum, cat) => sum + cat.merchants.length, 0);

  console.log(
    `[Affiliate Merger] Completed: ${mergedCategories.length} categories, ${totalMerchants} merchants (${duplicatesRemoved} duplicates removed)`
  );
  console.log(
    `[Affiliate Merger] Timing: merge=${mergeTime}ms, dedupe=${dedupeTime}ms, sort=${sortTime}ms, total=${totalTime}ms`
  );

  return {
    categories: mergedCategories,
    lastUpdated: Math.max(
      partneradsData?.lastUpdated || 0,
      adtractionData?.lastUpdated || 0,
      Date.now()
    ),
  };
}
