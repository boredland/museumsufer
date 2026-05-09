# landau.today

Cloudflare Worker that aggregates events for Landau in der Pfalz and the
Südliche Weinstraße from six public sources into a single SSR page with
URL-bound category and date filters.

**Live:** [landau.today](https://landau.today) · [www.landau.today](https://www.landau.today)

## Architecture

```
GitHub Action (.github/workflows/scrape.yml, landau job)
  ↓ daily 06:30 UTC
  ↓ runs `bun apps/landau-today/scripts/scrape.ts`
  ↓ pulls all six sources in parallel (~7 s)
  ↓ 3-pass dedup, classifier, past-event prune
  ↓ writes apps/landau-today/src/scrape-data.ts (typed module)
  ↓ commits + pushes if content actually changed
Cloudflare git integration
  ↓ redeploys the worker with the new bundled data
Worker
  ↓ imports SCRAPE_DATA, in-memory filters serve every read path
```

No database — the worker is stateless. All event reads run in-memory off
the bundled module; deploy = data refresh.

## Sources

| Source | Domain | Mechanism | Notes |
|---|---|---|---|
| Kulturnetz Landau | `kulturnetz-landau.de` | schema.org microdata across 15 category pages | best categorisation; URL slug carries category authoritatively |
| Stadt Landau | `www.landau.de` | public ICS feed + paginated HTML cards (ISO-8859-1) | merge by title; HTML adds image + stable FID |
| Hambacher Schloss | `hambacher-schloss.de` | Modern Events Calendar plugin RSS with `mec:startDate`/`mec:startHour` | 8 km from Landau; symbolically central |
| RPTU Landau | `rptu.de` | university newsroom RSS, filtered by "Landau" keyword | mixed-campus feed; Kaiserslautern dropped |
| Südliche Weinstraße | `www.suedlicheweinstrasse.de` | TYPO3 sfcontenthub paginated listing; date encoded in URL slug | regional wine-festival coverage; ~50 villages |
| Pfalz.de | `www.pfalz.de` | sitemap-driven discovery → city-allowlist verification → per-occurrence expansion | bounded by city allowlist + 30-day occurrence horizon |

Each scraper is a pure function in `src/scrapers/<name>.ts`. To add a new
one:
1. Implement `scrapeXyz(opts): Promise<Omit<Event, "id">[]>`.
2. Add the source ID to `EventSource` in `src/types.ts` and to
   `SOURCE_RANK` in `scripts/scrape.ts` (lower wins on dedup).
3. Wire the call into `scripts/scrape.ts`.

## Category taxonomy (16 slugs)

`konzert · theater · tanz · kino · kabarett · literatur · vortrag ·
ausstellung · feste · junge-kultur · kurse · nachtleben · gedenken ·
exkursion · sport · sonstiges`

Each category has a printer's-ornament glyph and one of five mood tones
(`rotwein`, `ocker`, `reblaus`, `schiefer`, `ink`) — see `src/categories.ts`.
A scraper either:
- maps an upstream-category label onto a slug
  (`KULTURNETZ_CATEGORY_MAP`, `LANDAU_DE_KATID_MAP`, the SÜW
  `mapCategory()`), or
- falls back to `classifyEventByText(title, description)` — keyword
  cascade tuned for German cultural vocabulary + wine-region terms.

`category` is non-optional on `Event`; the classifier returns
`"sonstiges"` rather than null so the type system can rely on it.

## Cross-source dedup

Three passes in `scripts/scrape.ts:mergeAndId`:

1. **Strict normalised title** — bit-identical cross-source duplicates.
2. **Core title** — strips a leading `Venue:` / `Series —` prefix, so
   SÜW's `atelier29: Thalamus` collapses onto Kulturnetz's `Thalamus`.
3. **Multi-day vs per-occurrence** — drops per-day SÜW Ausstellung
   records when a landau.de multi-day record (with `end_date`) covers the
   same dates. Fixed the Suchtbilder duplication.

Source priority for tie-breaks: kulturnetz > landau-de > hambach > rptu
> suew > pfalz-de.

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR (no client framework)
- Tailwind v4 (utility classes only — most of the design is in plain CSS
  in `src/app.css`)
- [Bun](https://bun.sh) for installs, scripts, and the scrape pipeline
- Turborepo workspace alongside `frankfurt-museums` and `frankfurt-theaters`

No D1, no Workers AI, no DeepL, no `nodejs_compat` — the worker runtime
path is tight (~73 KB gzipped, ~6 ms startup).

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
| `GET /manifest.json` | 24 h | PWA manifest (no SW yet) |
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

Worthwhile candidates ported from `frankfurt-museums`, ranked by ROI:

1. **Fuzzy search** (`Fuse.js` + Cmd-K) — 414 events deserve an in-page
   search. Largest UX win available.
2. **Health-check workflow** — `bun health-check` validates each
   upstream returns expected fields; GH Action opens an issue on
   regressions. Catches silent breakage when a source changes its URL or
   markup. Already exists for the other apps.
3. **PWA / service worker** — manifest is served but the SW was dropped
   when scaffolding. Re-adding `src/service-worker.ts` plus
   `bun screenshots:manifest` makes the app installable.
4. **htmx partial swap** — date-strip and chip-row clicks could swap
   `<main>` instead of full-navigating. Theaters already does this for
   the date strip; idiom is well-established in this repo.
5. **Dark theme** — many Konzert / Nachtleben events are evening-only;
   a paper-on-ink inversion of the current palette would suit. CSS
   variables are already structured for it (`--color-paper`/`--color-ink`).
6. **FAQ accordion** — both sister apps recently grew an FAQ section in
   matching idiom (Bauhaus-geometric for museums, Programmheft for
   theaters). A Heimatzeitung-style FAQ would round out the SEO surface.
7. **`/api/docs`** — OpenAPI reference page via `@scalar/hono-api-reference`.
   Cheap; pairs nicely with the existing `/llms.txt`.
8. **Share-this-event** with `navigator.share` + clipboard fallback +
   highlight-on-arrival pulse. Small but polished.

Explicitly **NOT** worth porting (Frankfurt-specific or out of scope):
- Distance / RMV transit (different transit authority; the city is
  walkable anyway)
- DeepL translation (DE-only is on-brand for the Pfälzer
  Heimatzeitung framing)
- Like counter (user explicitly opted out)
- AI-fallback scraping (every source we have is structurally clean)
- Multi-museum config layer (events carry their own venue/source/city)

## Layout

```
apps/landau-today/
├── public/                       # static assets (favicon, generated styles.css)
├── scripts/
│   └── scrape.ts                 # daily scrape orchestrator + dedup
├── src/
│   ├── index.tsx                 # Hono app, security headers, CSP
│   ├── frontend.tsx              # full-page SSR, JSON-LD, masthead
│   ├── components.tsx            # ChipRow, DateStrip, Ledger, Broadside
│   ├── queries.ts                # in-memory filters over SCRAPE_DATA
│   ├── categories.ts             # 16-slug taxonomy + classifier
│   ├── shared.ts                 # German date/time formatters, escape
│   ├── date.ts                   # re-exports from @museumsufer/core/date
│   ├── image-proxy.ts            # /img/* with host allowlist
│   ├── types.ts                  # Event, ScrapeData, EventSource
│   ├── scrape-data.ts            # AUTO-GENERATED bundle
│   ├── routes/
│   │   ├── event.tsx             # /event/:id (HTML + .ics)
│   │   ├── feeds.ts              # /feed.xml + /feed.ics
│   │   └── static.ts             # robots, sitemap, manifest, llms.txt, OG
│   └── scrapers/
│       ├── kulturnetz.ts
│       ├── landau-de.ts
│       ├── hambacher-schloss.ts
│       ├── rptu.ts
│       ├── suew.ts
│       └── pfalz-de.ts
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```
