# konzert.haus

Cloudflare Worker that aggregates concerts across Frankfurt and the Rhein-Main region — classical, jazz, sacred, world, experimental, chamber. No pop, no rock.

**Live:** [frankfurt.konzert.haus](https://frankfurt.konzert.haus)

## Architecture

```
GitHub Action (.github/workflows/scrape.yml)
  ↓ hourly cron 09–21 CEST
  ↓ runs `bun apps/konzert-haus/scripts/scrape.ts`
  ↓ writes apps/konzert-haus/src/scrape-data.ts (typed module)
  ↓ commits + pushes if content actually changed
Cloudflare git integration
  ↓ redeploys the worker with the new bundled data
Worker
  ↓ imports SCRAPE_DATA, in-memory filters serve every read path
```

Multi-city ready: host header is parsed into a `city` variable, so adding `berlin.konzert.haus` etc. is a config-only change.

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR
- HTMX for date/genre navigation
- Bundled `src/scrape-data.ts` (no D1 reads for content)

## Dev

```bash
bun install                            # from repo root
bun run -F @museumsufer/konzert-haus dev
bun run -F @museumsufer/konzert-haus scrape   # regenerate src/scrape-data.ts

curl http://localhost:8787/
curl http://localhost:8787/api/events?venue=alte-oper
curl http://localhost:8787/feed.ics
```

## Adding a new venue

The app reads from the central event hub (`@museumsufer/event-hub`); scraping
lives in `packages/scrapers/`. `scripts/scrape.ts` here keeps hub `EVENTS`
inside the Frankfurt bbox that carry a `music:<genre>` label, dedups across
aggregator + direct sources, and writes `src/scrape-data.ts`.

1. Add a canonical scraper under `packages/scrapers/src/venues/<name>.ts` that
   emits a `music:<genre>` label, and register it in
   `packages/scrapers/src/index.ts`'s `VENUE_SCRAPERS`.
2. Optionally add a curated `VenueConfig` in `src/concert-config.ts` (slug,
   name, address, lat/lon, city, default_genre, wikidata, description) whose
   `slug` matches the hub `source_slug`. Uncurated sources are auto-synthesized
   into `src/synthesized-venues.ts`.
3. Optionally curate a display name in `packages/event-hub/src/venue-names.ts`.
4. Trigger the workflow (`Actions → scrape`) or wait for the next hourly run.
