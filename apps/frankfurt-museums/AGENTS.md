# Agents Guide

This document helps AI agents understand and work on `apps/frankfurt-museums`.

## Project overview

A Cloudflare Worker that aggregates Frankfurt Museumsufer museums, exhibitions,
and events into a single page with date-based navigation, an i18n frontend, and
a JSON API.

The worker does **not** scrape at request time and stores **no** content in D1.
A GitHub Action runs the central event-hub scrape, this app derives a typed
`src/scrape-data.ts` bundle from it, commits it, and Cloudflare's git
integration redeploys. Every read path filters the in-memory bundle.

**Production URL:** https://museumsufer.app

## Where data comes from

- **Events + exhibitions** — derived from the central event hub
  (`@museumsufer/event-hub`). `scripts/scrape.ts` keeps hub `EVENTS` that sit
  inside `FRANKFURT_BBOX` and carry a `museum:*` label. `museum:ausstellung` →
  Exhibitions (date = start, end_date = end); the rest → Events, with the
  original category (Vortrag / Konzert / Führung / Workshop / Vernissage /
  Familie / Film) recovered from the label for the renderers.
- **Museum directory** — a frozen snapshot in `src/frozen-museum-meta.ts`
  (captured from the live bundle, ~2026-05-25) plus manual additions in
  `src/museum-config.ts`. **museumsufer.de is no longer scraped.**
- **Translation** — DeepL DE→EN/FR runs in the derive step (`src/translate.ts`,
  `translateEvents()`); the cache rides in the committed bundle. At request
  time the worker only *reads* the pre-computed translations.
- **The actual museum scrapers** live in the monorepo's `packages/scrapers/`,
  not in this app — see "Museum API parsers" below.

## Tech stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 — only `likes` (anonymous like counts) and
  `push_subscriptions`. The old `museums` / `events` / `exhibitions` /
  `translations` tables were dropped in migration `0012`.
- **Translation:** DeepL API Free with bundle-cached translations (no Workers AI)
- **Date handling:** `@museumsufer/core/date` (dayjs + Europe/Berlin)
- **Search:** uFuzzy (client-side fuzzy search, vendored at `public/uFuzzy.iife.min.js`)
- **Framework:** [Hono](https://hono.dev) v4 with `@hono/zod-validator`
- **Frontend:** Server-rendered JSX (Hono), Tailwind CSS, htmx
- **Monorepo:** Turborepo with Bun workspaces (`apps/*`, `packages/*`)
- **Build:** wrangler (no bundler config)

## Key files

| File | Purpose |
|---|---|
| `src/index.tsx` | Hono app + middleware + routes (incl. the live JSON API and `/api/transit`); `scheduled()` dispatches push digests only. |
| `scripts/scrape.ts` | The GH-Action derive step: hub `EVENTS` → bbox + `museum:*` filter → DeepL → `src/scrape-data.ts`. |
| `src/scrape-data.ts` | **Auto-generated** bundle of museums + events + exhibitions + translations. |
| `src/frozen-museum-meta.ts` | Frozen museum directory snapshot — the canonical source of museum metadata. |
| `src/museum-config.ts` | Per-museum coords, RMV stop LIDs, flags, manual additions, Wikipedia overrides. |
| `src/queries.ts` | In-memory query layer over `SCRAPE_DATA` (date filters, joins, past-event pruning). |
| `src/api.ts` | `proxyImages`, `fetchDayData`, `getMuseumMap`, RSS/ICS feed builders, `markTranslated`. |
| `src/scraper.ts` | Pure-function directory assembler (frozen meta + manual museums). No network. |
| `src/translate.ts` | Two faces: `translateFields()` (worker, reads bundle) + `translateEvents()` (derive step, calls DeepL). |
| `src/image-proxy.ts` | Edge-cached `/img/*` proxy; allowlist derived from every `image_url` in the bundle. |
| `src/frontend.tsx` / `src/components.tsx` / `src/client-script.ts` | SSR page, cards, and the hashed client bundle. |
| `src/routes/*` | `static`, `feeds`, `museum`, `og`, `push`, `imprint`, `docs`. |

> **Stale-path warning for agents:** older revisions of this guide referenced
> `src/api-scrapers.ts`, `src/event-scraper.ts`, and `src/museum-apis.ts`, plus a
> "three-tier" / Workers-AI scraping design. Those no longer exist. The museum
> parsers moved to `packages/scrapers/src/_museums/` and the AI fallback was
> removed.

## Museum API parsers (now in `packages/scrapers`)

The per-museum parsers live in `packages/scrapers/src/_museums/`:

- **`config.ts`** — `MUSEUMS` registry: per-museum `eventApi` / `exhibitionApi`
  endpoints + types, coords, flags (`proxy`, `skipEvents`, `hidden`, `spa`),
  `manualExhibitions`. (`apps/frankfurt-museums/src/museum-config.ts` is the
  app-side copy used for the directory + transit; keep the two in sync when
  adding a museum.)
- **`api.ts`** — ~26 typed parsers behind `fetchEventsFromApi()` /
  `fetchExhibitionsFromApi()`, each dispatched by the `type` string
  (`tribe-events`, `historisches`, `juedisches`, `staedel`, `senckenberg`,
  `my-calendar`, `liebieghaus`, `mak`, `stadtgeschichte-html`, `dommuseum`,
  `ledermuseum`, `bibelhaus`, `fkv`, `fdh`, `dff-kino`, `archaeologisches`,
  `experiminta`, `caricatura`, `weltkulturen`, `eventon`, `buergerstiftung`,
  `schirn`, `mmk`, `giersch`, `fff`, `fritz-bauer-wollheim`, plus the
  exhibition-only types). The orchestrator
  `packages/scrapers/src/venues/_museums-frankfurt.ts` fans these out into one
  `VenueScrapeResult` per museum slug.

### Adding a new museum source

1. Find the endpoint (check `/wp-json/`, embedded JSON, `<script type="ld+json">`,
   network requests).
2. Add the slug + `eventApi` / `exhibitionApi` config to `MUSEUMS` in
   `packages/scrapers/src/_museums/config.ts` (and mirror the directory entry in
   the app's `src/museum-config.ts`).
3. Add the parser to `packages/scrapers/src/_museums/api.ts` (or reuse an
   existing `type` like `tribe-events`); the dispatch `switch` is exhaustive, so
   TypeScript errors if you forget a case.
4. Re-derive: `gh workflow run scrape.yml` (or `bun packages/event-hub/scripts/scrape.ts` locally).

### `museum_slug_override` fan-out

Five parsers route one upstream feed to sibling venue slugs via
`museum_slug_override`: `historisches` (→ junges-museum / porzellan-museum),
`juedisches` (→ judengasse), `mak` (→ ikonenmuseum), `schirn` (→ bockenheim),
`mmk` (→ zollamt / tower).

### Fetch proxy (`FETCH_PROXY_URL` + `FETCH_PROXY_TOKEN`)

Route a fetch through the proxy when a source blocks the runner's datacenter IP,
serves a broken TLS chain, or gates content behind a Cloudflare challenge / JS
render. Mark the source `proxy: true` (only `bibelhaus` uses it on the museum
side today); the deployed proxy escalates
`plain fetch → FlareSolverr (Cloudflare) → stealth Chromium render`. Useful
query params: `auto=1`, `render=1` + `wait=<ms>`, `format=md`, `block=0`. Full
spec at `$FETCH_PROXY_URL/docs`. The values live in GitHub as **Actions secrets**
(read in CI) and **Actions variables** (read in dev); locally hydrate from the
variables rather than pasting the bearer.

## Database (D1)

Two tables remain:

- **`likes`** — anonymous like counts (request-time writes; visitor hash from IP + day).
- **`push_subscriptions`** — Web Push (endpoint / keys / schedule / filters / failed_at).

```bash
wrangler d1 execute museumsufer-db --local  --file=./migrations/NNNN_name.sql
wrangler d1 execute museumsufer-db --remote --file=./migrations/NNNN_name.sql
```

## Frontend features

- i18n DE/EN/FR (Accept-Language + `?lang=` override), DeepL badge on translated text
- uFuzzy search (Ctrl/⌘-K + visible bar)
- Distance sorting ("In der Nähe") via `POST /api/transit` (RMV `mgate.exe`) + haversine fallback
- Per-event/exhibition `.ics`, subscribable `/feed.ics` + `/feed.xml`
- Visited tracking (localStorage), collapsible sections, "ending soon" badges, past-event hiding
- PWA (installable, offline SW), image proxy, WebMCP tools, FAQ with JSON-LD
- "Ask your AI" deep-links (shared `@museumsufer/core/llm-services`)

## Date/time scraping patterns

These patterns apply when authoring or fixing the museum parsers in
`packages/scrapers/src/_museums/api.ts` (and any venue scraper). The helpers
referenced live in `@museumsufer/core` (`date.ts`, `html.ts`).

### Dates
- German text dates ("15. März"): `GERMAN_MONTHS` lookup + `inferYear()`; always validate against `todayIso()` to reject past events.
- ISO / Unix timestamps: slice `YYYY-MM-DD`, or `new Date(seconds * 1000)` then `toBerlinDate()`. **Timezone is not uniform across parsers** — `giersch` reads UTC fields directly because the source stores Berlin wall-clock *as* UTC; most others use `toBerlin*` on real UTC. Don't "normalise" one to match another without checking the source.
- Malformed/empty: filter `.filter((ev) => ev.title && ev.date)` after mapping.
- Ranges: `end_date` only when `end_date !== start_date` (multi-day); start-year inference for "DD.MM. – DD.MM.YYYY" is a recurring off-by-a-year footgun.
- Exhibition-vs-event separation sometimes hinges on a duration heuristic (`historisches` / `dam-tribe` use ≥7 days).

### Times
- `nullIfMidnight(time)` converts "00:00" → null (all-day). Apply **after** extracting time.
- German "14.30 Uhr" vs ISO "14:30": normalise `.`→`:`; hour-only fallback `(?:ab\s+)?(\d{1,2})\s*Uhr` → `HH:00`.
- Time ranges in one field ("14:00–16:00"): split on `[-–]`, first → `time`, second → `end_time`.
- Slice ISO times to `HH:MM` (positions 11:16); never store full ISO times.

### Titles
- `stripHtml()` titles before use; extract date/time into separate fields **before** building the record so they don't leak into the title.
- `truncate()` / `truncateHtml()` for descriptions, never for titles.

## QA: checking a scraper

1. **Run the hub locally:** `bun packages/event-hub/scripts/scrape.ts` (set `TMDB_API_KEY` / `DEEPL_API_KEYS` if you want enrichment), or `gh workflow run scrape.yml`.
2. **Re-derive this app:** `bun run -F @museumsufer/frankfurt-museums scrape`.
3. **Spot-check the bundle:** `grep -c "your-museum-slug" apps/frankfurt-museums/src/scrape-data.ts`.
4. **Inspect by label:** `bun --cwd packages/event-hub query --source <slug>`.
5. **Daily audit:** `.github/workflows/scraper-audit.yml` flags under-delivering scrapers and hands them to Copilot; verified-empty/seasonal sources go in `packages/event-hub/scripts/audit-allowlist.json`, not code.

## Investigated but dropped

- Workers AI (`@cf/meta/llama-*`) HTML→event fallback — removed; the event hub uses deterministic parsers only.
- museumsufer.de directory scrape — replaced by the frozen snapshot.
- SCHIRN WP API (`ho_event_data` corruption), Curator.io for Jüdisches Museum, Workers AI m2m100 translation — all rejected; see git history.

## Deployment

Automated on git push (Cloudflare git integration). The D1 id in
`wrangler.jsonc` backs `likes` + `push_subscriptions`. The scrape pipeline runs
in GitHub Actions, not the worker; its DeepL / proxy / TMDb / OMDb secrets live
in GH Secrets, not `wrangler secret put`. There is no `/scrape/*` endpoint and
no `SCRAPE_SECRET`.
