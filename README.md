# Genveje.dk

A Danish web application providing categorized shortcuts to popular Danish webshops with affiliate links from Partner-ads.com.

## About

Genveje.dk (meaning "shortcuts" in Danish) helps users quickly find and access Danish online stores organized by category. The application fetches merchant data from the Partner-ads.com affiliate network and displays them in an easy-to-navigate interface.

## Features

- 📦 **Smart Caching**: Intelligent caching system to minimize API calls and ensure fast loading
- 🔄 **Auto-refresh**: Scheduled updates to keep merchant data current
- 🌐 **SSR**: Server-side rendering for optimal performance and SEO
- 🎨 **Modern UI**: Clean, responsive design with dark mode support
- 🇩🇰 **Danish-focused**: Curated list of Danish webshops by category
- ⚡️ **Fast**: Built with React Router 7 and optimized for speed
- 🔒 **TypeScript**: Full type safety throughout the codebase

## Tech Stack

- **Framework**: React Router 7
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI**: Radix UI + Lucide Icons
- **Caching**: Keyv with SQLite (@keyv/sqlite)
- **Scheduling**: node-cron
- **API**: Partner-ads.com XML feed
- **Build**: Vite 7

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Partner-ads.com API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/genveje.dk.git
cd genveje.dk
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Add your Partner-ads.com API key to `.env`:
```env
PARTNER_ADS_API_KEY=your_api_key_here
ENABLE_CRON=false  # Set to true to enable scheduled updates in dev
```

### Development

Start the development server:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

### Type Checking

Run TypeScript type checking:

```bash
npm run typecheck
```

## Building for Production

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Deployment

### Docker Deployment

Build and run using Docker:

```bash
docker build -t genveje-dk .
docker run -p 3000:3000 -e PARTNER_ADS_API_KEY=your_key genveje-dk
```

### Supported Platforms

The containerized application can be deployed to:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway
- Any platform supporting Docker or Node.js

### Environment Variables

Required in production:
- `PARTNER_ADS_API_KEY`: Your Partner-ads.com API key
- `ENABLE_CRON`: Automatically set to `true` in production

## Project Structure

```
app/
├── routes/              # Application routes
│   └── _index.tsx      # Home page
├── lib/                # Core business logic
│   ├── partnerads-api.server.ts   # Partner-ads API integration
│   ├── cache-manager.server.ts    # Caching layer
│   ├── cron-scheduler.server.ts   # Scheduled tasks
│   └── types.ts                   # TypeScript types
├── components/         # React components
└── root.tsx           # App layout
```

## How It Works

1. **Data Fetching**: The app fetches merchant data from Partner-ads.com XML API
2. **Caching**: Data is cached to reduce API calls and improve performance
3. **Auto-refresh**: A cron job periodically updates the cache with fresh data
4. **Fallback**: If the API fails, the app serves cached data with a warning
5. **Display**: Merchants are organized by category and displayed with affiliate links

## License

This project is private and not open for public use without permission.

## Acknowledgments

- Built with [React Router](https://reactrouter.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Data provided by [Partner-ads.com](https://www.partner-ads.com/)

---

Made with ❤️ for the Danish e-commerce community
