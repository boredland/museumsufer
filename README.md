# Museumsufer Frankfurt

A Cloudflare Worker that aggregates exhibitions and events from Frankfurt's [Museumsufer](https://www.museumsufer.de) museums into a single page with date-based navigation.

**Live:** https://museumsufer.app

## What it does

- Scrapes **~40 museums** from museumsufer.de (extracted from the embedded map config JSON)
- Scrapes **current exhibitions** with date ranges from the central exhibitions listing page
- Fetches **events** from 8 museums via structured APIs, and from ~30 more via AI-assisted HTML scraping
- **Enriches** events in the next 7 days with prices, images, and deep links from detail pages
- Serves a **frontend** with i18n (DE/EN/FR), date navigation, museum-grouped exhibitions, calendar downloads
- Runs a **daily cron** (6am UTC) to refresh all data

## Museums & event sources

### Structured API (8 museums)

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

### AI-scraped (~30 museums)

These museums have a `website_url` but no structured API. Events are extracted by fetching their program page and using Workers AI (Llama 4 Scout 17B).

| Museum | Website | Notes |
|---|---|---|
| Archäologisches Museum Frankfurt | archaeologisches-museum-frankfurt.de | Joomla, no feeds |
| Bibelhaus ErlebnisMuseum | bibelhaus-frankfurt.de | |
| Caricatura Museum Frankfurt | caricatura-museum.de | REDAXO CMS, no feeds |
| Deutsches Ledermuseum (Offenbach) | ledermuseum.de | |
| Deutsches Romantik-Museum | deutsches-romantik-museum.de | |
| Dommuseum Frankfurt | dommuseum-frankfurt.de | Returns 418 to default UA, needs browser User-Agent |
| Eintracht Frankfurt Museum | museum.eintracht.de | Gatsby, RSS is news only |
| Fotografie Forum Frankfurt | fffrankfurt.org | |
| Frankfurter Goethe-Haus | goethehaus-frankfurt.de | |
| Frankfurter Kunstverein | fkv.de | WP, but no event date fields exposed |
| Geldmuseum der Deutschen Bundesbank | bundesbank.de/geldmuseum | RSS is institutional press only |
| Haus der Stadtgeschichte (Offenbach) | haus-der-stadtgeschichte.de | |
| Hindemith Kabinett | hindemith.info/de/kabinett | |
| Ikonenmuseum Frankfurt | museumangewandtekunst.de | Managed by Museum Angewandte Kunst |
| Institut für Stadtgeschichte | stadtgeschichte-ffm.de | |
| Junges Museum Frankfurt | junges-museum-frankfurt.de | |
| Klingspor Museum (Offenbach) | klingspormuseum.de | |
| MGGU – Museum Giersch | mggu.de | |
| MMK (Museum, Tower, Zollamt) | mmk.art | Nuxt.js SPA, CMS has no events endpoint |
| MOMEM | momem.org | |
| Museum Angewandte Kunst | museumangewandtekunst.de | REDAXO, no feeds |
| Museum Sinclair-Haus (Bad Homburg) | museum-sinclair-haus.de | |
| Portikus | portikus.de | |
| Porzellan Museum Frankfurt | porzellan-museum-frankfurt.de | |
| SCHIRN Kunsthalle Frankfurt | schirn.de | WP API exists but event data corrupted |
| Stoltze-Museum | frankfurter-sparkasse.de | |
| Struwwelpeter Museum | struwwelpeter-museum.de | |
| Weltkulturen Museum | weltkulturenmuseum.de | Domain changed from weltkulturen-museum.de |

### No event source (2 museums)

| Museum | Reason |
|---|---|
| SCHIRN in Bockenheim | Duplicate entry for SCHIRN's temporary location, no own website |

## Architecture

```
src/
  index.ts          Entry point: HTTP routes + cron handler
  scraper.ts        Museums + exhibitions from museumsufer.de (deterministic HTML parsing)
  museum-apis.ts    Static config of museum API endpoints
  api-scrapers.ts   Typed parsers for each API format
  event-scraper.ts  Orchestrator: API-first with AI fallback, plus detail page enrichment
  api.ts            JSON API with caching headers
  frontend.ts       Single-page HTML with i18n (DE/EN/FR) and .ics calendar downloads
  i18n.ts           Translations and locale detection
  types.ts          Shared TypeScript interfaces
migrations/
  0001_init.sql     D1 schema (museums, exhibitions, events)
  0002_events_unique.sql
  0003_event_detail_fields.sql
```

### Cloudflare services used

- **Workers** — compute
- **D1** — SQLite database for museums, exhibitions, events
- **Workers AI** (`@cf/meta/llama-4-scout-17b-16e-instruct`) — extract events from museum websites without APIs
- **Cron Triggers** — daily scrape at 6am UTC

## API

| Endpoint | Cache | Description |
|---|---|---|
| `GET /api/day?date=YYYY-MM-DD` | 1h | Exhibitions + events for a date |
| `GET /api/exhibitions?date=YYYY-MM-DD` | 6h | Active exhibitions for a date |
| `GET /api/events?date=YYYY-MM-DD` | 1h | Events on a specific date |
| `GET /api/museums` | 24h | All museums |
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
