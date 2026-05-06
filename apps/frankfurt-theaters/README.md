# Frankfurt Theaters

Cloudflare Worker that aggregates performances from Frankfurt theaters.

**Live:** frankfurt.ins.theater (TBD)

## Status

Two theaters wired up:

| Theater | Source | Coverage | Status detection |
|---|---|---|---|
| Schauspiel Frankfurt | `schauspielfrankfurt.de/spielplan/` (schema.org Event microdata + `performance--is-*` classes) | ~93 performances / 45 days | available / sold_out / cancelled |
| Oper Frankfurt | `oper-frankfurt.de/de/spielplan/` (`repertoire-element` cards anchored to a `dates_available` JS array) | ~29 performances / 22 days (current month only) | available / sold_out / cancelled |

Live seat counts are **not** scraped — the Eventim Inhouse API requires a signed URL that's only producible in a real browser, and the inhouse host blocks Cloudflare Workers (Akamai bot management).

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

- [x] Schauspiel Frankfurt parser (sold-out / cancelled detection)
- [x] Oper Frankfurt parser
- [ ] Oper Frankfurt: pull next-month performances too. Front page only ships the current month's repertoire-elements, even though `dates_available` lists the full season. The AJAX endpoint at `/includes/php/spielplan/spielplan_ausgabe_monat.php` dumps the entire archive (~3800 events back to 2016) but with no per-event date attribution, so it isn't a drop-in replacement.
- [ ] Show description + image enrichment from each show's detail page
- [ ] Theater Willy Praml (WordPress + Eventim)
- [ ] DeepL translation pipeline (reuse museums approach)
- [ ] Design pass after a few theaters are wired up
- [ ] Live seat counts via Workers Browser Rendering (deferred — Eventim Inhouse blocks plain Worker fetches via Akamai bot management)
