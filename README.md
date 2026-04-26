# Museumsufer Frankfurt

A Cloudflare Worker that aggregates exhibitions and events from Frankfurt's [Museumsufer](https://www.museumsufer.de) museums into a single page with date-based navigation.

**Live:** https://museumsufer.app

## What it does

- Scrapes **~40 museums** from museumsufer.de (extracted from the embedded map config JSON)
- Scrapes **current exhibitions** with date ranges from the central exhibitions listing page
- Fetches **events** from 12 museums via structured APIs, and from ~26 more via AI-assisted HTML scraping
- **Enriches** events in the next 7 days with prices, images, and deep links from detail pages
- Serves a **frontend** with i18n (DE/EN/FR), fuzzy search (Fuse.js), distance sorting, calendar downloads
- Provides **RSS** (`/feed.xml`) and **ICS** (`/feed.ics`) feeds for the next 7 days
- **Image proxy** caches all museum images at the CF edge for resilience
- Installable as a **PWA** with offline support via service worker
- Runs a **daily cron** (6am UTC) to refresh all data, with a **health check** GitHub Action at 8am UTC

## Museums & event sources

### Structured API (12 museums)

| Museum | Website | API type | Endpoint |
|---|---|---|---|
| Städel Museum | staedelmuseum.de | Custom JSON | `/de/api/finder` |
| Historisches Museum Frankfurt | historisches-museum-frankfurt.de | Custom JSON | `/api/calendar` |
| Jüdisches Museum + Museum Judengasse | juedischesmuseum.de | TYPO3 feed.json | `/besuch/feed.json?records[uid]=329` |
| Deutsches Architekturmuseum (DAM) | dam-online.de | Tribe Events (WP) | `/wp-json/tribe/events/v1/events` |
| DFF – Deutsches Filminstitut & Filmmuseum | dff.film | Tribe Events (WP) | `/wp-json/tribe/events/v1/events` |
| Senckenberg Naturmuseum | museumfrankfurt.senckenberg.de | WP REST + ACF | `/wp-json/wp/v2/events` |
| Museum für Kommunikation Frankfurt | mfk-frankfurt.de | My Calendar (WP) | `/wp-json/my-calendar/v1/events` |
| Liebieghaus Skulpturensammlung | liebieghaus.de | schema.org HTML | `/de/kalender` (parsed via regex) |
| Museum Angewandte Kunst | museumangewandtekunst.de | Structured HTML | `/de/kalender/` (mak-event-item elements) |
| Institut für Stadtgeschichte | stadtgeschichte-ffm.de | RSS feed | `/rss/isg_rss.php` |
| Dommuseum Frankfurt | dommuseum-frankfurt.de | TYPO3 Calendarize ICS | `/besuchen/kalender` (per-event ICS files) |
| Junges Museum Frankfurt | junges-museum-frankfurt.de | Drupal Views HTML | `/kalender` (h2/h3 structure with dates) |

### AI-scraped (~26 museums)

These museums have a `website_url` but no structured API. Events are extracted by fetching their program page and using Workers AI (Llama 4 Scout 17B).

| Museum | Website | Notes |
|---|---|---|
| Archäologisches Museum Frankfurt | archaeologisches-museum-frankfurt.de | Joomla, no feeds |
| Bibelhaus ErlebnisMuseum | bibelhaus-frankfurt.de | |
| Caricatura Museum Frankfurt | caricatura-museum.de | REDAXO CMS, no feeds |
| Deutsches Ledermuseum (Offenbach) | ledermuseum.de | |
| Deutsches Romantik-Museum | deutsches-romantik-museum.de | |
| Eintracht Frankfurt Museum | museum.eintracht.de | Gatsby, RSS is news only |
| Fotografie Forum Frankfurt | fffrankfurt.org | |
| Frankfurter Goethe-Haus | goethehaus-frankfurt.de | |
| Frankfurter Kunstverein | fkv.de | WP, but no event date fields exposed |
| Geldmuseum der Deutschen Bundesbank | bundesbank.de/geldmuseum | RSS is institutional press only |
| Haus der Stadtgeschichte (Offenbach) | haus-der-stadtgeschichte.de | |
| Hindemith Kabinett | hindemith.info/de/kabinett | |
| Ikonenmuseum Frankfurt | museumangewandtekunst.de | Managed by Museum Angewandte Kunst |
| Klingspor Museum (Offenbach) | klingspormuseum.de | |
| MGGU – Museum Giersch | mggu.de | |
| MMK (Museum, Tower, Zollamt) | mmk.art | Nuxt.js SPA, CMS has no events endpoint |
| MOMEM | momem.org | |
| Museum Sinclair-Haus (Bad Homburg) | museum-sinclair-haus.de | |
| Portikus | portikus.de | |
| Porzellan Museum Frankfurt | porzellan-museum-frankfurt.de | |
| SCHIRN Kunsthalle Frankfurt | schirn.de | WP API exists but event data corrupted |
| Stoltze-Museum | frankfurter-sparkasse.de | |
| Struwwelpeter Museum | struwwelpeter-museum.de | |
| Weltkulturen Museum | weltkulturenmuseum.de | Domain changed from weltkulturen-museum.de |

### No event source (1 museum)

| Museum | Reason |
|---|---|
| SCHIRN in Bockenheim | Duplicate entry for SCHIRN's temporary location, no own website |

## Architecture

```
src/
  index.ts          Entry point: HTTP routes, cron handler, SSR with inline data
  scraper.ts        Museums + exhibitions from museumsufer.de (deterministic HTML parsing)
  museum-apis.ts    Static config of museum API endpoints
  api-scrapers.ts   Typed parsers for each API format (11 museum APIs)
  event-scraper.ts  Orchestrator: API-first with AI fallback, plus detail page enrichment
  api.ts            JSON API with SWR caching, RSS/ICS feeds, past-event filtering
  frontend.ts       Single-page HTML with i18n, Fuse.js search, distance sorting, .ics downloads
  i18n.ts           Translations (DE/EN/FR) and locale detection
  date.ts           dayjs-based Berlin timezone utilities
  shared.ts         Shared constants and utilities (stripHtml, escHtml, normalizeUrl, etc.)
  museum-geo.ts     Lat/lng for all museums, haversine distance with river-side awareness
  image-proxy.ts    Edge-cached image proxy with dynamic domain allowlist from DB
  service-worker.ts Offline PWA support (network-first for pages/API, cache-first for images)
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

### Cloudflare services used

- **Workers** — compute
- **D1** — SQLite database for museums, exhibitions, events
- **Workers AI** (`@cf/meta/llama-4-scout-17b-16e-instruct`) — extract events from museum websites without APIs
- **Cron Triggers** — daily scrape at 6am UTC
- **Cache API** — edge caching for proxied museum images (7-day TTL)

## API

| Endpoint | Cache | Description |
|---|---|---|
| `GET /api/day?date=YYYY-MM-DD` | 1h (SWR) | Exhibitions + events for a date |
| `GET /api/exhibitions?date=YYYY-MM-DD` | 6h (SWR) | Active exhibitions for a date |
| `GET /api/events?date=YYYY-MM-DD` | 1h (SWR) | Events on a specific date |
| `GET /api/event/:id.ics` | 1h | Single event as ICS download |
| `GET /api/museums` | 24h (SWR) | All museums |
| `GET /feed.xml` | 1h | RSS feed (next 7 days) |
| `GET /feed.ics` | 1h | ICS calendar feed (next 7 days) |
| `GET /llms.txt` | 24h | API description for LLM agents |
| `GET /img/:encoded-url` | 7d | Proxied museum image |
| `POST /scrape` | — | Trigger museum + exhibition scrape (auth required) |
| `POST /scrape/events` | — | Trigger event scrape (auth required) |

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
