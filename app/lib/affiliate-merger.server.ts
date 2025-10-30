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
  // Handle edge case: both null
  if (!partneradsData && !adtractionData) {
    return {
      categories: [],
      lastUpdated: Date.now(),
    };
  }

  console.log('[Affiliate Merger] Merging Partner-ads and Adtraction data...');

  // Create a map to combine categories by normalized name
  // Since both sources now use generateCategoryId(), categories with the same name
  // will have the same ID, making merging straightforward
  const categoryMap = new Map<string, Category>();

  // Add Partner-ads categories
  if (partneradsData) {
    for (const category of partneradsData.categories) {
      const key = category.name.toLowerCase().trim();
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          id: category.id, // Hash-based ID from generateCategoryId()
          name: category.name,
          merchants: [...category.merchants],
        });
      } else {
        // Merge merchants if category already exists
        const existing = categoryMap.get(key)!;
        existing.merchants.push(...category.merchants);
      }
    }
  }

  // Add Adtraction categories
  if (adtractionData) {
    for (const category of adtractionData.categories) {
      const key = category.name.toLowerCase().trim();
      if (!categoryMap.has(key)) {
        // No ID offset needed - generateCategoryId() ensures consistent IDs
        categoryMap.set(key, {
          id: category.id, // Hash-based ID from generateCategoryId()
          name: category.name,
          merchants: [...category.merchants],
        });
      } else {
        // Merge merchants if category already exists
        const existing = categoryMap.get(key)!;
        existing.merchants.push(...category.merchants);
      }
    }
  }

  // Deduplicate merchants within each category by normalized URL
  for (const category of categoryMap.values()) {
    const seenUrls = new Set<string>();
    const uniqueMerchants: Merchant[] = [];

    for (const merchant of category.merchants) {
      // Both Partner-ads and Adtraction now populate programurl consistently
      const merchantUrl = merchant.programurl;
      const normalizedUrl = normalizeUrl(merchantUrl);

      // Skip merchants with no valid URL
      if (!normalizedUrl || normalizedUrl.trim() === '') {
        console.warn(
          `[Affiliate Merger] Skipping merchant with no URL: ${merchant.programnavn} (${merchant.source})`
        );
        continue;
      }

      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueMerchants.push(merchant);
      } else {
        console.log(
          `[Affiliate Merger] Duplicate merchant found: ${merchant.programnavn} (${merchant.source}) - URL: ${normalizedUrl}`
        );
      }
    }

    category.merchants = uniqueMerchants;
  }

  // Convert map back to array, filter empty categories, and sort by category ID
  const mergedCategories = Array.from(categoryMap.values())
    .filter(cat => cat.merchants.length > 0)
    .sort((a, b) => a.id - b.id);

  const totalMerchants = mergedCategories.reduce((sum, cat) => sum + cat.merchants.length, 0);

  console.log(
    `[Affiliate Merger] Merged into ${mergedCategories.length} categories with ${totalMerchants} unique merchants`
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
