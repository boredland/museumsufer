# Frankfurt Theaters

Cloudflare Worker that aggregates performances from Frankfurt theaters.

**Live:** frankfurt.ins.theater (TBD)

## Status

Early scaffold. Single theater wired up: **Schauspiel Frankfurt** (~93 performances/45 days, with sold-out detection and Eventim event IDs for live availability checks later).

## Stack

- Cloudflare Workers (TypeScript)
- Cloudflare D1 (SQLite)
- [Hono](https://hono.dev) v4 + JSX SSR
- Daily cron at 5am UTC

## Schema

| Table | Purpose |
|---|---|
| `theaters` | Theater metadata (name, slug, address, lat/lon, ticketing provider) |
| `shows` | Productions (title, description, image, detail URL). Unique on `(theater_id, slug)`. |
| `performances` | Individual showings (date, time, room, status, price range, ticket URL). Unique on `(show_id, date, time, venue_room)`. |
| `translations` | DeepL hash-based cache (DE→EN/FR), shared schema with the museums app. |

## First-time setup

```bash
# 1. Create the D1 database (returns an id to paste into wrangler.jsonc)
npx wrangler d1 create frankfurt-theaters-db

# 2. Apply the schema locally and remotely
npm run db:migrate:local
npm run db:migrate

# 3. Optional: set scrape secret
openssl rand -hex 32 | npx wrangler secret put SCRAPE_SECRET --name frankfurt-theaters
```

## Dev

```bash
npm install            # from repo root
npm run dev            # this app

curl -X POST http://localhost:8787/scrape/all
curl http://localhost:8787/api/day?date=2026-05-08
```

## Adding a new theater

1. Add a `TheaterConfig` entry in `src/theater-config.ts` (slug, name, address, lat/lon, ticketing provider, scraper key).
2. Add a parser in `src/scrapers/<slug>.ts` that returns `ScrapeResult`.
3. Wire the new scraper key in `src/scrape-runner.ts`'s `runScraper` switch — TypeScript will error if you forget.

## Roadmap

- [x] Eventim public API enrichment for live seat counts. Implemented in `src/enrich/eventim-availability.ts`, but **currently a no-op in production**: the inhouse host returns HTTP 520 to Cloudflare Workers (Akamai bot management). The HTML-derived `available` / `sold_out` / `cancelled` status remains correct. To unblock live counts we'd need Workers Browser Rendering — see `BROWSER` binding pattern in the museums app.
- [x] Cancelled performance detection (`performance--is-canceled` class)
- [ ] Oper Frankfurt — sister theater, expected to share parser shape. Live structure not yet verified (host unreachable from current dev IP).
- [ ] Show description + image enrichment from each show's detail page
- [ ] Theater Willy Praml (WordPress + Eventim)
- [ ] DeepL translation pipeline (reuse museums approach)
- [ ] Design pass after a few theaters are wired up
