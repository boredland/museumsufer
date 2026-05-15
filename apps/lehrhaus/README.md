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

1. Add a `VenueConfig` entry in `src/concert-config.ts` (slug, name, address, lat/lon, city, default_genre, scraper key).
2. Add a parser in `src/scrapers/<name>.ts` returning `ScrapeResult`.
3. Wire the new scraper key in `src/scrape-runner.ts` — TypeScript errors if you forget.
4. Trigger the workflow (`Actions → scrape → konzert-haus`) or wait for the next hourly run.
