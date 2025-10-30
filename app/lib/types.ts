import { z } from 'zod';

/**
 * Standardized merchant data structure.
 * All affiliate networks must transform their data to this exact format before caching.
 *
 * @property {string} programid - Unique program identifier (converted to string from any format)
 * @property {string} programnavn - Display name of the merchant (e.g., "Zalando", "H&M")
 * @property {string} programurl - Clean merchant website URL without tracking parameters
 * @property {string} affiliatelink - Full affiliate tracking URL that generates commission
 * @property {number} kategoriid - Numeric category ID (deterministic hash-based)
 * @property {string} status - Approval status, typically 'approved' or 'active'
 * @property {'partnerads' | 'adtraction'} source - Source network identifier for debugging
 *
 * @example
 * {
 *   programid: "12345",
 *   programnavn: "Zalando DK",
 *   programurl: "https://www.zalando.dk",
 *   affiliatelink: "https://track.partner.com/...",
 *   kategoriid: 45678,
 *   status: "approved",
 *   source: "partnerads"
 * }
 */
export interface Merchant {
  programid: string;
  programnavn: string;
  programurl: string;
  affiliatelink: string;
  kategoriid: number;
  status: string;
  source: 'partnerads' | 'adtraction';
}

/**
 * Zod schema for Merchant with runtime validation
 */
export const MerchantSchema = z.object({
  programid: z.string().min(1, 'Program ID is required'),
  programnavn: z.string().min(1, 'Program name is required'),
  programurl: z.string().url('Program URL must be a valid URL'),
  affiliatelink: z.string().url('Affiliate link must be a valid URL'),
  kategoriid: z.number().int().positive('Category ID must be a positive integer'),
  status: z.string().min(1, 'Status is required'),
  source: z.enum(['partnerads', 'adtraction']),
});

/**
 * Category grouping for merchants.
 * Categories are merged by normalized name (case-insensitive).
 * Category IDs are generated deterministically from category names for consistency.
 *
 * @property {number} id - Deterministic numeric ID generated from category name hash
 * @property {string} name - Display name of the category (e.g., "Mode & Tøj", "Elektronik")
 * @property {Merchant[]} merchants - Array of deduplicated merchants in this category
 *
 * @example
 * {
 *   id: 123456,
 *   name: "Mode & Tøj",
 *   merchants: [...]
 * }
 */
export interface Category {
  id: number;
  name: string;
  merchants: Merchant[];
}

/**
 * Zod schema for Category with runtime validation
 */
export const CategorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1, 'Category name is required'),
  merchants: z.array(MerchantSchema),
});

/**
 * Complete affiliate data structure.
 * This is the standardized format that gets cached for each network.
 *
 * @property {Category[]} categories - Array of categories with their merchants
 * @property {number} lastUpdated - Unix timestamp (milliseconds) of when data was fetched
 *
 * @example
 * {
 *   categories: [...],
 *   lastUpdated: 1704067200000
 * }
 */
export interface AffiliateData {
  categories: Category[];
  lastUpdated: number;
}

/**
 * Zod schema for AffiliateData with runtime validation
 */
export const AffiliateDataSchema = z.object({
  categories: z.array(CategorySchema),
  lastUpdated: z.number().int().positive(),
});

/**
 * Raw Partner-ads XML API response format.
 * This is the structure returned by the Partner-ads API before transformation.
 *
 * @property {string} programid - Program ID from Partner-ads (string format)
 * @property {string} programnavn - Merchant name from Partner-ads
 * @property {string} programurl - Clean merchant website URL (already provided by API)
 * @property {string} affiliatelink - Partner-ads tracking URL prefix
 * @property {string} kategoriid - Category ID as string (needs parsing to number)
 * @property {string} kategorinavn - Category name from Partner-ads
 * @property {string} status - Approval status from Partner-ads
 *
 * @note Partner-ads provides clean URLs in `programurl` field
 * @note Category ID comes as string and must be converted to number
 *
 * @example
 * {
 *   programid: "12345",
 *   programnavn: "Zalando DK",
 *   programurl: "https://www.zalando.dk",
 *   affiliatelink: "https://track.partner-ads.com/...",
 *   kategoriid: "42",
 *   kategorinavn: "Mode & Tøj",
 *   status: "approved"
 * }
 */
export interface PartnerAdsXMLMerchant {
  programid: string;
  programnavn: string;
  programurl: string;
  affiliatelink: string;
  kategoriid: string;
  kategorinavn: string;
  status: string;
}

/**
 * Zod schema for PartnerAdsXMLMerchant with runtime validation
 */
export const PartnerAdsXMLMerchantSchema = z.object({
  programid: z.string().min(1),
  programnavn: z.string().min(1),
  programurl: z.string().url(),
  affiliatelink: z.string().url(),
  kategoriid: z.string().min(1),
  kategorinavn: z.string().min(1),
  status: z.string().min(1),
});

/**
 * Raw Adtraction JSON API response format.
 * This is the structure returned by the Adtraction API before transformation.
 *
 * @property {number} programId - Program ID from Adtraction (number format)
 * @property {string} programName - Merchant name from Adtraction
 * @property {string} programURL - Merchant URL (note: capital 'URL' in API response)
 * @property {string} [trackingLink] - Optional pre-built tracking link
 * @property {number} [categoryId] - Optional category ID from Adtraction
 * @property {string} [categoryName] - Optional category name (primary field)
 * @property {string} [category] - Alternative category field name (fallback)
 * @property {number} [approvalStatus] - Approval status (1 = approved)
 * @property {number} status - Program status (0 = active, 1 = inactive)
 * @property {number} [adId] - Ad ID used for constructing tracking URLs
 *
 * @note Adtraction often lacks clean URLs; must extract from tracking URL
 * @note Multiple response formats: direct array, {programs: []}, or {data: []}
 * @note Category fields are optional; use "Diverse" as fallback
 * @note Tracking URL format: https://track.adtraction.com/t/t?a={adId}&as={programId}&t=2&url={encodedURL}
 *
 * @example
 * {
 *   programId: 67890,
 *   programName: "H&M",
 *   programURL: "https://www2.hm.com",
 *   trackingLink: "https://track.adtraction.com/...",
 *   categoryId: 5,
 *   categoryName: "Fashion",
 *   approvalStatus: 1,
 *   status: 0,
 *   adId: 123
 * }
 */
export interface AdtractionProgram {
  programId: number;
  programName: string;
  programURL: string;
  trackingLink?: string;
  categoryId?: number;
  categoryName?: string;
  category?: string;
  approvalStatus?: number;
  status: number;
  adId?: number;
}

/**
 * Zod schema for AdtractionProgram with runtime validation
 * Allows flexible response formats from Adtraction API
 */
export const AdtractionProgramSchema = z.object({
  programId: z.number().int(),
  programName: z.string().min(1),
  programURL: z.string().min(1), // Not always a valid URL, so just check string
  trackingLink: z.string().optional(),
  categoryId: z.number().int().optional(),
  categoryName: z.string().optional(),
  category: z.string().optional(),
  approvalStatus: z.number().int().optional(),
  status: z.number().int(),
  adId: z.number().int().optional(),
});

/**
 * Generate a deterministic numeric category ID from category name.
 * Uses simple hash function to create consistent IDs across multiple data sources.
 *
 * @param {string} categoryName - The category name to hash
 * @param {string} source - The source network ('partnerads' or 'adtraction')
 * @returns {number} A positive integer category ID (1-999999)
 *
 * @example
 * generateCategoryId("Mode & Tøj", "partnerads") // Returns: 482156
 * generateCategoryId("Mode & Tøj", "adtraction") // Returns: 482156 (same name = same ID)
 */
export function generateCategoryId(categoryName: string, source: string): number {
  // Normalize category name for consistent hashing
  const normalized = categoryName.toLowerCase().trim();

  // Simple hash function (DJB2 algorithm)
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i); // hash * 33 + c
  }

  // Ensure positive number and reasonable range (1-999999)
  const id = Math.abs(hash) % 1000000;
  return id === 0 ? 1 : id;
}

/**
 * Extract clean merchant URL from either programurl or affiliate tracking URL.
 * Handles both Partner-ads (has clean URL) and Adtraction (URL in tracking link).
 *
 * @param {string} programurl - The clean program URL (may be empty for Adtraction)
 * @param {string} affiliatelink - The affiliate tracking URL
 * @returns {string} The extracted clean URL, or the affiliate link if extraction fails
 *
 * @example
 * // Partner-ads (has programurl)
 * extractCleanUrl("https://zalando.dk", "https://track...") // Returns: "https://zalando.dk"
 *
 * // Adtraction (programurl empty, extract from tracking)
 * extractCleanUrl("", "https://track.adtraction.com/...?url=https%3A%2F%2Fzalando.dk")
 * // Returns: "https://zalando.dk"
 */
export function extractCleanUrl(programurl: string, affiliatelink: string): string {
  // If programurl exists and is not empty, use it directly
  if (programurl && programurl.trim().length > 0) {
    return programurl;
  }

  // Try to extract URL from Adtraction tracking link
  try {
    const urlMatch = affiliatelink.match(/[?&]url=([^&]+)/);
    if (urlMatch && urlMatch[1]) {
      return decodeURIComponent(urlMatch[1]);
    }
  } catch (error) {
    console.warn('Failed to extract URL from tracking link:', error);
  }

  // Fallback: return affiliate link
  return affiliatelink;
}
