# Museumsufer Frankfurt

A Cloudflare Worker that aggregates exhibitions and events from Frankfurt's [Museumsufer](https://www.museumsufer.de) museums into a single page with date-based navigation.

**Live:** https://museumsufer.app

## Architecture

```
GitHub Action (.github/workflows/scrape.yml, museums job)
  ↓ daily 06:00 UTC
  ↓ runs `bun apps/frankfurt-museums/scripts/scrape.ts`
  ↓ in-memory SQLite (bun:sqlite) + the existing 4-stage pipeline
  ↓ writes apps/frankfurt-museums/src/scrape-data.ts (typed module)
  ↓ commits + pushes if content actually changed
Cloudflare git integration
  ↓ redeploys the worker with the new bundled data
Worker
  ↓ imports SCRAPE_DATA, in-memory filters serve every read path
```

The worker has **no D1 path for scraped data** — `museums`, `events`,
`exhibitions`, and `translations` were dropped in migration `0012`. The
only remaining D1 table is `likes` (request-time user writes).

## Features

- ~40 museums + ~700 events + 36+ exhibitions, refreshed daily
- 4-stage scrape pipeline (museumsufer.de → exhibition APIs → event APIs → DeepL)
- Frontend with i18n (DE/EN/FR), fuzzy search, distance sorting, calendar downloads
- RSS (`/feed.xml`) and ICS (`/feed.ics`) feeds
- Image proxy with edge caching
- Installable as a PWA with offline support
- Health check GitHub Action runs at 08:00 UTC and opens an issue on regressions

## Tech stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Framework:** [Hono](https://hono.dev) with Zod validation
- **Database:** Cloudflare D1 (only `likes` now — scraped data lives in `src/scrape-data.ts`)
- **Translation:** DeepL via the GH-Action scrape; cache rides in the bundled module
- **Frontend:** Server-rendered JSX (Hono), Tailwind CSS, htmx, Fuse.js
- **Tooling:** [Bun](https://bun.sh) (replaces npm/tsx)

## API

| Endpoint | Cache | Description |
|---|---|---|
| `GET /api/day?date=YYYY-MM-DD` | 1h SWR | Exhibitions + events for a date |
| `GET /api/exhibitions?date=YYYY-MM-DD` | 6h SWR | Active exhibitions for a date |
| `GET /api/events?date=YYYY-MM-DD` | 1h SWR | Events on a specific date |
| `GET /api/event/:id.ics` | 1h | Single event as ICS download |
| `GET /api/museums` | 24h SWR | All museums |
| `GET /feed.xml` | 1h | RSS feed (next 7 days) |
| `GET /feed.ics` | 1h | ICS calendar feed (next 7 days) |
| `GET /llms.txt` | 24h | API description for LLM agents |
| `GET /img/:encoded-url` | 7d | Proxied museum image |
| `POST /api/like` | — | Like an exhibition or event |

There are no `/scrape/*` endpoints anymore — the pipeline runs in GitHub Actions.

## First-time setup

```bash
# 1. Install Bun (once per machine)
mise use -g bun@latest

# 2. Create the D1 database (first time only) — only used for `likes`
bunx wrangler d1 create museumsufer-db
# Update database_id in wrangler.jsonc

# 3. Apply migrations
bun run db:migrate:local
bun run db:migrate
```

## Development

```bash
bun install                 # from repo root

# Start the worker
bun run -F @museumsufer/frankfurt-museums dev

# Run a one-shot scrape locally and regenerate src/scrape-data.ts:
bun run -F @museumsufer/frankfurt-museums scrape
# (DeepL translations skipped unless DEEPL_API_KEYS is set in your shell)

# Health check
bun run -F @museumsufer/frankfurt-museums health-check
```

The GitHub Action runs the same `scripts/scrape.ts` daily — there's no
longer a `SCRAPE_SECRET` to manage. Required GH Actions secrets:
`DEEPL_API_KEYS`, `FETCH_PROXY_URL`, `FETCH_PROXY_TOKEN`.
