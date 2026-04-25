# Agents Guide

This document helps AI agents understand and work on this codebase.

## Project overview

A Cloudflare Worker that aggregates museum exhibitions and events from Frankfurt's Museumsufer into a single page. It collects data from museumsufer.de, museum JSON APIs, and AI-scraped museum websites, stores everything in D1, and serves a frontend + JSON API.

**Production URL:** https://museumsufer.jonas-strassel.de

## Tech stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **AI:** Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`) for parsing museum event pages without APIs
- **Build:** wrangler (no bundler config needed — wrangler handles it)
- **No framework** — vanilla Worker with manual routing in `src/index.ts`

## Key files

| File | Purpose |
|---|---|
| `src/index.ts` | Entry point. Routes HTTP requests, checks scrape auth, handles cron trigger. |
| `src/scraper.ts` | Scrapes museumsufer.de for museums (from embedded `museumMapConfig` JSON) and exhibitions (HTML parsing of `.teaserBox` elements). Deterministic — no AI. |
| `src/museum-apis.ts` | Static registry mapping museum slugs to their JSON API endpoints and parser types. This is the source of truth for which museums use API scraping vs AI scraping. |
| `src/api-scrapers.ts` | Typed parsers for each museum API format: `tribe-events` (DAM, DFF), `historisches`, `juedisches`, `staedel`, `senckenberg`. Each returns `ApiEvent[]`. |
| `src/event-scraper.ts` | Orchestrator. For each museum: checks `museum-apis.ts` for an API config → uses `api-scrapers.ts` if found, otherwise falls back to AI-based HTML scraping. Then enriches upcoming events (next 7 days) with prices/images from detail pages. |
| `src/api.ts` | JSON API handlers. Main endpoint is `/api/day?date=YYYY-MM-DD`. |
| `src/frontend.ts` | Exports `renderPage()` — full HTML/CSS/JS as a template string. Date nav, museum-grouped exhibitions, event cards with .ics calendar downloads. |
| `src/types.ts` | `Env` interface (D1 + AI + SCRAPE_SECRET bindings) and data types. |
| `wrangler.toml` | Worker config. D1 binding, AI binding, cron schedule. |
| `migrations/` | D1 SQL migrations. Run in order. |

## Event scraping: three tiers

### Tier 1: Structured APIs (6 museums, best data)

Configured in `src/museum-apis.ts`. When the event scraper finds a matching slug, it calls `fetchEventsFromApi()` and skips AI scraping entirely.

| Museum | Slug | Parser | Endpoint | Notes |
|---|---|---|---|---|
| Städel Museum | `staedel-museum` | `staedel` | `staedelmuseum.de/de/api/finder` | ~370 events, images, sold-out status, URL aliases (`@web`, `@images`) |
| Historisches Museum | `historisches-museum-frankfurt` | `historisches` | `historisches-museum-frankfurt.de/api/calendar` | Unix timestamps, `isFree` boolean, "Bibliothek der Generationen" blocklisted |
| Jüdisches Museum | `juedisches-museum-frankfurt` | `juedisches` | `juedischesmuseum.de/besuch/feed.json?records[uid]=329` | TYPO3 feed, `{items: [{data: {...}}]}` wrapper. Events routed to Museum Judengasse via `locationAlt` field containing "Judengasse" → `museum_slug_override` |
| DAM | `deutsches-architekturmuseum` | `tribe-events` | `dam-online.de/wp-json/tribe/events/v1/events` | Standard Tribe Events with `cost`, `image.url`, `venue` |
| DFF | `dff-deutsches-filminstitut-filmmuseum` | `tribe-events` | `dff.film/wp-json/tribe/events/v1/events` | Same Tribe Events format |
| Senckenberg | `senckenberg-naturmuseum` | `senckenberg` | `museumfrankfurt.senckenberg.de/wp-json/wp/v2/events` | WP REST with ACF fields: `event_start_time`, `event_canceled`, `hide_event`. Needs `User-Agent` header. |

### Tier 2: AI-scraped (~32 museums)

Museums with a `website_url` but no API config. The scraper probes common paths (`/programm`, `/veranstaltungen`, `/kalender`, `/events` and `/de/` variants), strips HTML, and sends up to 8000 chars to Workers AI. The AI returns `{title, date, time, description}[]`. Link matching is done separately by extracting all `<a href>` from the raw HTML and fuzzy-matching event titles to find detail URLs.

### Tier 3: Detail page enrichment (next 7 days only)

After Tier 1+2 insert events, events with a `detail_url` in the next 7 days get enriched: each detail page is fetched, `og:image` or content images are extracted, and Workers AI extracts price info. Events without a price after enrichment get `price = ''` (empty string) so they're not re-fetched.

## Database schema

Three tables in D1:

- **`museums`** — `id`, `name`, `slug` (unique), `museumsufer_url`, `website_url` (nullable, discovered at runtime), `opening_hours`
- **`exhibitions`** — `museum_id` FK, `title`, `start_date`, `end_date`, `image_url`, `detail_url`. Unique on `(museum_id, title)`. Dates updated on each scrape.
- **`events`** — `museum_id` FK, `title`, `date`, `time`, `description`, `url`, `detail_url`, `image_url`, `price`. Unique on `(museum_id, title, date)`.

## Data flow

1. **Cron fires** daily at 6am UTC (`scheduled` handler in `index.ts`)
2. **`scrape()`** runs first (museums + exhibitions from museumsufer.de)
3. **`scrapeMuseumWebsites()`** runs second:
   - Discovers website URLs (only for museums missing one)
   - Iterates all museums: API config → `fetchEventsFromApi()`, else AI scraping
   - Runs `enrichUpcomingEvents()` for detail page data (next 7 days, max 30 events per run)
4. Scrape endpoints (`POST /scrape`, `POST /scrape/events`) require `Authorization: Bearer <SCRAPE_SECRET>`

## Common tasks

### Adding a new museum API

1. Find the API endpoint (check for `/wp-json/`, embedded JSON configs, or network requests on the museum's program page)
2. Add the museum's slug + endpoint to `MUSEUM_APIS` in `src/museum-apis.ts`
3. If it's a new API format, add a parser type to `ApiType` and implement the fetcher in `src/api-scrapers.ts`
4. If it's Tribe Events or standard WP REST, use existing parsers

### Adding a new API endpoint

Add a new `if (path === "/api/...")` block in `src/api.ts`.

### Modifying the frontend

The entire frontend is a template string in `src/frontend.ts`. CSS is inline. JavaScript is inline. No build step. Be careful with escaping — JS string literals inside a TypeScript template literal require `\\` for backslash.

### Running migrations

```bash
# Local
wrangler d1 execute museumsufer-db --local --file=./migrations/NNNN_name.sql

# Production
wrangler d1 execute museumsufer-db --remote --file=./migrations/NNNN_name.sql
```

### Manually triggering scrapes

```bash
curl -X POST https://museumsufer.jonas-strassel.de/scrape \
  -H "Authorization: Bearer $SCRAPE_SECRET"

curl -X POST https://museumsufer.jonas-strassel.de/scrape/events \
  -H "Authorization: Bearer $SCRAPE_SECRET"
```

## Known limitations

- The 8B AI model sometimes misses events or hallucinates dates. API-based scraping is always preferred when available.
- Some museum websites block Workers fetch or have TLS issues. These fail silently.
- The scrape runs sequentially (~3-5 minutes for events). Could be parallelized with Cloudflare Queues.
- Museum name matching uses fuzzy slug comparison with German stem normalization. Occasionally creates duplicates for genuinely different venue names.
- Event detail enrichment is capped at 30 events per run and 7 days ahead to stay within Workers AI neuron quotas.

## Investigated but dropped

- **SCHIRN** WP API (`/wp-json/wp/v2/offer`): `ho_event_data` field contains single-character strings instead of JSON objects — serialization bug on their end.
- **FKV** WP API (`/wp-json/wp/v2/events`): WP `date` field is the post publish date, not the event date. No ACF event fields exposed.
- **Curator.io** feed for Jüdisches Museum: social media post aggregator, not structured event data.

## Deployment

Deploy is automated on git push. The D1 database ID is in `wrangler.toml`. Secrets are managed via `wrangler secret put`.
