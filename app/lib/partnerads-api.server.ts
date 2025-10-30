import { XMLParser } from 'fast-xml-parser';
import type { AffiliateData, Category, Merchant, PartnerAdsXMLMerchant } from './types';
import { PartnerAdsXMLMerchantSchema, generateCategoryId } from './types';
import { fetchWithTimeout, fetchWithRetry, normalizeCategoryName } from './fetch-utils.server';

// Get API key from environment variable
const API_KEY = process.env.PARTNER_ADS_API_KEY;

if (!API_KEY) {
  throw new Error('PARTNER_ADS_API_KEY environment variable is required');
}

// Configuration
const API_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// XML Parser configuration
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

/**
 * Fetch and parse affiliate data from Partner-ads.com API with retry logic
 */
export async function fetchPartnerAdsData(): Promise<AffiliateData> {
  // Use HTTPS for security
  const url = `https://www.partner-ads.com/dk/programoversigt_xml.php?key=${API_KEY}&godkendte=1`;

  console.log('[Partner-ads API] Fetching data from Partner-ads.com...');

  // Use shared retry logic
  return fetchWithRetry(
    async () => {
      const response = await fetchWithTimeout(url, {}, API_TIMEOUT);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlText = await response.text();

      // Validate XML is not empty
      if (!xmlText || xmlText.trim().length === 0) {
        throw new Error('Empty response from API');
      }

      const parsed = parser.parse(xmlText);

      // Validate XML structure
      if (!parsed.programs) {
        throw new Error('Invalid XML structure: missing programs element');
      }

      // Extract merchants from XML structure
      const merchants = parsed.programs?.program || [];

      // Ensure merchants is an array (XML parser might return single object)
      const merchantArray: PartnerAdsXMLMerchant[] = Array.isArray(merchants)
        ? merchants
        : [merchants];

      console.log(`[Partner-ads API] Found ${merchantArray.length} total merchants`);

      // Group by category
      const categoriesMap = new Map<number, Category>();
      const merchantsByCategory = new Map<number, Merchant[]>();

      let processedCount = 0;
      let skippedCount = 0;
      let validationFailures = 0;

      for (const rawMerchant of merchantArray) {
        // Validate merchant data with Zod schema
        const validation = PartnerAdsXMLMerchantSchema.safeParse(rawMerchant);

        if (!validation.success) {
          console.warn('[Partner-ads API] Invalid merchant data:', validation.error.errors);
          validationFailures++;
          continue; // Skip invalid merchants
        }

        const merchant = validation.data;

        // Filter: only approved merchants with valid program ID
        if (merchant.programid !== 'N/A' && merchant.status === 'approved') {
          // Validate required fields exist and are non-empty
          if (!merchant.programurl || !merchant.affiliatelink) {
            skippedCount++;
            continue; // Skip merchants without required URL fields
          }

          processedCount++;

          // Generate deterministic category ID from category name
          // This ensures consistent IDs across Partner-ads and Adtraction
          const normalizedCategoryName = normalizeCategoryName(merchant.kategorinavn);
          const categoryId = generateCategoryId(normalizedCategoryName, 'partnerads');

          // Store category name (normalized for consistency)
          if (!categoriesMap.has(categoryId)) {
            categoriesMap.set(categoryId, {
              id: categoryId,
              name: normalizedCategoryName,
              merchants: [],
            });
          }

          // Create merchant object
          const merchantObj: Merchant = {
            programid: merchant.programid,
            programnavn: merchant.programnavn,
            programurl: merchant.programurl,
            affiliatelink: merchant.affiliatelink,
            kategoriid: categoryId,
            status: merchant.status,
            source: 'partnerads',
          };

          // Add to category
          if (!merchantsByCategory.has(categoryId)) {
            merchantsByCategory.set(categoryId, []);
          }
          merchantsByCategory.get(categoryId)!.push(merchantObj);
        } else {
          // Track merchants that don't meet approval criteria
          skippedCount++;
        }
      }

      console.log(`[Partner-ads API] Processed ${processedCount} approved merchants`);
      if (validationFailures > 0) {
        console.log(`[Partner-ads API] Failed validation: ${validationFailures} merchants`);
      }
      if (skippedCount > 0) {
        console.log(
          `[Partner-ads API] Skipped ${skippedCount} merchants with missing URL fields`
        );
      }

      // Build final categories array
      const categories: Category[] = Array.from(categoriesMap.values())
        .map((category) => ({
          ...category,
          merchants: merchantsByCategory.get(category.id) || [],
        }))
        .sort((a, b) => a.id - b.id); // Sort by category ID

      console.log(`[Partner-ads API] Organized into ${categories.length} categories`);

      // Success!
      return {
        categories,
        lastUpdated: Date.now(),
      };
    },
    MAX_RETRIES,
    RETRY_DELAY,
    '[Partner-ads API]'
  );
}
