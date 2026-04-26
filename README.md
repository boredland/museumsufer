# Museumsufer Frankfurt

A Cloudflare Worker that aggregates exhibitions and events from Frankfurt's [Museumsufer](https://www.museumsufer.de) museums into a single page with date-based navigation.

**Live:** https://museumsufer.app

## Features

- Scrapes ~40 museums from museumsufer.de
- Fetches events from 16 museums via structured APIs, ~22 more via AI-assisted HTML scraping
- Enriches upcoming events with prices, images, and deep links from detail pages
- Frontend with i18n (DE/EN/FR), fuzzy search, distance sorting, calendar downloads
- RSS (`/feed.xml`) and ICS (`/feed.ics`) feeds
- Image proxy with edge caching
- Installable as a PWA with offline support
- Daily cron refresh (6am UTC) with health check GitHub Action at 8am UTC

## Architecture

```
src/
  index.ts          HTTP routes, cron handler, SSR
  scraper.ts        Museums + exhibitions from museumsufer.de
  museum-apis.ts    Static config of museum API endpoints
  api-scrapers.ts   Typed parsers for each API format
  event-scraper.ts  Orchestrator: API-first with AI fallback, detail page enrichment
  api.ts            JSON API with SWR caching, RSS/ICS feeds, past-event filtering
  frontend.ts       Single-page HTML with i18n, search, distance sorting, .ics downloads
  i18n.ts           Translations (DE/EN/FR) and locale detection
  date.ts           dayjs-based Berlin timezone utilities
  shared.ts         Shared constants and utilities
  museum-geo.ts     Lat/lng for all museums, haversine distance
  image-proxy.ts    Edge-cached image proxy with dynamic domain allowlist
  service-worker.ts Offline PWA support
  health-check.ts   Source health checks for all scraping endpoints
  types.ts          Env interface and data types
scripts/
  health-check.ts   CLI runner for health checks
migrations/
  0001_init.sql     D1 schema (museums, exhibitions, events)
  0002_events_unique.sql
  0003_event_detail_fields.sql
  0004_event_end_time.sql
```

### Cloudflare services

- **Workers** — compute
- **D1** — SQLite database for museums, exhibitions, events
- **Workers AI** (`llama-4-scout-17b`) — extract events from websites without structured APIs
- **Cron Triggers** — daily scrape at 6am UTC
- **Cache API** — edge caching for proxied museum images (7-day TTL)

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

### Structured APIs (16 museums)

| Museum | API type |
|---|---|
| Städel Museum | Custom JSON (`/de/api/finder`) |
| Historisches Museum Frankfurt | Custom JSON (`/api/calendar`) |
| Jüdisches Museum + Museum Judengasse | TYPO3 feed.json |
| Deutsches Architekturmuseum (DAM) | Tribe Events (WP) |
| DFF – Deutsches Filminstitut & Filmmuseum | Tribe Events (WP) |
| Senckenberg Naturmuseum | WP REST + ACF |
| Museum für Kommunikation Frankfurt | My Calendar (WP) |
| Liebieghaus Skulpturensammlung | schema.org HTML |
| Museum Angewandte Kunst | Structured HTML |
| Institut für Stadtgeschichte | RSS feed |
| Dommuseum Frankfurt | TYPO3 Calendarize ICS |
| Junges Museum Frankfurt | Drupal Views HTML |
| Deutsches Ledermuseum (Offenbach) | Kirby CMS HTML |
| Bibelhaus ErlebnisMuseum | Structured HTML |
| Frankfurter Kunstverein | WP HTML |
| Deutsches Romantik-Museum + Goethe-Haus | FDH CMS (two-step) |

### AI-scraped (~22 museums)

Museums with a website but no structured API. Events are extracted using Workers AI (Llama 4 Scout 17B).

Archäologisches Museum, Caricatura Museum, Eintracht Frankfurt Museum, Fotografie Forum Frankfurt, Geldmuseum der Deutschen Bundesbank, Haus der Stadtgeschichte (Offenbach), Hindemith Kabinett, Ikonenmuseum, Klingspor Museum (Offenbach), MGGU – Museum Giersch, MMK (Museum/Tower/Zollamt), MOMEM, Museum Sinclair-Haus (Bad Homburg), Portikus, Porzellan Museum Frankfurt, SCHIRN Kunsthalle Frankfurt, Stoltze-Museum, Struwwelpeter Museum, Weltkulturen Museum

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
