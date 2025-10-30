import { useState, useMemo, useCallback } from "react";
import type { Route } from "./+types/_index";
import type { AffiliateData } from "~/lib/types";
import { SearchBar } from "~/components/SearchBar";
import { CategoryCard } from "~/components/CategoryCard";
import { StatsFooter } from "~/components/StatsFooter";
import { SourceIndicator } from "~/components/SourceIndicator";
import { Alert, AlertDescription } from "~/components/ui/alert";

export async function loader({}: Route.LoaderArgs) {
  // Import server-only modules inside the loader to avoid bundling issues
  const { fetchPartnerAdsData } = await import("~/lib/partnerads-api.server");
  const { fetchAdtractionData } = await import("~/lib/adtraction-api.server");
  const { mergeAffiliateData } = await import("~/lib/affiliate-merger.server");
  const { getCachedIgnoreVersion, getCachedOrFetchStale, CACHE_KEYS } = await import("~/lib/cache-manager.server");

  /**
   * Helper to fetch a single source with stale fallback
   */
  async function fetchSourceWithFallback(
    key: string,
    fetchFn: () => Promise<AffiliateData>,
    sourceName: string
  ): Promise<{ data: AffiliateData | null; error: Error | null }> {
    try {
      // Use stale-while-revalidate pattern for better performance
      const data = await getCachedOrFetchStale<AffiliateData>(key, fetchFn);
      return { data, error: null };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(`${sourceName} fetch failed`);
      console.error(`[Loader] ${sourceName} error:`, err.message, err.stack);

      // Try stale cache as last resort
      const staleData = await getCachedIgnoreVersion<AffiliateData>(key);
      if (staleData) {
        console.log(`[Loader] Using stale ${sourceName} cache as fallback`);
        return { data: staleData, error: null };
      }

      return { data: null, error: err };
    }
  }

  try {
    // Fetch both sources in parallel with fallback handling
    // Note: getCachedOrFetchStale already has request deduplication built-in
    const [partneradsResult, adtractionResult] = await Promise.all([
      fetchSourceWithFallback(CACHE_KEYS.PARTNERADS, fetchPartnerAdsData, 'Partner-ads'),
      fetchSourceWithFallback(CACHE_KEYS.ADTRACTION, fetchAdtractionData, 'Adtraction'),
    ]);

    const { data: partneradsData, error: partneradsError } = partneradsResult;
    const { data: adtractionData, error: adtractionError } = adtractionResult;

    // If both sources failed, throw error
    if (!partneradsData && !adtractionData) {
      throw new Response('Failed to load affiliate data from all sources', {
        status: 500,
        statusText: 'Both Partner-ads and Adtraction APIs failed',
      });
    }

    // Merge the data on demand
    const mergedData = mergeAffiliateData(partneradsData, adtractionData);

    // Determine source indicator
    let source = 'api';
    if (partneradsData && adtractionData) {
      source = 'both-apis';
    } else if (partneradsData) {
      source = 'partnerads-only';
    } else if (adtractionData) {
      source = 'adtraction-only';
    }

    // Build error message if any source failed
    let errorMessage: string | null = null;
    if (partneradsError && !adtractionError) {
      errorMessage = 'Partner-ads unavailable, showing Adtraction data only';
    } else if (adtractionError && !partneradsError) {
      errorMessage = 'Adtraction unavailable, showing Partner-ads data only';
    } else if (partneradsError && adtractionError) {
      errorMessage = 'Both sources temporarily unavailable, showing cached data';
    }

    return {
      data: mergedData,
      source,
      error: errorMessage,
    };
  } catch (error) {
    console.error('[Loader] Critical error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Last resort: try any cached data (even stale/mismatched version)
    const partneradsCache = await getCachedIgnoreVersion<AffiliateData>('partnerads-data');
    const adtractionCache = await getCachedIgnoreVersion<AffiliateData>('adtraction-data');

    if (partneradsCache || adtractionCache) {
      console.log('[Loader] Returning any available cached data as last resort');
      const mergedData = mergeAffiliateData(partneradsCache || null, adtractionCache || null);
      return {
        data: mergedData,
        source: 'cache-fallback',
        error: 'Using cached data due to API errors',
      };
    }

    // No cache available at all, throw error
    throw new Response('Failed to load affiliate data', {
      status: 500,
      statusText: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Genveje til Danske Webshops | Genveje.dk" },
    {
      name: "description",
      content: "Find genveje til de mest populære danske webshops organiseret efter kategori. Hurtig adgang til mode, elektronik, hjem, sport og meget mere."
    },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { data, source, error } = loaderData;
  const [searchQuery, setSearchQuery] = useState("");

  // Memoize search query handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // Memoize total merchants calculation (only depends on data)
  const totalMerchants = useMemo(() => {
    return data.categories.reduce((sum, cat) => sum + cat.merchants.length, 0);
  }, [data.categories]);

  // Memoize filtered data (only recalculates when search query or data changes)
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }

    const lowercaseQuery = searchQuery.toLowerCase();
    return {
      ...data,
      categories: data.categories.map(category => ({
        ...category,
        merchants: category.merchants.filter(merchant =>
          merchant.programnavn.toLowerCase().includes(lowercaseQuery)
        )
      }))
    };
  }, [data, searchQuery]);

  // Memoize filtered merchants count
  const filteredMerchants = useMemo(() => {
    return filteredData.categories.reduce((sum, cat) => sum + cat.merchants.length, 0);
  }, [filteredData.categories]);

  // Memoize original category counts lookup Map for O(1) access
  const originalCountMap = useMemo(() => {
    return new Map(data.categories.map(cat => [cat.id, cat.merchants.length]));
  }, [data.categories]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="mb-8 md:mb-12">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/img/genveje-logo.png"
              alt="Genveje.dk logo"
              className="h-16 md:h-20 lg:h-24 w-auto"
              loading="eager"
            />
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Genveje til Danske Webshops
          </h1>
          <p className="text-center text-slate-600 dark:text-slate-400 text-lg">
            Find hurtigt vej til dine foretrukne danske online butikker
          </p>

          {/* Search field */}
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Søg efter butik..."
          />

          {/* Source indicator */}
          {source && (
            <div className="flex justify-center mt-3">
              <SourceIndicator source={source} />
            </div>
          )}

          {/* Error alert */}
          {error && (
            <Alert variant="destructive" className="mt-4 max-w-2xl mx-auto">
              <AlertDescription className="text-center">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </header>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredData.categories
            .filter(category => category.merchants.length > 0)
            .map((category) => {
              const originalCount = originalCountMap.get(category.id) || 0;

              return (
                <CategoryCard
                  key={category.id}
                  category={category}
                  originalCount={originalCount}
                  searchQuery={searchQuery}
                />
              );
            })}
        </div>

        {/* No results message */}
        {searchQuery && filteredMerchants === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-2">
              Ingen resultater fundet for "{searchQuery}"
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Prøv et andet søgeord
            </p>
          </div>
        )}

        {/* Stats Footer */}
        <StatsFooter
          totalCategories={data.categories.length}
          totalMerchants={totalMerchants}
          filteredMerchants={filteredMerchants}
          searchQuery={searchQuery}
          lastUpdated={data.lastUpdated}
        />
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
          Fejl ved indlæsning
        </h1>
        <p className="text-slate-700 dark:text-slate-300 mb-4">
          Der opstod en fejl ved hentning af data fra affiliate netværk.
        </p>
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : 'Ukendt fejl'}
          </AlertDescription>
        </Alert>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Prøv igen
        </button>
      </div>
    </div>
  );
}
