# Frankfurt Theaters

Cloudflare Worker that serves an aggregated programme of Frankfurt theaters.

**Live:** [frankfurt.ins.theater](https://frankfurt.ins.theater)

## Architecture

```
GitHub Action (.github/workflows/scrape.yml)
  ↓ hourly cron 09–21 CEST
  ↓ runs `bun apps/frankfurt-theaters/scripts/scrape.ts`
  ↓ writes apps/frankfurt-theaters/src/scrape-data.ts (typed module)
  ↓ commits + pushes if content actually changed
Cloudflare git integration
  ↓ redeploys the worker with the new bundled data
Worker
  ↓ imports SCRAPE_DATA, in-memory filters serve every read path
```

The worker has **no D1 path for scraped data** — `theaters`, `shows`, and
`performances` tables were dropped in migration `0006`. The remaining D1
tables are `feedback` (user-submitted reports) and `translations` (DeepL
cache, shared schema with the museums app).

## Stack

- Cloudflare Workers (TypeScript)
- Cloudflare D1 (only `feedback` + `translations`)
- [Hono](https://hono.dev) v4 + JSX SSR
- [Bun](https://bun.sh) for development tooling
- Scrape pipeline runs in GitHub Actions, not the worker

## First-time setup

```bash
# 1. Install Bun (once per machine)
mise use -g bun@latest

# 2. Create the D1 database (returns an id to paste into wrangler.jsonc)
bunx wrangler d1 create frankfurt-theaters-db

# 3. Apply migrations
bun run db:migrate:local    # local SQLite for `bun run dev`
bun run db:migrate          # remote D1
```

## Dev

```bash
bun install                 # from repo root
bun run -F @museumsufer/frankfurt-theaters dev

# Run a one-shot scrape locally and regenerate src/scrape-data.ts:
bun run -F @museumsufer/frankfurt-theaters scrape

# Hit the API:
curl http://localhost:8787/api/day?date=2026-05-08
```

The GitHub Action runs the same `scripts/scrape.ts` on a cron — there's
no longer a `/scrape/*` HTTP endpoint or `SCRAPE_SECRET` to manage.

## Adding a new theater

The app reads from the central event hub (`@museumsufer/event-hub`); the
actual scraping lives in `packages/scrapers/`. `scripts/scrape.ts` here keeps
hub `EVENTS` inside the Frankfurt bbox that carry a `stage:*` or `dance:*`
label, regroups them into shows + performances, and writes `src/scrape-data.ts`.

1. Add a canonical scraper under `packages/scrapers/src/venues/<slug>.ts` that
   emits `stage:theater` (and/or `dance:*` / `music:*` / `talk:*`) labels, and
   register it in `packages/scrapers/src/index.ts`'s `VENUE_SCRAPERS`.
2. Optionally add a curated `TheaterConfig` in `src/theater-config.ts` (slug,
   name, address, lat/lon, ticketing provider, wikidata, description) whose
   `slug` matches the hub `source_slug`. Sources with no curated entry are
   auto-synthesized into `src/synthesized-theaters.ts` on the next scrape.
3. Optionally curate a display name in `packages/event-hub/src/venue-names.ts`.
4. Trigger the workflow manually (`Actions → scrape → Run workflow`) or wait
   for the next hourly run.
