import { XMLParser } from 'fast-xml-parser';
import type { AffiliateData, Category, Merchant, PartnerAdsXMLMerchant } from './types';

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
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch and parse affiliate data from Partner-ads.com API with retry logic
 */
export async function fetchAffiliateData(): Promise<AffiliateData> {
  // Use HTTPS for security
  const url = `https://www.partner-ads.com/dk/programoversigt_xml.php?key=${API_KEY}&godkendte=1`;

  console.log('[Affiliate API] Fetching data from Partner-ads.com...');

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Affiliate API] Attempt ${attempt}/${MAX_RETRIES}`);

      const response = await fetchWithTimeout(url, API_TIMEOUT);

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
    const merchantArray: PartnerAdsXMLMerchant[] = Array.isArray(merchants) ? merchants : [merchants];

    console.log(`[Affiliate API] Found ${merchantArray.length} total merchants`);

    // Group by category
    const categoriesMap = new Map<number, Category>();
    const merchantsByCategory = new Map<number, Merchant[]>();

    let approvedCount = 0;

    for (const merchant of merchantArray) {
      // Filter: only approved merchants with valid program ID
      if (merchant.programid !== 'N/A' && merchant.status === 'approved') {
        approvedCount++;

        const categoryId = parseInt(merchant.kategoriid, 10);

        // Store category name
        if (!categoriesMap.has(categoryId)) {
          categoriesMap.set(categoryId, {
            id: categoryId,
            name: merchant.kategorinavn,
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
        };

        // Add to category
        if (!merchantsByCategory.has(categoryId)) {
          merchantsByCategory.set(categoryId, []);
        }
        merchantsByCategory.get(categoryId)!.push(merchantObj);
      }
    }

    console.log(`[Affiliate API] Filtered to ${approvedCount} approved merchants`);

    // Build final categories array
    const categories: Category[] = Array.from(categoriesMap.values())
      .map((category) => ({
        ...category,
        merchants: merchantsByCategory.get(category.id) || [],
      }))
      .sort((a, b) => a.id - b.id); // Sort by category ID

      console.log(`[Affiliate API] Organized into ${categories.length} categories`);

      // Success!
      return {
        categories,
        lastUpdated: Date.now(),
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`[Affiliate API] Attempt ${attempt} failed:`, lastError.message);

      // If not the last attempt, wait before retrying with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`[Affiliate API] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries failed
  throw new Error(
    `Failed to fetch affiliate data after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`
  );
}
