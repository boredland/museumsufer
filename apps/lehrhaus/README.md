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

1. Add a `LehrhausSource` entry in `src/source-config.ts` (slug, name, short_name, url, lat/lon).
2. Add a scraper in `src/scrapers/<slug>.ts` returning `Promise<ScrapedEvent[]>`. Use `talkCategory()` from `./shared` to classify into Vortrag / Lesung / Diskussion.
3. Wire the new scraper in the `scrapers` array in `scripts/scrape.ts`.
4. Trigger the workflow (`Actions → scrape → lehrhaus`) or wait for the next hourly run.

## Cross-imports

Vortrag-class events from `frankfurt-museums` and `frankfurt-theaters` are pulled in at scrape time. `source_slug` stays at the aggregator (`frankfurt-museums` / `frankfurt-theaters`) so `/quelle/...` still groups them, but `source_name` carries the actual host museum / theater (e.g. "Senckenberg Naturmuseum", "Schauspiel Frankfurt") so the card label is specific. Misclassified guided-tour events ("Ausstellungsführung", "Rundgang") are filtered out by re-running `classifyEvent()`.
