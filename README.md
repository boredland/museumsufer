# Museumsufer Frankfurt

A Cloudflare Worker that aggregates exhibitions and events from Frankfurt's [Museumsufer](https://www.museumsufer.de) museums into a single page with date-based navigation.

**Live:** https://museumsufer.app

## Features

- Scrapes ~40 museums from museumsufer.de
- Fetches events from 15 museums via structured APIs, ~22 more via AI-assisted HTML scraping
- Enriches upcoming events with prices, images, and deep links from detail pages
- Frontend with i18n (DE/EN/FR), fuzzy search, distance sorting, calendar downloads
- RSS (`/feed.xml`) and ICS (`/feed.ics`) feeds
- Image proxy with edge caching
- Installable as a PWA with offline support
- Daily cron refresh (6am UTC) with health check GitHub Action at 8am UTC

## Tech stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Framework:** [Hono](https://hono.dev) with Zod validation
- **Database:** Cloudflare D1 (SQLite)
- **AI:** Cloudflare Workers AI (`llama-4-scout-17b`) for parsing museum websites without APIs
- **Translation:** DeepL API with D1 hash-based caching (DE → EN/FR)
- **Frontend:** Server-rendered JSX (Hono), Tailwind CSS, htmx, Fuse.js search
- **Cron:** Daily scrape at 6am UTC, health check GitHub Action at 8am UTC

## Architecture

```
src/
  index.tsx           Hono app, routes, cron handler, SSR
  routes/
    scrape.ts         Auth-protected scrape endpoints
    feeds.ts          RSS and ICS feeds
    static.ts         robots.txt, sitemap, manifest, llms.txt, OG image
  frontend.tsx        Single-page HTML with i18n, search, distance sorting
  components.tsx      Shared JSX components
  api.ts              JSON API with SWR caching and past-event filtering
  scraper.ts          Museums + exhibitions from museumsufer.de
  museum-config.ts    Museum coordinates, API endpoints, scraping config
  api-scrapers.ts     Typed parsers for each museum API format
  event-scraper.ts    Orchestrator: API-first with AI fallback, detail page enrichment
  exhibition-scraper.ts  Exhibition scraping from museum websites
  translate.ts        DeepL translation pipeline with SHA-256 caching
  i18n.ts             Translations (DE/EN/FR) and locale detection
  date.ts             dayjs-based Berlin timezone utilities
  shared.ts           Shared constants and utilities
  image-proxy.ts      Edge-cached image proxy with dynamic domain allowlist
  health-check.ts     Source health checks for all scraping endpoints
  types.ts            Env interface and data types
scripts/
  health-check.ts     CLI runner for health checks
migrations/
  *.sql               D1 schema migrations
```

## API

| Endpoint | Cache | Description |
|---|---|---|
| `GET /api/day?date=YYYY-MM-DD` | 1h SWR | Exhibitions + events for a date |
| `GET /api/exhibitions?date=YYYY-MM-DD` | 6h SWR | Active exhibitions for a date |
| `GET /api/events?date=YYYY-MM-DD` | 1h SWR | Events on a specific date |
| `GET /api/event/:id.ics` | 1h | Single event as ICS download |
| `GET /api/museums` | 24h SWR | All museums |
| `GET /feed.xml` | 1h | RSS feed (next 7 days) |
| `GET /feed.ics` | 1h | ICS calendar feed (next 7 days) |
| `GET /llms.txt` | 24h | API description for LLM agents |
| `GET /img/:encoded-url` | 7d | Proxied museum image |
| `POST /scrape` | — | Trigger museum + exhibition scrape (auth required) |
| `POST /scrape/events` | — | Trigger event scrape (auth required) |

Scrape endpoints require `Authorization: Bearer <SCRAPE_SECRET>`. The cron trigger bypasses auth.

## Event sources

### Structured APIs (15 museums)

| Museum | API type |
|---|---|
| Städel Museum | Custom JSON (`/de/api/finder`) |
| Historisches Museum Frankfurt (+ Junges Museum, Porzellan Museum) | Custom JSON (`/api/calendar`) |
| Jüdisches Museum + Museum Judengasse | TYPO3 feed.json |
| Deutsches Architekturmuseum (DAM) | Tribe Events (WP) |
| DFF – Deutsches Filminstitut & Filmmuseum | Tribe Events (WP) |
| Senckenberg Naturmuseum | WP REST + ACF |
| Museum für Kommunikation Frankfurt | My Calendar (WP) |
| Liebieghaus Skulpturensammlung | schema.org HTML |
| Museum Angewandte Kunst | Structured HTML |
| Institut für Stadtgeschichte | RSS feed |
| Dommuseum Frankfurt | TYPO3 Calendarize ICS |
| Deutsches Ledermuseum (Offenbach) | Kirby CMS HTML |
| Bibelhaus ErlebnisMuseum | Structured HTML |
| Frankfurter Kunstverein | WP HTML |
| Deutsches Romantik-Museum + Goethe-Haus | FDH CMS (two-step) |

### AI-scraped (~22 museums)

Museums with a website but no structured API. Events are extracted using Workers AI (Llama 4 Scout 17B).

Archäologisches Museum, Caricatura Museum, Eintracht Frankfurt Museum, Fotografie Forum Frankfurt, Geldmuseum der Deutschen Bundesbank, Haus der Stadtgeschichte (Offenbach), Hindemith Kabinett, Ikonenmuseum, Klingspor Museum (Offenbach), MGGU – Museum Giersch, MMK (Museum/Tower/Zollamt), MOMEM, Museum Sinclair-Haus (Bad Homburg), Portikus, SCHIRN Kunsthalle Frankfurt, Stoltze-Museum, Struwwelpeter Museum, Weltkulturen Museum

## Development

```bash
npm install

# Set up local D1
npm run db:migrate:local

# Start dev server
npm run dev

# Seed data (no auth needed locally without SCRAPE_SECRET)
curl -X POST http://localhost:8787/scrape
curl -X POST http://localhost:8787/scrape/events

# Run health checks
npm run health-check
```

## Deployment

```bash
# Create D1 database (first time only)
wrangler d1 create museumsufer-db
# Update database_id in wrangler.toml

# Run migrations
npm run db:migrate

# Set scrape auth secret
wrangler secret put SCRAPE_SECRET

# Deploy (automated on git push)
npm run deploy
```
