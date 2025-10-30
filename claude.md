# Genveje.dk - Technical Documentation

## Project Overview
Genveje.dk is a Danish web application that provides categorized shortcuts to Danish webshops using affiliate links from multiple affiliate networks (Partner-ads.com and Adtraction). The name "genveje" means "shortcuts" in Danish.

## Architecture

### Tech Stack
- **Framework**: React Router 7 with SSR (Server-Side Rendering)
- **Language**: TypeScript
- **Validation**: Zod for runtime schema validation
- **Styling**: Tailwind CSS 4 with tw-animate-css
- **UI Components**: shadcn/ui (Radix UI primitives), Lucide React icons
- **Runtime**: Node.js with @react-router/node and @react-router/serve
- **Build Tool**: Vite 7
- **Performance**: React hooks (useMemo, useCallback) for optimized rendering

### Key Features
1. **Multi-Source Affiliate Data**: Fetches and merges merchant data from Partner-ads.com (XML) and Adtraction (JSON)
2. **Runtime Type Validation**: Zod schemas validate all API responses before processing
3. **Hash-Based Category IDs**: Deterministic category IDs generated from names ensure consistent merging across sources
4. **Consistent URL Handling**: Both Partner-ads and Adtraction populate `programurl` field uniformly
5. **Three-Tier Caching System**:
   - Individual source caches (`partnerads-data`, `adtraction-data`)
   - Pre-merged cache (`merged-data`) for optimal performance
   - File-based storage with cache-manager-fs-hash
6. **Optimized Data Merging**: Pre-merged data cached by cron job, eliminating merge operations on most requests
7. **Scheduled Updates**: Node-cron jobs refresh all caches daily (sources + merged data)
8. **Robust Error Handling**: Gracefully handles partial failures with multi-level fallback strategy
9. **Performance Optimizations**:
   - Debounced search (300ms)
   - Memoized filtering and calculations
   - Component-level memoization
10. **Modern UI**: shadcn/ui components with full accessibility support

## Project Structure

```
app/
├── routes/              # Route definitions
│   └── _index.tsx      # Home page (optimized with useMemo, useCallback)
├── lib/                # Core business logic
│   ├── partnerads-api.server.ts    # Partner-ads.com API integration (XML)
│   ├── adtraction-api.server.ts    # Adtraction API integration (JSON)
│   ├── affiliate-merger.server.ts  # Merges data from both sources
│   ├── cache-manager.server.ts     # Three-tier cache management
│   ├── cron-scheduler.server.ts    # Scheduled data refresh + merge caching
│   ├── types.ts                    # TypeScript interfaces
│   └── utils.ts                    # Utility functions
├── components/         # React components
│   ├── ui/            # shadcn/ui components
│   │   ├── card.tsx   # Card component
│   │   ├── input.tsx  # Input component
│   │   ├── badge.tsx  # Badge component
│   │   ├── alert.tsx  # Alert component
│   │   ├── skeleton.tsx  # Skeleton loader
│   │   └── button.tsx # Button component
│   ├── SearchBar.tsx      # Debounced search component
│   ├── CategoryCard.tsx   # Memoized category display
│   ├── MerchantLink.tsx   # Individual merchant link
│   ├── StatsFooter.tsx    # Statistics footer
│   ├── SourceIndicator.tsx # Data source badge
│   └── LoadingState.tsx   # Skeleton loading state
├── app.css            # Global styles with theme support
├── entry.server.tsx   # Server entry point with dual cache warmup
├── root.tsx           # Root layout
└── routes.ts          # Route configuration
```

## Data Flow

1. **Initial Load (Optimized)**: Route loader uses three-tier caching:
   - **Tier 1**: Checks `'merged-data'` cache (fastest path, no merge needed)
   - **Tier 2**: If no merged cache, fetches individual sources:
     - Calls `getCachedOrFetch('partnerads-data', fetchAffiliateData)` for Partner-ads
     - Calls `getCachedOrFetch('adtraction-data', fetchAdtractionData)` for Adtraction
   - **Tier 3**: If fresh fetch fails, uses stale cache as fallback
   - Merges data only when merged cache is unavailable
   - Deduplicates merchants by URL during merge

2. **Periodic Updates (Enhanced)**: Cron job (configured in `cron-scheduler.server.ts`):
   - Runs daily at 3:00 AM
   - Refreshes `'partnerads-data'` and `'adtraction-data'` in parallel
   - **NEW**: Merges and caches result to `'merged-data'`
   - Eliminates merge operations for subsequent requests
   - Implements retry logic (3-hour delay) if refresh fails

3. **Client-Side Performance**: React optimizations in `_index.tsx`:
   - `useMemo` for filtered data (only recalculates on search/data change)
   - `useMemo` for merchant totals (only recalculates when data changes)
   - `useCallback` for search handler (prevents unnecessary re-renders)
   - Debounced search input (300ms delay reduces filtering operations)
   - Memoized `CategoryCard` components prevent unnecessary re-renders

4. **Error Recovery**: Multi-level fallback strategy:
   - If Partner-ads fails: Uses Adtraction data only
   - If Adtraction fails: Uses Partner-ads data only
   - If both fresh fetches fail: Attempts to use stale cached data
   - If merged cache exists: Uses that regardless of source failures
   - Shows user-friendly warnings with shadcn Alert component
   - Only throws error if no cache available from any tier

## Key Files

### app/routes/_index.tsx
- **Optimized** main route with performance enhancements:
  - Uses pre-merged cache for instant page loads (no merge operation)
  - Falls back to individual source fetching + merging if needed
  - `useMemo` for filtered data (only recalculates when search query or data changes)
  - `useMemo` for merchant totals (prevents unnecessary calculations)
  - `useCallback` for search handler (stable function reference)
- Component composition with shadcn/ui:
  - `SearchBar` with 300ms debouncing
  - `CategoryCard` with memoization
  - `SourceIndicator` Badge component
  - `Alert` for error messages
- Shows "no results" state when search returns empty
- Error boundary with shadcn Alert component

### app/lib/partnerads-api.server.ts
- Fetches XML feed from Partner-ads.com
- Parses XML to structured data using fast-xml-parser
- **Validates** each merchant with Zod schema (`PartnerAdsXMLMerchantSchema`)
- Generates **hash-based category IDs** using `generateCategoryId()` for consistent merging
- Groups merchants by category
- Transforms API response to internal `AffiliateData` type
- Adds `source: 'partnerads'` to merchants
- **Note**: `programurl` is populated directly from Partner-ads API

### app/lib/adtraction-api.server.ts
- Fetches JSON data from Adtraction API
- **Validates** each program with Zod schema (`AdtractionProgramSchema`)
- Filters for active programs (`status === 0`)
- Generates **hash-based category IDs** using `generateCategoryId()` for consistent merging
- **Populates `programurl`** with clean URL from Adtraction API (consistent with Partner-ads)
- Constructs tracking URLs with encoded destination
- Groups merchants by category
- Transforms API response to internal `AffiliateData` type
- Adds `source: 'adtraction'` to merchants

### app/lib/affiliate-merger.server.ts
- Merges two `AffiliateData` objects into one unified dataset
- Combines categories by normalized name (case-insensitive)
- **Simplified deduplication**: Uses `merchant.programurl` directly (no URL extraction needed)
- **No ID offset required**: Hash-based IDs ensure uniqueness automatically
- Normalizes URLs for comparison (lowercase, removes protocol/www/trailing slash)
- Skips merchants with invalid/empty URLs
- Handles null/missing data from either source gracefully
- Returns merged `AffiliateData` with latest timestamp

### app/lib/cache-manager.server.ts
- Implements file-based caching using cache-manager-fs-hash
- Provides `getCachedOrFetch()` helper for automatic cache handling
- Provides `getCached()` for checking cache without fetching
- Provides `setCache()` for manual cache updates
- Implements TTL (Time To Live) of 48 hours for cache entries
- Stores cached data in `./cache` directory as JSON files
- Uses hashed filenames for better filesystem performance
- Cache survives server restarts
- **3 cache keys**:
  - `'partnerads-data'` - Partner-ads source data
  - `'adtraction-data'` - Adtraction source data
  - `'merged-data'` - Pre-merged data (NEW - performance optimization)

### app/lib/cron-scheduler.server.ts
- Configures node-cron schedule for all cache tiers
- Runs daily at 3:00 AM to refresh data:
  1. Fetches Partner-ads and Adtraction data in parallel
  2. Merges the results
  3. Caches merged data to `'merged-data'` key (NEW)
- Implements retry logic (3-hour delay) if refresh fails
- Can be disabled in development via ENABLE_CRON env var
- Always enabled in production
- `triggerManualRefresh()` function for testing/manual cache refresh

### app/lib/types.ts
- **TypeScript interfaces** with comprehensive JSDoc documentation:
  - `Merchant`: Standardized webshop data (with required `source` field)
  - `Category`: Grouping of merchants
  - `AffiliateData`: Complete dataset with metadata
  - `PartnerAdsXMLMerchant`: Partner-ads XML response format
  - `AdtractionProgram`: Adtraction JSON response format
- **Zod schemas** for runtime validation:
  - `MerchantSchema`: Validates transformed merchant data
  - `CategorySchema`: Validates category structure
  - `AffiliateDataSchema`: Validates complete data structure
  - `PartnerAdsXMLMerchantSchema`: Validates raw Partner-ads XML data
  - `AdtractionProgramSchema`: Validates raw Adtraction JSON data
- **Helper functions**:
  - `generateCategoryId(categoryName, source)`: Creates deterministic hash-based category IDs (1-999999)
  - `extractCleanUrl(programurl, affiliatelink)`: Extracts clean URL from either field (backward compatibility)

## Environment Variables

```
PARTNER_ADS_API_KEY=your_api_key_here        # Required: Partner-ads.com API key
ADTRACTION_API_TOKEN=your_adtraction_token   # Required: Adtraction API token
ENABLE_CRON=false                            # Optional: Enable cron in dev (default: false)
```

## Data Model

### Merchant
```typescript
{
  programid: string;           // Unique identifier (string format)
  programnavn: string;         // Display name (e.g., "Zalando")
  programurl: string;          // Clean merchant URL (populated by both sources)
  affiliatelink: string;       // Affiliate tracking URL
  kategoriid: number;          // Hash-based category ID (deterministic)
  status: string;              // Approval status ('approved', 'active')
  source: 'partnerads' | 'adtraction';  // Required: source network
}
```

### Category
```typescript
{
  id: number;                  // Hash-based ID from category name (1-999999)
  name: string;                // Display name (e.g., "Mode & Tøj")
  merchants: Merchant[];       // Deduplicated merchants in category
}
```

## Development Notes

- **Server-only modules**: Files ending in `.server.ts` run only on the server
- **Multi-source architecture**: Data from Partner-ads (XML) and Adtraction (JSON)
- **Runtime validation**: Zod schemas validate all API responses before processing
  - Malformed data is skipped with warning logs
  - Prevents runtime errors from unexpected API changes
  - Type-safe transformation guaranteed
- **Hash-based category IDs**:
  - Generated deterministically using DJB2 hash algorithm
  - Same category name = same ID across all sources
  - Range: 1-999999 (ensures no conflicts)
  - Eliminates need for ID offset logic (+10000 removed)
- **Consistent URL handling**:
  - Both sources populate `programurl` with clean merchant URLs
  - Simplifies deduplication logic (no URL extraction needed)
  - Adtraction now populates `programurl` directly from API
- **Optimized caching strategy**:
  - Pre-merged cache eliminates merge operations on most requests
  - Three-tier fallback ensures reliability
  - All caches use 48-hour TTL
- **API rate limiting**: Cron job refreshes sources + merged cache daily
- **Deduplication**: Merchants deduplicated by normalized URL during merge
- **Performance optimizations**:
  - React hooks (useMemo, useCallback) prevent unnecessary re-renders
  - Debounced search reduces filtering operations
  - Component-level memoization (CategoryCard)
  - Pre-merged cache reduces server CPU usage
- **UI/UX**:
  - shadcn/ui components for consistent design
  - Loading states with Skeleton components
  - "No results" feedback
  - Accessible focus states and ARIA labels
- **SEO**: Meta tags optimized for Danish search engines
- **Accessibility**:
  - Semantic HTML with proper landmarks (header, section)
  - Keyboard navigation support
  - Focus visible states on interactive elements
  - ARIA labels for screen readers
  - Proper link relationships (noopener, noreferrer, sponsored)

## Common Tasks

### Adding a new affiliate network
1. Define TypeScript interface for raw API response in `types.ts`
2. Create Zod schema for runtime validation in `types.ts`
3. Create new API module (`app/lib/newnetwork-api.server.ts`):
   - Import Zod schema and `generateCategoryId()` from types
   - Validate raw API responses with Zod
   - Use `generateCategoryId()` for category IDs
   - Populate `programurl` with clean merchant URLs
   - Transform to standardized `AffiliateData` format
4. Add environment variable for API key/token
5. Update route loader to fetch from new source
6. Update merger logic to handle third source (if needed)
7. Update cron scheduler to refresh new source
8. Add cache warmup in entry.server.tsx

### Adding a new category
Categories are automatically created from API responses using hash-based IDs. No manual code changes needed - just ensure category names are normalized consistently.

### Adjusting cache TTL
Modify the TTL parameter in `cache-manager.server.ts` (currently 48 hours)

### Changing cron schedule
Update the cron expression in `cron-scheduler.server.ts` (currently 3:00 AM daily)

### Customizing UI
- **Components**: All UI components in `app/components/` directory
- **shadcn/ui**: Add new components with `npx shadcn@latest add [component]`
- **Styles**: Tailwind CSS 4 with custom theme in `app.css`
- **Theme**: Dark mode support via CSS variables and Tailwind
- **Layout**: Responsive grid (1 column mobile, 2 columns tablet, 3 columns desktop)
- **Icons**: Lucide React for all icons

### Component Architecture
- **Composable**: Small, focused components (SearchBar, CategoryCard, etc.)
- **Memoized**: CategoryCard uses React.memo to prevent re-renders
- **Accessible**: All components follow WCAG guidelines
- **Reusable**: Components designed for reuse across the app

## Deployment Considerations

- **Required environment variables**:
  - `PARTNER_ADS_API_KEY`: Partner-ads.com API key
  - `ADTRACTION_API_TOKEN`: Adtraction API token
- Cron jobs automatically enabled in production
- **Cache Storage**: File-based cache stored in `./cache` directory
  - **3 cache files**:
    - `partnerads-data` - Partner-ads source data
    - `adtraction-data` - Adtraction source data
    - `merged-data` - Pre-merged data (performance optimization)
  - Cache persists across server restarts
  - Ensure `./cache` directory has write permissions
  - For multi-instance deployments, consider shared filesystem or switch to Redis
  - Pre-merged cache significantly reduces server CPU usage
- The `./cache` directory is excluded from git via `.gitignore`
- **Resilience**: Application continues working if one affiliate network fails
- Docker support included (see Dockerfile)
