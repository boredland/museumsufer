# lichtspiel.haus

Cloudflare Worker that aggregates the daily film-screening programme for
Frankfurt / Rhein-Main arthouse and repertory cinemas — DFF, Astor, Cinéma /
Eldorado / Harmonie, Pupille, Mal seh'n, Murnau, Caligari, Filmforum Höchst,
and the long-tail regional houses.

**Live:** [frankfurt.lichtspiel.haus](https://frankfurt.lichtspiel.haus)

## Architecture

```
GitHub Action (.github/workflows/scrape.yml)
  ↓ daily/hourly cron
  ↓ runs the hub scrape (packages/event-hub) once — which also runs the
  ↓   TMDb → OMDb → DeepL enrichment pass for film:cinema events — then
  ↓ `bun apps/lichtspiel-haus/scripts/scrape.ts` derives this app's slice:
  ↓   keeps hub EVENTS in the Frankfurt bbox carrying a `film:cinema` label,
  ↓   dedups the same film across cinemas/dates, writes src/scrape-data.ts
  ↓ commits + pushes if content actually changed
Cloudflare git integration
  ↓ redeploys the worker with the new bundled data
Worker
  ↓ imports SCRAPE_DATA, in-memory filters serve every read path
```

Screening reads run in-memory off the bundled `src/scrape-data.ts`; D1 is used
only for Web Push subscriptions. Cinemas not curated in `src/cinema-config.ts`
are auto-synthesized into `src/synthesized-cinemas.ts` on each scrape.

## What's distinctive

- **TMDb enrichment** (run in the hub): posters, locale-aware canonical titles
  (`title_de` / `title_en`), and synopses; DeepL fills the English synopsis when
  TMDb lacks one. Carried through to `Screening` verbatim.
- **OMDb ratings**: Rotten Tomatoes critic %, IMDb rating + vote count, with
  deep links to themoviedb.org / imdb.com / rottentomatoes.com.
- **Mark-as-seen**: localStorage, keyed by `tmdb_id` so a film hides across all
  its dates and cinemas at once.
- **Reihen** (`film:reihe:<Name>` labels) are a first-class entity — `/reihe/:slug`.
- **Version / format / language** markers (OmU, OV, DF, 35mm, DCP, …) parsed
  from the listing title + subtitle in `scripts/scrape.ts`.
- 60-day Kodak film-strip date slider; Jugendstil / Saul-Bass dark-default design.

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR
- htmx for date / partial swaps
- Bundled `src/scrape-data.ts` (no D1 reads for content); D1 (`lichtspiel-haus-db`) for Web Push only

## Routes

| Endpoint | Description |
|---|---|
| `GET /`, `GET /tag/:date` | Day programme (`?kino=`, `?reihe=`, `?range=7\|14`) |
| `GET /film/:id` | Single screening + film detail (Movie / ScreeningEvent JSON-LD) |
| `GET /kino/:slug`, `GET /kinos` | Cinema page + directory |
| `GET /reihe/:slug`, `GET /reihe` | Series page + index |
| `GET /partial/content` | HTMX swap target |
| `GET /api/day`, `/api/screenings`, `/api/screenings/:id`, `/api/cinemas`, `/api/cinemas/:slug`, `/api/series`, `/api/series/:slug` | JSON API |
| `GET /feed.ics`, `/feed.rss` + per-cinema/series/film `.ics` | Feeds |
| `GET /og/:id/image.svg` | Dynamic OG card |
| `GET /api/docs`, `/api/docs/openapi.json` | Scalar reference + OpenAPI 3.1 |
| `POST /api/contact`, `GET\|POST /api/push/*` | Contact + Web Push |
| `/robots.txt`, `/sitemap.xml`, `/manifest.json`, `/llms.txt`, `/.well-known/api-catalog` | Discovery |

## Dev

```bash
bun install                                   # from repo root
bun run -F @museumsufer/lichtspiel-haus dev
bun run -F @museumsufer/lichtspiel-haus scrape   # re-derive src/scrape-data.ts from the hub bundle

curl http://localhost:8787/
curl 'http://localhost:8787/api/day?date=2026-06-12'
curl http://localhost:8787/feed.ics
```

## Adding a new cinema

The app reads from the central event hub (`@museumsufer/event-hub`); scraping
lives in `packages/scrapers/`.

1. Add a canonical scraper under `packages/scrapers/src/venues/<name>.ts` that
   emits a `film:cinema` label, and register it in
   `packages/scrapers/src/index.ts`'s `VENUE_SCRAPERS`.
2. Optionally add a curated `CinemaConfig` in `src/cinema-config.ts` (slug,
   name, address, lat/lon, city, website, tagline) whose `slug` matches the hub
   `source_slug`. Uncurated sources are auto-synthesized.
3. Optionally curate a display name in `packages/event-hub/src/venue-names.ts`.
4. Trigger the workflow (`Actions → scrape`) or wait for the next hourly run.

## Deployment

Automated on git push (Cloudflare git integration). Custom domains
(`frankfurt.lichtspiel.haus`, apex `lichtspiel.haus` 301-redirects to it) are
configured in `wrangler.jsonc` `routes`. Multi-city is config-only: the host
subdomain is parsed into a `city` variable.
