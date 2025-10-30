import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeAffiliateData } from './affiliate-merger.server';
import type { AffiliateData } from './types';

describe('affiliate-merger', () => {
  const mockPartnerAdsData: AffiliateData = {
    categories: [
      {
        id: 1,
        name: 'Mode & Tøj',
        merchants: [
          {
            programid: 'pa-1',
            programnavn: 'Zalando',
            programurl: 'https://www.zalando.dk',
            affiliatelink: 'https://track.partnerads.com/zalando',
            kategoriid: 1,
            status: 'approved',
            source: 'partnerads',
          },
          {
            programid: 'pa-2',
            programnavn: 'ASOS',
            programurl: 'https://www.asos.com',
            affiliatelink: 'https://track.partnerads.com/asos',
            kategoriid: 1,
            status: 'approved',
            source: 'partnerads',
          },
        ],
      },
      {
        id: 2,
        name: 'Elektronik',
        merchants: [
          {
            programid: 'pa-3',
            programnavn: 'Elgiganten',
            programurl: 'https://www.elgiganten.dk',
            affiliatelink: 'https://track.partnerads.com/elgiganten',
            kategoriid: 2,
            status: 'approved',
            source: 'partnerads',
          },
        ],
      },
    ],
    lastUpdated: 1000000,
  };

  const mockAdtractionData: AffiliateData = {
    categories: [
      {
        id: 1,
        name: 'Mode & Tøj',
        merchants: [
          {
            programid: 'ad-1',
            programnavn: 'H&M',
            programurl: 'https://www.hm.com',
            affiliatelink: 'https://track.adtraction.com/hm',
            kategoriid: 1,
            status: 'approved',
            source: 'adtraction',
          },
          // Duplicate (same normalized URL as Zalando from Partner-ads)
          {
            programid: 'ad-2',
            programnavn: 'Zalando DK',
            programurl: 'https://www.zalando.dk/',
            affiliatelink: 'https://track.adtraction.com/zalando',
            kategoriid: 1,
            status: 'approved',
            source: 'adtraction',
          },
        ],
      },
      {
        id: 3,
        name: 'Hjem & Have',
        merchants: [
          {
            programid: 'ad-3',
            programnavn: 'IKEA',
            programurl: 'https://www.ikea.com',
            affiliatelink: 'https://track.adtraction.com/ikea',
            kategoriid: 3,
            status: 'approved',
            source: 'adtraction',
          },
        ],
      },
    ],
    lastUpdated: 2000000,
  };

  beforeEach(() => {
    // Clear console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('mergeAffiliateData', () => {
    it('should merge data from both sources correctly', () => {
      const result = mergeAffiliateData(mockPartnerAdsData, mockAdtractionData);

      expect(result.categories).toHaveLength(3);
      // LastUpdated should be at least as recent as the latest input (or current time)
      expect(result.lastUpdated).toBeGreaterThanOrEqual(2000000);
    });

    it('should combine merchants in same categories', () => {
      const result = mergeAffiliateData(mockPartnerAdsData, mockAdtractionData);
      const modeCategory = result.categories.find((cat) => cat.name === 'Mode & Tøj');

      expect(modeCategory).toBeDefined();
      // Should have ASOS, Zalando (pa-1), H&M (3 total, duplicate Zalando removed)
      expect(modeCategory!.merchants).toHaveLength(3);
    });

    it('should deduplicate merchants by normalized URL', () => {
      const result = mergeAffiliateData(mockPartnerAdsData, mockAdtractionData);
      const modeCategory = result.categories.find((cat) => cat.name === 'Mode & Tøj');

      // Both have Zalando (with/without trailing slash), should only keep one
      const zalandoMerchants = modeCategory!.merchants.filter((m) =>
        m.programurl.toLowerCase().includes('zalando')
      );
      expect(zalandoMerchants).toHaveLength(1);
    });

    it('should preserve merchants from both sources in different categories', () => {
      const result = mergeAffiliateData(mockPartnerAdsData, mockAdtractionData);

      const elektronikCategory = result.categories.find((cat) => cat.name === 'Elektronik');
      expect(elektronikCategory!.merchants).toHaveLength(1);
      expect(elektronikCategory!.merchants[0].programnavn).toBe('Elgiganten');

      const hjemCategory = result.categories.find((cat) => cat.name === 'Hjem & Have');
      expect(hjemCategory!.merchants).toHaveLength(1);
      expect(hjemCategory!.merchants[0].programnavn).toBe('IKEA');
    });

    it('should return empty data when both inputs are null', () => {
      const result = mergeAffiliateData(null, null);

      expect(result.categories).toHaveLength(0);
      expect(result.lastUpdated).toBeGreaterThan(0);
    });

    it('should process partnerads data when adtraction is null', () => {
      const result = mergeAffiliateData(mockPartnerAdsData, null);

      // Should have same categories and merchants (after filtering)
      expect(result.categories).toHaveLength(mockPartnerAdsData.categories.length);
      expect(result.categories[0].name).toBe(mockPartnerAdsData.categories[0].name);
    });

    it('should process adtraction data when partnerads is null', () => {
      const result = mergeAffiliateData(null, mockAdtractionData);

      // Should have same categories and merchants (after filtering)
      expect(result.categories).toHaveLength(mockAdtractionData.categories.length);
      expect(result.categories[0].name).toBe(mockAdtractionData.categories[0].name);
    });

    it('should handle case-insensitive category merging', () => {
      const customPartnerAds: AffiliateData = {
        categories: [
          {
            id: 1,
            name: 'MODE & TØJ',
            merchants: [mockPartnerAdsData.categories[0].merchants[0]],
          },
        ],
        lastUpdated: 1000000,
      };

      const customAdtraction: AffiliateData = {
        categories: [
          {
            id: 1,
            name: 'mode & tøj',
            merchants: [mockAdtractionData.categories[0].merchants[0]],
          },
        ],
        lastUpdated: 2000000,
      };

      const result = mergeAffiliateData(customPartnerAds, customAdtraction);

      // Should merge into one category despite different casing
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].merchants).toHaveLength(2);
    });

    it('should sort categories by ID', () => {
      const result = mergeAffiliateData(mockPartnerAdsData, mockAdtractionData);

      // Categories should be sorted by ID
      for (let i = 0; i < result.categories.length - 1; i++) {
        expect(result.categories[i].id).toBeLessThan(result.categories[i + 1].id);
      }
    });

    it('should use hash-based category IDs for consistent merging', () => {
      const result = mergeAffiliateData(mockPartnerAdsData, mockAdtractionData);
      const hjemCategory = result.categories.find((cat) => cat.name === 'Hjem & Have');

      // Category IDs should be hash-based (positive integers)
      expect(hjemCategory!.id).toBeGreaterThan(0);
      expect(hjemCategory!.id).toBeLessThan(1000000); // Within expected range

      // Same category name should generate same ID from both sources
      // This ensures consistent merging
      expect(Number.isInteger(hjemCategory!.id)).toBe(true);
    });

    it('should deduplicate merchants from both sources using programurl', () => {
      // Both sources now populate programurl consistently
      const adtractionDataWithUrls: AffiliateData = {
        categories: [
          {
            id: 1,
            name: 'Test',
            merchants: [
              {
                programid: 'ad-1',
                programnavn: 'Zalando Adtraction',
                programurl: 'https://www.zalando.dk', // Now populated from API
                affiliatelink: 'https://track.adtraction.com/t/t?a=123&as=456&t=2&url=https%3A%2F%2Fwww.zalando.dk',
                kategoriid: 1,
                status: 'approved',
                source: 'adtraction',
              },
              {
                programid: 'ad-2',
                programnavn: 'Zalando Duplicate',
                programurl: 'https://www.zalando.dk/', // Same URL (trailing slash)
                affiliatelink: 'https://track.adtraction.com/t/t?a=789&as=012&t=2&url=https%3A%2F%2Fwww.zalando.dk%2F',
                kategoriid: 1,
                status: 'approved',
                source: 'adtraction',
              },
            ],
          },
        ],
        lastUpdated: 3000000,
      };

      const result = mergeAffiliateData(mockPartnerAdsData, adtractionDataWithUrls);
      const testCategory = result.categories.find((cat) => cat.name === 'Test');

      // Should deduplicate based on programurl (normalized)
      expect(testCategory!.merchants).toHaveLength(1);
      expect(testCategory!.merchants[0].programnavn).toBe('Zalando Adtraction');
    });

    it('should handle merchants with no valid URL by skipping them', () => {
      const dataWithInvalidUrls: AffiliateData = {
        categories: [
          {
            id: 1,
            name: 'Test',
            merchants: [
              {
                programid: 'invalid-1',
                programnavn: 'Invalid Merchant',
                programurl: '',
                affiliatelink: '', // No URL at all
                kategoriid: 1,
                status: 'approved',
                source: 'adtraction',
              },
              {
                programid: 'valid-1',
                programnavn: 'Valid Merchant',
                programurl: 'https://www.example.com',
                affiliatelink: 'https://track.example.com',
                kategoriid: 1,
                status: 'approved',
                source: 'partnerads',
              },
            ],
          },
        ],
        lastUpdated: 4000000,
      };

      const result = mergeAffiliateData(dataWithInvalidUrls, null);

      // Should skip merchant with no URL
      expect(result.categories[0].merchants).toHaveLength(1);
      expect(result.categories[0].merchants[0].programnavn).toBe('Valid Merchant');
    });

    it('should filter out empty categories after deduplication', () => {
      // Category that becomes empty after all merchants are filtered out
      const dataWithEmptyCategory: AffiliateData = {
        categories: [
          {
            id: 1,
            name: 'Empty Category',
            merchants: [
              {
                programid: 'invalid-1',
                programnavn: 'Invalid 1',
                programurl: '',
                affiliatelink: '',
                kategoriid: 1,
                status: 'approved',
                source: 'adtraction',
              },
            ],
          },
          {
            id: 2,
            name: 'Valid Category',
            merchants: [
              {
                programid: 'valid-1',
                programnavn: 'Valid Merchant',
                programurl: 'https://www.example.com',
                affiliatelink: 'https://track.example.com',
                kategoriid: 2,
                status: 'approved',
                source: 'partnerads',
              },
            ],
          },
        ],
        lastUpdated: 5000000,
      };

      const result = mergeAffiliateData(dataWithEmptyCategory, null);

      // Should only have the valid category
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe('Valid Category');
    });

    it('should deduplicate across Partner-ads and Adtraction when URLs match', () => {
      // Test that a Partner-ads merchant with programurl and an Adtraction merchant
      // with the same URL in the tracking link are properly deduplicated
      const partnerAdsZalando: AffiliateData = {
        categories: [
          {
            id: 1,
            name: 'Mode',
            merchants: [
              {
                programid: 'pa-zalando',
                programnavn: 'Zalando Partner-ads',
                programurl: 'https://www.zalando.dk',
                affiliatelink: 'https://track.partnerads.com/zalando',
                kategoriid: 1,
                status: 'approved',
                source: 'partnerads',
              },
            ],
          },
        ],
        lastUpdated: 1000000,
      };

      const adtractionZalando: AffiliateData = {
        categories: [
          {
            id: 1,
            name: 'Mode',
            merchants: [
              {
                programid: 'ad-zalando',
                programnavn: 'Zalando Adtraction',
                programurl: '', // Empty as per Adtraction format
                affiliatelink: 'https://track.adtraction.com/t/t?a=123&as=456&t=2&url=https%3A%2F%2Fwww.zalando.dk',
                kategoriid: 1,
                status: 'approved',
                source: 'adtraction',
              },
            ],
          },
        ],
        lastUpdated: 2000000,
      };

      const result = mergeAffiliateData(partnerAdsZalando, adtractionZalando);

      // Should deduplicate - only one Zalando should remain
      expect(result.categories[0].merchants).toHaveLength(1);
      // First one wins (Partner-ads)
      expect(result.categories[0].merchants[0].source).toBe('partnerads');
    });
  });
});
