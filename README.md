# Museumsufer Frankfurt

A Cloudflare Worker that aggregates exhibitions and events from Frankfurt's [Museumsufer](https://www.museumsufer.de) museums into a single page with date-based navigation.

**Live:** https://museumsufer.jonas-strassel.de

## What it does

- Scrapes **~40 museums** from museumsufer.de (extracted from the embedded map config JSON)
- Scrapes **current exhibitions** with date ranges from the central exhibitions listing page
- Discovers each museum's **own website** from their museumsufer.de detail page
- Scrapes **events/program pages** from individual museum websites using Workers AI to extract structured data from diverse HTML layouts
- Serves a **frontend** showing exhibitions and events for any given day
- Runs a **daily cron** (6am UTC) to refresh all data

## Architecture

```
src/
  index.ts          Entry point: HTTP routes + cron handler
  scraper.ts        Museums + exhibitions from museumsufer.de (deterministic HTML parsing)
  event-scraper.ts  Events from individual museum websites (AI-assisted extraction)
  api.ts            JSON API: /api/day, /api/exhibitions, /api/events, /api/museums
  frontend.ts       Single-page HTML with date picker
  types.ts          Shared TypeScript interfaces
migrations/
  0001_init.sql     D1 schema (museums, exhibitions, events)
  0002_events_unique.sql
```

### Cloudflare services used

- **Workers** — compute
- **D1** — SQLite database for museums, exhibitions, events
- **Workers AI** (`@cf/meta/llama-3.1-8b-instruct`) — extract structured events from heterogeneous museum websites
- **Cron Triggers** — daily scrape at 6am UTC

## API

| Endpoint | Description |
|---|---|
| `GET /api/day?date=YYYY-MM-DD` | Exhibitions + events for a date |
| `GET /api/exhibitions?date=YYYY-MM-DD` | Active exhibitions for a date |
| `GET /api/events?date=YYYY-MM-DD` | Events on a specific date |
| `GET /api/museums` | All museums |
| `POST /scrape` | Trigger museum + exhibition scrape |
| `POST /scrape/events` | Trigger event scrape from museum websites |

## Development

```bash
npm install

# Set up local D1
npm run db:migrate:local

# Start dev server
npm run dev

# Seed data
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

# Deploy
npm run deploy
```
