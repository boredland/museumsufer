# Museumsufer Frankfurt

A Cloudflare Worker that aggregates exhibitions and events from Frankfurt's [Museumsufer](https://www.museumsufer.de) museums into a single page with date-based navigation.

**Live:** https://museumsufer.jonas-strassel.de

## What it does

- Scrapes **~40 museums** from museumsufer.de (extracted from the embedded map config JSON)
- Scrapes **current exhibitions** with date ranges from the central exhibitions listing page
- Fetches **events** from 6 museums via their structured JSON APIs, and from ~32 more via AI-assisted HTML scraping
- **Enriches** events in the next 7 days with prices, images, and deep links from detail pages
- Serves a **frontend** with date navigation, museum-grouped exhibitions, calendar downloads
- Runs a **daily cron** (6am UTC) to refresh all data

## Event sources

### Via structured API (6 museums)

These museums expose JSON endpoints. Configured in [`src/museum-apis.ts`](src/museum-apis.ts), parsed in [`src/api-scrapers.ts`](src/api-scrapers.ts).

| Museum | API type | Endpoint | Data quality |
|---|---|---|---|
| Städel Museum | Custom JSON | `/de/api/finder` | Title, dates, images, URLs, sold-out status |
| Historisches Museum | Custom JSON | `/api/calendar` | Title, dates, time, isFree, images, URLs |
| Jüdisches Museum + Museum Judengasse | TYPO3 feed.json | `/besuch/feed.json` | Title, dateTime, images, detail links, location-based routing |
| DAM | Tribe Events (WP) | `/wp-json/tribe/events/v1/events` | Title, dates, cost, images, venue |
| DFF | Tribe Events (WP) | `/wp-json/tribe/events/v1/events` | Title, dates, cost, images |
| Senckenberg | WP REST + ACF | `/wp-json/wp/v2/events` | Title, ACF date fields, descriptions |

### Via AI scraping (~32 museums)

Remaining museums with a `website_url` are scraped by probing common event page paths (`/programm`, `/veranstaltungen`, etc.), stripping HTML to text, and sending it to Workers AI (`@cf/meta/llama-3.1-8b-instruct`) to extract structured events.

### Not scraped (2 museums)

- **Ikonenmuseum Frankfurt** — no website URL discovered
- **SCHIRN in Bockenheim** — duplicate entry for SCHIRN's temporary location

### Investigated but not usable as APIs

- **SCHIRN** (`/wp-json/wp/v2/offer`) — `ho_event_data` serialized as single characters, unusable
- **FKV** (`/wp-json/wp/v2/events`) — WP post date is publish date, no event date fields exposed

## Architecture

```
src/
  index.ts          Entry point: HTTP routes + cron handler
  scraper.ts        Museums + exhibitions from museumsufer.de (deterministic HTML parsing)
  museum-apis.ts    Static config of museum API endpoints
  api-scrapers.ts   Typed parsers for each API format (Tribe Events, Historisches, etc.)
  event-scraper.ts  Orchestrator: API-first with AI fallback, plus detail page enrichment
  api.ts            JSON API: /api/day, /api/exhibitions, /api/events, /api/museums
  frontend.ts       Single-page HTML with date picker and .ics calendar downloads
  types.ts          Shared TypeScript interfaces
migrations/
  0001_init.sql     D1 schema (museums, exhibitions, events)
  0002_events_unique.sql
  0003_event_detail_fields.sql
```

### Cloudflare services used

- **Workers** — compute
- **D1** — SQLite database for museums, exhibitions, events
- **Workers AI** (`@cf/meta/llama-3.1-8b-instruct`) — extract events from museum websites without APIs
- **Cron Triggers** — daily scrape at 6am UTC

## API

| Endpoint | Description |
|---|---|
| `GET /api/day?date=YYYY-MM-DD` | Exhibitions + events for a date |
| `GET /api/exhibitions?date=YYYY-MM-DD` | Active exhibitions for a date |
| `GET /api/events?date=YYYY-MM-DD` | Events on a specific date |
| `GET /api/museums` | All museums |
| `POST /scrape` | Trigger museum + exhibition scrape (requires auth) |
| `POST /scrape/events` | Trigger event scrape from museum websites (requires auth) |

Scrape endpoints require `Authorization: Bearer <SCRAPE_SECRET>`. The cron trigger bypasses auth.

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

# Deploy
npm run deploy
```
