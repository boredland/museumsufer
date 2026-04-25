# Agents Guide

This document helps AI agents understand and work on this codebase.

## Project overview

A Cloudflare Worker that aggregates museum exhibitions and events from Frankfurt's Museumsufer into a single page. It scrapes data from museumsufer.de and individual museum websites, stores it in D1, and serves a frontend + JSON API.

**Production URL:** https://museumsufer.jonas-strassel.de

## Tech stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **AI:** Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`) for parsing museum event pages
- **Build:** wrangler (no bundler config needed — wrangler handles it)
- **No framework** — vanilla Worker with manual routing in `src/index.ts`

## Key files

| File | Purpose |
|---|---|
| `src/index.ts` | Entry point. Routes HTTP requests and handles the cron trigger. |
| `src/scraper.ts` | Scrapes museumsufer.de for museums (from embedded `museumMapConfig` JSON) and exhibitions (HTML parsing of `.teaserBox` elements). Deterministic — no AI. |
| `src/event-scraper.ts` | Scrapes individual museum websites for events. Discovers museum website URLs from museumsufer.de detail pages, probes common event page paths (`/programm`, `/veranstaltungen`, etc.), then uses Workers AI to extract structured event JSON from the page text. |
| `src/api.ts` | JSON API handlers. Main endpoint is `/api/day?date=YYYY-MM-DD` returning exhibitions active on that date + events on that date. |
| `src/frontend.ts` | Exports `renderPage()` which returns the full HTML/CSS/JS as a string. Single-page app that calls `/api/day`. |
| `src/types.ts` | `Env` interface (D1 + AI bindings) and data types. |
| `wrangler.toml` | Worker config. D1 binding, AI binding, cron schedule. |
| `migrations/` | D1 SQL migrations. Run in order. |

## Database schema

Three tables in D1:

- **`museums`** — `id`, `name`, `slug` (unique), `museumsufer_url`, `website_url` (nullable, discovered at runtime), `opening_hours`
- **`exhibitions`** — `museum_id` FK, `title`, `start_date`, `end_date`, `image_url`, `detail_url`. Unique on `(museum_id, title)`. Dates updated on each scrape.
- **`events`** — `museum_id` FK, `title`, `date`, `time`, `description`, `url`. Unique on `(museum_id, title, date)`.

## Data flow

1. **Cron fires** daily at 6am UTC (`scheduled` handler in `index.ts`)
2. **`scrape()`** runs first:
   - Fetches museumsufer.de/de/museen/ and extracts the `museumMapConfig` JavaScript object (contains all ~39 museums with names, slugs, URLs)
   - Fetches the exhibitions listing page and parses `.teaserBox` HTML blocks with regex (title from `h2.teaserHeadline`, dates + museum name from `p.teaserText`)
   - Museum matching uses slug comparison with German stem normalization (handles grammatical case differences like "Archäologisches" vs "Archäologischen")
   - Upserts via `ON CONFLICT ... DO UPDATE` so exhibition end-dates stay current
3. **`scrapeMuseumWebsites()`** runs second:
   - Discovers museum website URLs by scraping each museumsufer.de detail page for the first `externelLink` with `margRight15` class
   - For each museum with a known website, probes common event page paths
   - Falls back to fetching the homepage and searching for event-related links
   - Strips HTML to text, truncates to 8000 chars, sends to Workers AI for structured extraction
   - AI returns JSON array of `{title, date, time, description}`
   - Inserts with `ON CONFLICT DO NOTHING` (dedup by museum+title+date)

## Common tasks

### Adding a new scrape source

If museumsufer.de changes its HTML structure, the selectors to update are in `src/scraper.ts`:
- Museum data: look for `museumMapConfig` in the `/de/museen/` page
- Exhibitions: regex matching `teaserBox`, `teaserHeadline`, `teaserText` classes
- Date parsing: `parseGermanDateRange()` handles "DD. Month - DD. Month YYYY" format

### Adding a new API endpoint

Add a new `if (path === "/api/...")` block in `src/api.ts`.

### Modifying the frontend

The entire frontend is a template string in `src/frontend.ts`. CSS is inline. JavaScript is inline. No build step.

### Running migrations

```bash
# Local
wrangler d1 execute museumsufer-db --local --file=./migrations/NNNN_name.sql

# Production
wrangler d1 execute museumsufer-db --remote --file=./migrations/NNNN_name.sql
```

### Manually triggering scrapes

```bash
# Museums + exhibitions
curl -X POST https://museumsufer.jonas-strassel.de/scrape

# Events from museum websites
curl -X POST https://museumsufer.jonas-strassel.de/scrape/events
```

## Known limitations

- The event scraper uses an 8B parameter model which sometimes misses events or hallucinates dates. A larger model would improve accuracy but costs more.
- Some museum websites block Workers fetch or have unusual TLS configurations. These silently fail and produce no events for that museum.
- The `/scrape/events` endpoint takes 2-3 minutes because it sequentially visits ~40 museum websites. Could be parallelized with Cloudflare Queues if latency matters.
- Museum name matching between the exhibition page text and the museum map data uses fuzzy slug matching with German stem normalization. It handles most cases but occasionally creates duplicate museum entries for genuinely different venue names (e.g., "SCHIRN in Bockenheim" vs "SCHIRN KUNSTHALLE FRANKFURT").

## Deployment

Deploy with `wrangler deploy`. The D1 database ID is in `wrangler.toml`. Cron triggers are configured there too.
