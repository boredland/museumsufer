# lehr.salon

Cloudflare Worker that aggregates public lectures, readings, and discussions across Frankfurt — Polytechnische Gesellschaft, Haus am Dom, Jüdische Gemeinde, FGZ StreitClub, Literaturhaus, Goethe-Uni Bürgeruniversität, Institut für Sozialforschung, Evangelische Akademie, Sigmund-Freud-Institut, Denkbar, Romanfabrik, DIG Frankfurt, OPEN BOOKS, and cross-imports of Vortrag-class events from the museums and theaters sister apps.

**Live:** [frankfurt.lehr.salon](https://frankfurt.lehr.salon)

## Architecture

```
GitHub Action (.github/workflows/scrape.yml — lehrhaus job)
  ↓ daily cron 06:30 UTC
  ↓ runs `bun apps/lehrhaus/scripts/scrape.ts`
  ↓ writes apps/lehrhaus/src/scrape-data.ts (typed module)
  ↓ commits + pushes if content actually changed
Cloudflare git integration
  ↓ redeploys the worker with the new bundled data
Worker
  ↓ imports SCRAPE_DATA, in-memory filters serve every read path
```

Three formats — `Vortrag` (monologic lecture), `Lesung` (literary reading / book launch), `Diskussion` (panel / debate). Categorization is heuristic over title/description; see `src/scrapers/shared.ts`.

The default home view is a rolling next-7-days list grouped per date; `/tag/YYYY-MM-DD` is the single-day permalink.

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR
- htmx for date / range partial swaps
- Bundled `src/scrape-data.ts` (no D1 reads for content)
- D1 (`lehrhaus-db`) for Web Push subscriptions only

## Visual identity

"The editor's annotated quarto." Foxed paper (`#F2E9D5`) + iron-gall ink (`#1C1812`) + cinnabar rubric (`#A33222`) + marginalia blue + book-binding umber. Cormorant Garamond serif + DM Mono. Pilcrows ¶ as per-entry anchors, manicule ☞ on action buttons, asterism ⁂ as the empty-state mark. Wordmark mirrors `konzert.haus` (`lehr` ink + rubric dot + italic-rubric `salon`).

## Dev

```bash
bun install                                # from repo root
bun run -F @museumsufer/lehrhaus dev
bun run -F @museumsufer/lehrhaus scrape    # regenerate src/scrape-data.ts

curl http://localhost:8787/
curl http://localhost:8787/api/day
curl 'http://localhost:8787/api/events?format=Lesung'
curl http://localhost:8787/feed.ics
```

## Adding a new source

Lehrhaus reads its events from the central event hub at
`@museumsufer/event-hub`. The actual scraping happens in
`packages/scrapers/src/venues/`; `scripts/scrape.ts` here just filters
`EVENTS` to entries with a `talk:*` label and maps them onto
`LehrhausEvent`.

1. Add a canonical scraper under `packages/scrapers/src/venues/<slug>.ts`
   that emits a `talk:vortrag` / `talk:diskussion` / `talk:lesung` label
   for the talk-shaped events. Register it in
   `packages/scrapers/src/index.ts`.
2. Add a `LehrhausSource` entry in `src/source-config.ts` whose slug
   matches the hub `source_slug`. Lehrhaus picks it up automatically on
   the next `bun scrape` run.
3. Optionally curate a display name in
   `packages/event-hub/src/venue-names.ts`.

## Museum / theater rollups

Museums and theaters that emit talks fold under the catch-all
`frankfurt-museums` / `frankfurt-theaters` source slugs so
`/quelle/frankfurt-museums` and `/quelle/frankfurt-theaters` keep
working. The host venue's display name (e.g. "Senckenberg Naturmuseum",
"Schauspiel Frankfurt") rides in `source_name`. The MUSEUM_SLUGS and
THEATER_SLUGS sets in `scripts/scrape.ts` decide which hub source slugs
roll up under each aggregator.
