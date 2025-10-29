import type { Route } from "./+types/_index";
import { fetchAffiliateData } from "~/lib/affiliate-api.server";
import { getCachedOrFetch, getCached } from "~/lib/cache-manager.server";
import type { AffiliateData } from "~/lib/types";

export async function loader({}: Route.LoaderArgs) {
  console.log('[Loader] home route');

  try {
    // Use cache wrapper - automatically handles get/set
    const data = await getCachedOrFetch<AffiliateData>(
      'affiliate-data',
      fetchAffiliateData
    );

    // Check if data came from cache (by comparing if we have it in cache)
    const cached = await getCached<AffiliateData>('affiliate-data');
    const isFromCache = cached && cached.lastUpdated === data.lastUpdated;

    return {
      data,
      source: isFromCache ? 'cache' : 'api',
      error: null,
    };
  } catch (error) {
    console.error('[Loader] Error:', error);

    // Try to return cached data as fallback (even if expired)
    const cached = await getCached<AffiliateData>('affiliate-data');
    if (cached) {
      console.log('[Loader] Returning stale cached data as fallback');
      return {
        data: cached,
        source: 'cache-fallback',
        error: 'Using cached data due to API error',
      };
    }

    // No cache available, throw error
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Genveje til Danske Webshops
          </h1>
          <p className="text-center text-slate-600 dark:text-slate-400 text-lg">
            Find hurtigt vej til dine foretrukne danske online butikker
          </p>

          {/* Cache indicator (dev mode) */}
          {source && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">
              {source === 'cache' && '📦 Fra cache'}
              {source === 'api' && '🌐 Frisk data'}
              {source === 'cache-fallback' && '⚠️ Fra cache (API fejl)'}
            </p>
          )}

          {error && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {data.categories.map((category) => (
            <section
              key={category.id}
              className="break-inside-avoid bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
            >
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                {category.name}
              </h2>

              <ul className="space-y-2">
                {category.merchants.map((merchant) => (
                  <li key={merchant.programid}>
                    <a
                      href={merchant.affiliatelink + merchant.programurl}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors text-sm"
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      title={`Besøg ${merchant.programnavn}`}
                    >
                      {merchant.programnavn}
                    </a>
                  </li>
                ))}
              </ul>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {category.merchants.length} {category.merchants.length === 1 ? 'butik' : 'butikker'}
                </p>
              </div>
            </section>
          ))}
        </div>

        {/* Stats Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            I alt {data.categories.length} kategorier med{' '}
            {data.categories.reduce((sum, cat) => sum + cat.merchants.length, 0)} webshops
          </p>
          {data.lastUpdated && (
            <p className="mt-2 text-xs">
              Sidst opdateret: {new Date(data.lastUpdated).toLocaleString('da-DK')}
            </p>
          )}
        </div>
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
          Der opstod en fejl ved hentning af data fra Partner-ads.com API.
        </p>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-800 dark:text-red-200">
          {error instanceof Error ? error.message : 'Ukendt fejl'}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Prøv igen
        </button>
      </div>
    </div>
  );
}
