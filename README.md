# Frankfurt culture monorepo

Six Cloudflare Workers that aggregate Frankfurt (plus Landau in der Pfalz) cultural programming into single-page apps. All run on the same shape: a daily/hourly GitHub Action runs the hub scrape into `packages/event-hub` and per-app derive steps regenerate typed bundles (`src/scrape-data.ts`) committed to the repo; Cloudflare's git integration redeploys each worker on push; the workers read from the bundled data with no D1 hot-path.

## Apps

### [`apps/frankfurt-museums`](apps/frankfurt-museums) → [museumsufer.app](https://museumsufer.app)

Daily exhibitions and events for ~40 Museumsufer museums. Aggregates from museumsufer.de + per-museum APIs (15+ deterministic parsers in `api-scrapers.ts`: Tribe Events, TYPO3 calendarize, schema.org Event microdata, WP REST + ACF, RSS, Kirby CMS, …). DeepL EN/FR translation runs in the same scrape pipeline; the cache rides in the bundle. Image proxy with edge caching, distance sorting via RMV, fuzzy search, PWA.

- Scrape: daily 06:00 UTC via `.github/workflows/scrape.yml` (museums job)
- D1: `likes` only (request-time user writes)

### [`apps/frankfurt-theaters`](apps/frankfurt-theaters) → [frankfurt.ins.theater](https://frankfurt.ins.theater)

Hourly performance schedule for 24 Frankfurt theaters — Schauspiel, Oper, Mousonturm, English Theatre, Komödie, Tigerpalast, the Reservix-fronted small houses, plus a dozen long-tail venues. Each theater has its own scraper module under `src/scrapers/` (Reservix HTML, Tribe Events REST, MEC plugin, schema.org microdata, custom CMSes, …). Editorial Programmheft styling — Fraunces serif, JetBrains Mono numerals, single brick-red accent.

- Scrape: hourly 07–19 UTC via `.github/workflows/scrape.yml` (theaters job)
- D1: `feedback` only (user reports)

### [`apps/konzert-haus`](apps/konzert-haus) → [frankfurt.konzert.haus](https://frankfurt.konzert.haus)

Hourly concert schedule for classical, jazz, sacred, world, experimental, and chamber music across Frankfurt and the Rhein-Main region — Alte Oper, Ensemble Modern, hr-Bigband, Holzhausenschlösschen, and more. Multi-city ready via host-header routing.

- Scrape: hourly 09–21 CEST via `.github/workflows/scrape.yml` (konzert-haus job)
- D1: none

### [`apps/lehrhaus`](apps/lehrhaus) → [frankfurt.lehr.salon](https://frankfurt.lehr.salon)

Daily index of public lectures, readings, and discussions in Frankfurt — Polytechnische Gesellschaft, Haus am Dom, Jüdische Gemeinde, Literaturhaus, Bürgeruniversität, Institut für Sozialforschung, Evangelische Akademie, Sigmund-Freud-Institut, Denkbar, and more. Three formats (Vortrag / Lesung / Diskussion), with a rolling next-7-days view and cross-imports of Vortrag-class events from the museums and theaters apps. Editorial "annotated quarto" identity — foxed paper, iron-gall ink, rubric red, pilcrow anchors.

- Scrape: hourly via the shared `scrape.yml` (derives from `packages/event-hub`)
- D1: `push_subscriptions` (Web Push digest opt-ins)

### [`apps/lichtspiel-haus`](apps/lichtspiel-haus) → [frankfurt.lichtspiel.haus](https://frankfurt.lichtspiel.haus)

Daily film-screening programme for the Frankfurt arthouse + repertory cinemas — DFF Deutsches Filminstitut, Astor, Cinéma / Eldorado / Harmonie, Pupille, Mal seh'n, Murnau Filmtheater, Caligari, Filmforum Höchst, plus the long-tail Rhein-Main houses. TMDb-enriched posters and synopses (DeepL EN fallback), OMDb-backed Rotten Tomatoes + IMDb ratings with canonical deep links, mark-as-seen state across films, film-strip date slider in a Jugendstil / Saul-Bass register.

- Scrape: hourly via the shared `scrape.yml` (derives from `packages/event-hub`)
- D1: `feedback`

### [`apps/landau-today`](apps/landau-today) → [landau.today](https://landau.today)

Daily events for Landau in der Pfalz and the Südliche Weinstraße. Six public sources stitched into a single SSR page with URL-bound category + date filters. The only non-Frankfurt app in the monorepo, shipping a different display font + linked stylesheet pipeline.

- Scrape: hourly via the shared `scrape.yml`
- D1: none

## Packages

- `packages/core` — shared utilities: hash, calendar URLs, German formatting, theme FOUC bootstrap, manifest/robots/api-catalog builders, security headers, UTM, scrape logging, bundle writer, null-last comparator, hreflang + locale detection, HtmlHead with preload / preconnect hooks
- `packages/event-hub` — central scrape orchestrator that fans out to the per-venue scrapers in `packages/scrapers`, classifies events via `packages/classify`, and runs the TMDb/OMDb/DeepL enrichment passes. Each app reads from the resulting `EVENTS` array via its own `scripts/scrape.ts` derive step.
- `packages/scrapers` — per-venue scraper modules (Reservix HTML, Tribe Events REST, schema.org microdata, WP REST + ACF, RSS, Kirby CMS, …) consumed by event-hub.
- `packages/classify` — label-based event classifier (`film:cinema`, `music:classical`, `talk:lecture`, …) driving which app picks up which event.
- `packages/config` — shared `tsconfig` and `biome` presets

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR; htmx for the partial-swap routes
- Tailwind v4 (museums) / hand-rolled lightningcss (everyone else)
- [Bun](https://bun.sh) for tooling — installs, scripts, the scrape pipeline (`bun:sqlite`-free, pure-function)
- Turborepo workspaces
- GitHub Actions: hub scrape (`scrape.yml`), nightly Lighthouse + SEO budget enforcement (`lighthouse.yml`), daily manifest-screenshot + OG-image regen against prod (`regen-assets.yml`)
- Cloudflare git integration for deploys

## Common commands

```bash
mise use -g bun@latest                                  # one-time
bun install                                             # from repo root
bun run dev                                             # all apps
bun run typecheck
bun run lint
bun scripts/regen-screenshots.ts --prod                 # manifest screenshots
bun scripts/regen-og-images.ts                          # OG raster from public/og-image.svg
gh workflow run scrape.yml                              # trigger hub scrape + per-app derives
gh workflow run regen-assets.yml                        # screenshots + OG
gh workflow run lighthouse.yml                          # CWV / a11y / SEO budgets
```

Per-app docs live next to the app (`apps/<slug>/README.md`).
