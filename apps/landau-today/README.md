# landau.today

Cloudflare Worker that aggregates events for Landau in der Pfalz and the
Südliche Weinstraße from six public sources into a single SSR page with
URL-bound category and date filters.

**Live:** [landau.today](https://landau.today) · [www.landau.today](https://www.landau.today)

## Architecture

```
GitHub Action (.github/workflows/scrape.yml)
  ↓ daily/hourly cron
  ↓ runs the hub scrape (packages/event-hub) once, then
  ↓ `bun apps/landau-today/scripts/scrape.ts` derives this app's slice:
  ↓   keeps hub EVENTS in LANDAU_BBOX from the six Landau-region sources,
  ↓   four-pass cross-source dedup, then Nominatim geocoding (cached)
  ↓ writes apps/landau-today/src/scrape-data.ts (typed module)
  ↓ commits + pushes if content actually changed
Cloudflare git integration
  ↓ redeploys the worker with the new bundled data
Worker
  ↓ imports SCRAPE_DATA, in-memory filters serve every read path
```

Event reads run in-memory off the bundled module; deploy = data refresh.
D1 is used only for Web Push subscriptions (`migrations/0001`), not for content.

## Sources

| Source | Domain | Mechanism | Notes |
|---|---|---|---|
| Kulturnetz Landau | `kulturnetz-landau.de` | schema.org microdata across 15 category pages | best categorisation; URL slug carries category authoritatively |
| Stadt Landau | `www.landau.de` | public ICS feed + paginated HTML cards (ISO-8859-1) | merge by title; HTML adds image + stable FID |
| Hambacher Schloss | `hambacher-schloss.de` | Modern Events Calendar plugin RSS with `mec:startDate`/`mec:startHour` | 8 km from Landau; symbolically central |
| RPTU Landau | `rptu.de` | university newsroom RSS, filtered by "Landau" keyword | mixed-campus feed; Kaiserslautern dropped |
| Südliche Weinstraße | `www.suedlicheweinstrasse.de` | TYPO3 sfcontenthub paginated listing; date encoded in URL slug | regional wine-festival coverage; ~50 villages |
| Pfalz.de | `www.pfalz.de` | sitemap-driven discovery → city-allowlist verification → per-occurrence expansion | bounded by city allowlist + 30-day occurrence horizon |

Each source is a canonical scraper in
`packages/scrapers/src/venues/<name>.ts` (registered in
`packages/scrapers/src/index.ts`) that emits a `landau:<category>` label.
To add a new source:
1. Implement the scraper in `packages/scrapers/` and register it.
2. Add the hub `source_slug` to `EventSource` in `src/types.ts` and to
   `SOURCE_RANK` in `scripts/scrape.ts` (lower wins on dedup).

The derive step picks it up automatically on the next scrape.

## Category taxonomy (16 slugs)

`konzert · theater · tanz · kino · kabarett · literatur · vortrag ·
ausstellung · feste · junge-kultur · kurse · nachtleben · gedenken ·
exkursion · sport · sonstiges`

Each category has a printer's-ornament glyph and one of five mood tones
(`rotwein`, `ocker`, `reblaus`, `schiefer`, `ink`) — see `src/categories.ts`.
Classification happens upstream in the hub (`@museumsufer/classify`,
`landau.ts`): each scraper either maps an upstream-category label onto a
slug (`KULTURNETZ_CATEGORY_MAP`, `LANDAU_DE_KATID_MAP`, the SÜW label map)
or falls back to `classifyLandauByText(title, description)` — a keyword
cascade tuned for German cultural vocabulary + wine-region terms. The
event arrives here pre-tagged with a `landau:<slug>` label; `src/categories.ts`
owns only the presentation (labels, glyphs, mood palette).

`category` is non-optional on `Event`; the classifier returns
`"sonstiges"` rather than null so the type system can rely on it.

## Cross-source dedup

Four passes in `scripts/scrape.ts:mergeAndId`:

1. **Strict normalised title** — bit-identical cross-source duplicates.
2. **Core title** — strips a leading `Venue:` / `Series —` prefix, so
   SÜW's `atelier29: Thalamus` collapses onto Kulturnetz's `Thalamus`.
3. **Multi-day vs per-occurrence** (`collapseMultiDayDuplicates`) — drops
   per-day SÜW Ausstellung records when a landau.de multi-day record (with
   `end_date`) covers the same dates.
4. **Title-prefix collapse** (`collapseTitlePrefixDuplicates`) — drops the
   longer title when a shorter one is its word-boundary prefix at the same
   date/time, merging any missing fields up.

Source priority for tie-breaks: kulturnetz > landau-de > hambach > rptu
> suew > pfalz-de.

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR (no client framework)
- Tailwind v4 (utility classes only — most of the design is in plain CSS
  in `src/app.css`)
- [Bun](https://bun.sh) for installs, scripts, and the scrape pipeline
- Turborepo workspace alongside `frankfurt-museums` and `frankfurt-theaters`

D1 is used only for Web Push subscriptions; no Workers AI, no DeepL, no
`nodejs_compat` — the worker runtime path stays tight.

## Routes

| Endpoint | Cache | Description |
|---|---|---|
| `GET /` | 15 min / 1 h SWR | Today's events (full SSR page) |
| `GET /?date=YYYY-MM-DD` | 15 min / 1 h SWR | All events on a specific date |
| `GET /c/:cat?date=YYYY-MM-DD` | 15 min / 1 h SWR | Filter by category |
| `GET /event/:id` | 15 min / 1 h SWR | Single event detail page |
| `GET /event/:id.ics` | — | Single event as ICS download |
| `GET /api/day?date=&category=` | — | JSON list, machine-readable |
| `GET /feed.xml` | 15 min / 1 h SWR | RSS (next 7 days) |
| `GET /feed.ics` | 15 min / 1 h SWR | ICS calendar (next 14 days) |
| `GET /img/<encoded-url>` | 7 d | Image proxy with allowlist |
| `GET /sitemap.xml` | 24 h | All canonical routes |
| `GET /robots.txt` | 24 h | + `User-agent: *` allow |
| `GET /llms.txt` | 24 h | API description for LLM agents |
| `GET /manifest.json` | 24 h | PWA manifest |
| `GET /sw.js` | — | Service worker (offline cache) |
| `GET /api/push/*` | — | Web Push subscribe / unsubscribe / key / me |
| `GET /og.svg` | 7 d | Open Graph card |
| `GET /impressum` | 1 h | Imprint |

## Design

Heimatzeitung × Weinetikett. Bodoni Moda + Newsreader on sandstone paper
(`#f2ead3`) with letterpress noise and a 5-mood category palette. German
typesetter's period in times (`19.45`, not `19:45`). Italic-on-hover; no
rounded corners; hairline rules instead of shadows. See
[`src/app.css`](src/app.css) and the design spec in the project history.

Differentiates from sister apps:
- **frankfurt-museums** — Bauhaus geometric, sans-serif, primary triad
- **frankfurt-theaters** — editorial Programmheft, Fraunces serif, brick-red
- **landau.today** — didone label, Bodoni + Newsreader, sandstone

## Development

```bash
bun install                 # from repo root
bun run -F @museumsufer/landau-today dev

# One-shot scrape locally — writes a fresh src/scrape-data.ts:
bun run -F @museumsufer/landau-today scrape

# Trigger the workflow:
gh workflow run scrape.yml -f app=landau

# Hit the API:
curl http://localhost:8787/api/day?date=2026-05-15
curl http://localhost:8787/api/day?date=2026-05-15&category=konzert
```

## Deployment

Automated on git push (Cloudflare git integration). Custom domains
configured via `wrangler.jsonc` `routes`:

```jsonc
"routes": [
  { "pattern": "landau.today", "custom_domain": true },
  { "pattern": "www.landau.today", "custom_domain": true }
]
```

A manual `bunx wrangler deploy` pushes the same artifact (no D1
migrations needed). Cloudflare provisions TLS for both apex and www
automatically.

## Possible future work

See [TODO.md](TODO.md) for the live port roadmap (with checked-off
items as they ship). Already in production: VRN navigate-to-destination,
Web Share, sort-by-location with Nominatim-geocoded venues.

## Layout

```
apps/landau-today/
├── public/                       # static assets (favicon, generated styles.css)
├── scripts/
│   └── scrape.ts                 # daily scrape orchestrator + dedup
├── src/
│   ├── index.tsx                 # Hono app, security headers, CSP, cron (push digests)
│   ├── frontend.tsx              # full-page SSR, JSON-LD, masthead
│   ├── components.tsx            # ChipRow, DateStrip, Ledger, Broadside
│   ├── client-script.ts          # /client.js — search, In-der-Nähe, visited, share, theme
│   ├── queries.ts                # in-memory filters over SCRAPE_DATA
│   ├── categories.ts             # 16-slug taxonomy: labels, glyphs, mood palette
│   ├── digest.ts                 # Web Push digest builder + dispatch (D1)
│   ├── i18n.ts                   # de/fr translation tables
│   ├── markdown.ts               # Accept: text/markdown rendering
│   ├── shared.ts                 # German date/time formatters, VRN + Maps links, escape
│   ├── date.ts                   # re-exports from @museumsufer/core/date
│   ├── image-proxy.ts            # /img/* with host allowlist
│   ├── service-worker.ts         # /sw.js source
│   ├── types.ts                  # Event, ScrapeData, EventSource, Env
│   ├── scrape-data.ts            # AUTO-GENERATED bundle
│   ├── geocode-cache.ts          # AUTO-GENERATED venue→coords cache (Nominatim)
│   └── routes/
│       ├── event.tsx             # /event/:id (HTML + /event/:id/feed.ics)
│       ├── api.ts                # /api/events, /api/events/:id, /api/categories
│       ├── feeds.ts              # /feed.xml + /feed.ics
│       ├── push.ts               # /api/push/{key,subscribe,unsubscribe,me}
│       ├── og.ts                 # /og/:id/image.svg
│       ├── docs.ts               # /api/docs (Scalar) + openapi.json
│       ├── imprint.tsx           # /impressum
│       └── static.ts             # robots, sitemap, manifest, llms.txt, sw, client.js
├── migrations/                   # D1 (push_subscriptions)
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```

The six Landau-region sources are scraped in `packages/scrapers/src/venues/`
(`kulturnetz-landau`, `landau-de`, `hambacher-schloss`, `rptu-campuskultur`,
`suew`, `pfalz-de`) — not in this app.
