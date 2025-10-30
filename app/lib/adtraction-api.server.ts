import type { AffiliateData, Category, Merchant, AdtractionProgram } from './types';
import { AdtractionProgramSchema, generateCategoryId } from './types';
import { fetchWithTimeout, fetchWithRetry, normalizeCategoryName } from './fetch-utils.server';

// Get API token from environment variable
const API_TOKEN = process.env.ADTRACTION_API_TOKEN;

if (!API_TOKEN) {
  throw new Error('ADTRACTION_API_TOKEN environment variable is required');
}

// Configuration
const API_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Fetch and parse affiliate data from Adtraction API with retry logic
 */
export async function fetchAdtractionData(): Promise<AffiliateData> {
  // Token goes in query string, parameters in JSON body
  const url = `https://api.adtraction.com/v3/partner/programs/?token=${API_TOKEN}`;

  // Request body with market filter only
  // Note: approvalStatus and status filters seem to return no results,
  // so we filter approved programs client-side instead
  const requestBody = {
    market: 'DK',
  };

  console.log('[Adtraction API] Fetching data from Adtraction...');

  // Use shared retry logic
  return fetchWithRetry(
    async () => {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        API_TIMEOUT
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();

      // Handle different response formats
      let programs: AdtractionProgram[];

      if (Array.isArray(jsonData)) {
        // Direct array response
        programs = jsonData;
      } else if (jsonData && typeof jsonData === 'object' && Array.isArray(jsonData.programs)) {
        // Wrapped response with programs array
        console.log('[Adtraction API] Extracting programs from wrapped response');
        programs = jsonData.programs;
      } else if (jsonData && typeof jsonData === 'object' && Array.isArray(jsonData.data)) {
        // Wrapped response with data array
        console.log('[Adtraction API] Extracting programs from data wrapper');
        programs = jsonData.data;
      } else {
        // Invalid response
        throw new Error(
          `Invalid API response: expected array or object with programs array. ` +
            `Got ${typeof jsonData}${
              jsonData && typeof jsonData === 'object'
                ? ` with keys: ${Object.keys(jsonData).join(', ')}`
                : ''
            }`
        );
      }

      console.log(`[Adtraction API] Found ${programs.length} total programs`);

      // Group by category
      const categoriesMap = new Map<number, Category>();
      const merchantsByCategory = new Map<number, Merchant[]>();

      let processedCount = 0;
      let skippedCount = 0;
      let validationFailures = 0;

      for (const rawProgram of programs) {
        // Validate program data with Zod schema
        const validation = AdtractionProgramSchema.safeParse(rawProgram);

        if (!validation.success) {
          console.warn('[Adtraction API] Invalid program data:', validation.error.errors);
          validationFailures++;
          continue; // Skip invalid programs
        }

        const program = validation.data;

        // Filter for active programs (status === 0)
        // Note: approvalStatus field filtering removed as API doesn't seem to support it
        if (program.status === 0) {
          // Validate required fields exist and are non-empty (note: capital URL)
          if (!program.programURL || !program.adId) {
            skippedCount++;
            continue; // Skip merchants without required URL fields
          }

          processedCount++;

          // Use a default category if none provided
          const categoryName = program.categoryName || program.category || 'Diverse';
          const normalizedCategoryName = normalizeCategoryName(categoryName);

          // Generate deterministic category ID from category name
          // This ensures consistent IDs across Partner-ads and Adtraction
          const categoryId = generateCategoryId(normalizedCategoryName, 'adtraction');

          // Store category name (normalized for consistency)
          if (!categoriesMap.has(categoryId)) {
            categoriesMap.set(categoryId, {
              id: categoryId,
              name: normalizedCategoryName,
              merchants: [],
            });
          }

          // Construct Adtraction tracking URL
          // Format: https://track.adtraction.com/t/t?a={adId}&as={programId}&t=2&url={encodedURL}
          // Note: The tracking URL is complete and includes the encoded destination URL
          const trackingUrl = `https://track.adtraction.com/t/t?a=${program.adId}&as=${program.programId}&t=2&url=${encodeURIComponent(
            program.programURL
          )}`;

          // Create merchant object
          // IMPORTANT: programurl now contains the clean URL (consistent with Partner-ads)
          const merchantObj: Merchant = {
            programid: program.programId.toString(),
            programnavn: program.programName,
            programurl: program.programURL, // Clean URL from Adtraction API
            affiliatelink: trackingUrl, // Complete tracking URL with encoded destination
            kategoriid: categoryId,
            status: 'approved',
            source: 'adtraction',
          };

          // Add to category
          if (!merchantsByCategory.has(categoryId)) {
            merchantsByCategory.set(categoryId, []);
          }
          merchantsByCategory.get(categoryId)!.push(merchantObj);
        }
      }

      console.log(`[Adtraction API] Processed ${processedCount} active programs`);
      if (validationFailures > 0) {
        console.log(`[Adtraction API] Failed validation: ${validationFailures} programs`);
      }
      if (skippedCount > 0) {
        console.log(
          `[Adtraction API] Skipped ${skippedCount} programs with missing URL fields`
        );
      }

      // Build final categories array
      const categories: Category[] = Array.from(categoriesMap.values())
        .map((category) => ({
          ...category,
          merchants: merchantsByCategory.get(category.id) || [],
        }))
        .sort((a, b) => a.id - b.id); // Sort by category ID

      console.log(`[Adtraction API] Organized into ${categories.length} categories`);

      // Success!
      return {
        categories,
        lastUpdated: Date.now(),
      };
    },
    MAX_RETRIES,
    RETRY_DELAY,
    '[Adtraction API]'
  );
}
