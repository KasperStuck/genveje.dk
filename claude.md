# Genveje.dk - Technical Documentation

## Project Overview
Genveje.dk is a Danish web application that provides categorized shortcuts to Danish webshops using affiliate links from Partner-ads.com. The name "genveje" means "shortcuts" in Danish.

## Architecture

### Tech Stack
- **Framework**: React Router 7 with SSR (Server-Side Rendering)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 with tw-animate-css
- **UI Components**: Radix UI primitives, Lucide React icons
- **Runtime**: Node.js with @react-router/node and @react-router/serve
- **Build Tool**: Vite 7

### Key Features
1. **Affiliate Data Management**: Fetches merchant data from Partner-ads.com XML API
2. **Caching System**: Uses cache-manager to reduce API calls and improve performance
3. **Scheduled Updates**: Node-cron jobs to refresh data periodically
4. **Error Handling**: Fallback to cached data when API fails

## Project Structure

```
app/
├── routes/              # Route definitions
│   └── _index.tsx      # Home page with merchant listings
├── lib/                # Core business logic
│   ├── affiliate-api.server.ts    # Partner-ads.com API integration
│   ├── cache-manager.server.ts    # Cache wrapper functions
│   ├── cron-scheduler.server.ts   # Scheduled data refresh
│   ├── types.ts                   # TypeScript interfaces
│   └── utils.ts                   # Utility functions
├── components/         # React components
├── app.css            # Global styles
├── entry.server.tsx   # Server entry point
├── root.tsx           # Root layout
└── routes.ts          # Route configuration
```

## Data Flow

1. **Initial Load**: Route loader calls `getCachedOrFetch()` which:
   - Checks cache for existing data
   - If cache miss or expired, fetches from Partner-ads.com API
   - Stores result in cache with TTL

2. **Periodic Updates**: Cron job (configured in `cron-scheduler.server.ts`):
   - Runs on schedule to refresh data
   - Updates cache proactively
   - Prevents cache misses during user requests

3. **Error Recovery**: If API fails:
   - Attempts to return cached data (even if expired)
   - Shows warning to user about stale data
   - Only throws error if no cache available

## Key Files

### app/routes/_index.tsx
- Main route displaying categorized merchant links
- Implements loader with cache-first strategy
- Shows cache status indicators in development
- Error boundary for graceful degradation

### app/lib/affiliate-api.server.ts
- Fetches XML feed from Partner-ads.com
- Parses XML to structured data
- Groups merchants by category
- Transforms API response to internal types

### app/lib/cache-manager.server.ts
- Wrapper around cache-manager library
- Provides `getCachedOrFetch()` helper
- Implements TTL (Time To Live) for cache entries
- Handles cache get/set operations

### app/lib/cron-scheduler.server.ts
- Configures node-cron schedule
- Triggers data refresh at intervals
- Can be disabled in development via ENABLE_CRON env var
- Always enabled in production

### app/lib/types.ts
- TypeScript interfaces for type safety:
  - `Merchant`: Individual webshop data
  - `Category`: Grouping of merchants
  - `AffiliateData`: Complete dataset with metadata
  - `PartnerAdsXMLMerchant`: Raw API response format

## Environment Variables

```
PARTNER_ADS_API_KEY=your_api_key_here  # Required: Partner-ads.com API key
ENABLE_CRON=false                       # Optional: Enable cron in dev (default: false)
```

## Data Model

### Merchant
```typescript
{
  programid: string;        // Unique identifier
  programnavn: string;      // Display name (e.g., "Zalando")
  programurl: string;       // Merchant URL
  affiliatelink: string;    // Affiliate tracking URL
  kategoriid: number;       // Category reference
  status: string;           // Active/inactive status
}
```

### Category
```typescript
{
  id: number;               // Unique identifier
  name: string;             // Display name (e.g., "Mode & Tøj")
  merchants: Merchant[];    // Array of merchants in category
}
```

## Development Notes

- **Server-only modules**: Files ending in `.server.ts` run only on the server
- **Caching strategy**: Cache-first with stale-while-revalidate pattern
- **API rate limiting**: Cron job prevents excessive API calls
- **SEO**: Meta tags optimized for Danish search engines
- **Accessibility**: Semantic HTML, proper link relationships (noopener, noreferrer, sponsored)

## Common Tasks

### Adding a new category
Categories are automatically created from Partner-ads.com API response. No code changes needed.

### Adjusting cache TTL
Modify the TTL parameter in `cache-manager.server.ts`

### Changing cron schedule
Update the cron expression in `cron-scheduler.server.ts`

### Customizing UI
- Styles: Tailwind classes in `_index.tsx`
- Theme: Dark mode support via Tailwind
- Layout: Grid responsive breakpoints (md, lg)

## Deployment Considerations

- Requires `PARTNER_ADS_API_KEY` environment variable
- Cron jobs automatically enabled in production
- Cache persists in memory (consider Redis for multi-instance deployments)
- Docker support included (see Dockerfile)
