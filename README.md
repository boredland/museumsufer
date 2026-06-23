# Frankfurt + Hamburg culture monorepo

Six Cloudflare Workers that aggregate cultural programming for **Frankfurt** and **Hamburg** — plus **Landau in der Pfalz** — into edge-rendered apps. Same shape across all of them: one hourly GitHub Action (`scrape.yml`) runs the hub scrape into `packages/event-hub`, then per-app derive steps regenerate typed bundles (`src/scrape-data.ts`) committed to the repo in a single commit; Cloudflare's git integration redeploys each worker on push; workers render from the bundled data with **no DB on the read path** (D1 is used only for request-time user writes).

Five of the six are multi-city culture verticals (museums, theater, concerts, lectures, cinema), each a single Worker serving Frankfurt and Hamburg under `<city>.<apex>` subdomains. `landau-today` is single-city.

## Cities

Cities live in one source of truth — `packages/core/src/cities.ts` (`CITIES`) — currently **Frankfurt** and **Hamburg**.

- **Hosts** — each city is served at `<city>.<apex>` (e.g. `frankfurt.konzert.haus` / `hamburg.konzert.haus`). The bare apex (`konzert.haus`) 302-redirects to the nearest city by Cloudflare edge geolocation (`cityMiddleware({ apexBehavior: "geo" })` in `packages/core/src/city-routing.ts`). `museumsufer.app` is an SEO-primary alias host pinned to Frankfurt (resolved without a redirect).
- **Switcher** — the masthead `CitySwitch` (`packages/core/src/cityswitch.tsx`) lists only the cities a vertical actually has data for (`supportedCities`, derived per bundle), and degrades to a plain locality label when a vertical covers a single city.
- **Event → city** — declarative first (a scraper/orchestrator may set `event.city`), else geometric: a bbox pre-filter plus an optional precise polygon (`cityFor` / `cityOf`), so neighbouring cities can share a bbox yet split cleanly.

Hamburg coverage is rolling out vertical by vertical — live in museums, theater and lectures; concerts and cinema are wired for both cities and fill in as programming lands.

**Roadmap.** Hamburg proved the machinery is city-agnostic — the city model, geo-routing, per-city custom domains and the masthead switcher carry any number of cities, so a new one is mostly data + scrapers, not architecture. A backlog of [`city-expansion`](https://github.com/boredland/museumsufer/labels/city-expansion) discovery tickets now maps **every German city over 150k** — Berlin, Munich, Cologne, the Rhine-Ruhr, Saxony, and the northern, central and south-western hubs — into per-vertical venue inventories (with proposed geofence + reuse notes) for staged, vertical-by-vertical rollout.

## Apps

### [`apps/museumsufer`](apps/museumsufer) → [museumsufer.app](https://museumsufer.app) · `{frankfurt,hamburg}.ins.museum`

Daily exhibitions and events for ~40 Frankfurt Museumsufer museums, now extending to Hamburg (Hamburger Kunsthalle, Museum für Kunst und Gewerbe, Deichtorhallen, SHMH houses, …). Aggregates from museumsufer.de + per-museum APIs (15+ deterministic parsers in `api-scrapers.ts`: Tribe Events, TYPO3 calendarize, schema.org Event microdata, WP REST + ACF, RSS, Kirby CMS, …). DeepL EN/FR translation runs in the same scrape pipeline; the cache rides in the bundle. Image proxy with edge caching, distance sorting via RMV, fuzzy search, PWA.

- Scrape: hourly via the shared `scrape.yml` (museums derive; `museumsufer.de` is fetched directly and runs `continue-on-error`)
- D1: `likes` + `push_subscriptions` (request-time user writes)

### [`apps/ins-theater`](apps/ins-theater) → `{frankfurt,hamburg}.ins.theater`

Hourly performance schedule for Frankfurt theaters — Schauspiel, Oper, Mousonturm, English Theatre, Komödie, Tigerpalast, the Reservix-fronted small houses, plus a dozen long-tail venues — alongside Hamburg houses (Ernst Deutsch Theater, Alma Hoppes Lustspielhaus, Centralkomitee, …). Each theater has its own scraper module under `src/scrapers/` (Reservix HTML, Tribe Events REST, MEC plugin, schema.org microdata, custom CMSes, …). Editorial Programmheft styling — Fraunces serif, JetBrains Mono numerals, single brick-red accent; the masthead carries a city-neutral "T." mark.

- Scrape: hourly via the shared `scrape.yml` (theaters derive)
- D1: `feedback` + `push_subscriptions`

### [`apps/konzert-haus`](apps/konzert-haus) → `{frankfurt,hamburg}.konzert.haus`

Hourly concert schedule for classical, jazz, sacred, world, experimental, and chamber music across Frankfurt and the Rhein-Main region — Alte Oper, Ensemble Modern, hr-Bigband, Holzhausenschlösschen, and more. Multi-city under the `<city>.konzert.haus` host scheme.

- Scrape: hourly via the shared `scrape.yml` (konzert-haus derive)
- D1: `push_subscriptions`

### [`apps/lehrhaus`](apps/lehrhaus) → `{frankfurt,hamburg}.lehr.salon`

Daily index of public lectures, readings, and discussions — Polytechnische Gesellschaft, Haus am Dom, Jüdische Gemeinde, Literaturhaus, Bürgeruniversität, Institut für Sozialforschung, Evangelische Akademie, Sigmund-Freud-Institut, Denkbar, and more — with Hamburg coverage rolling in. Three formats (Vortrag / Lesung / Diskussion), with a rolling next-7-days view and cross-imports of Vortrag-class events from the museums and theaters apps. Editorial "annotated quarto" identity — foxed paper, iron-gall ink, rubric red, pilcrow anchors.

- Scrape: hourly via the shared `scrape.yml` (derives from `packages/event-hub`)
- D1: `push_subscriptions` (Web Push digest opt-ins)

### [`apps/lichtspiel-haus`](apps/lichtspiel-haus) → `{frankfurt,hamburg}.lichtspiel.haus`

Daily film-screening programme for the Frankfurt arthouse + repertory cinemas — DFF Deutsches Filminstitut, Astor, Cinéma / Eldorado / Harmonie, Pupille, Mal seh'n, Murnau Filmtheater, Caligari, Filmforum Höchst, plus the long-tail Rhein-Main houses; wired for Hamburg under the `<city>.lichtspiel.haus` scheme. TMDb-enriched posters and synopses (DeepL EN fallback), OMDb-backed Rotten Tomatoes + IMDb ratings with canonical deep links, mark-as-seen state across films, film-strip date slider in a Jugendstil / Saul-Bass register.

- Scrape: hourly via the shared `scrape.yml` (derives from `packages/event-hub`)
- D1: `push_subscriptions`

### [`apps/landau-today`](apps/landau-today) → [landau.today](https://landau.today)

Daily events for Landau in der Pfalz and the Südliche Weinstraße. Six public sources stitched into a single SSR page with URL-bound category + date filters. The only single-city app in the monorepo (apex `landau.today` + `www.landau.today`), shipping a different display font + linked stylesheet pipeline.

- Scrape: hourly via the shared `scrape.yml`
- D1: `push_subscriptions`

## Packages

- `packages/core` — shared utilities: the city model + geo-routing + masthead switcher (`cities.ts`, `city-routing.ts`, `cityswitch.tsx`), hash, calendar URLs, German formatting, theme FOUC bootstrap, manifest/robots/api-catalog builders, security headers, UTM, scrape logging, bundle writer, null-last comparator, hreflang + locale detection, HtmlHead with preload / preconnect hooks
- `packages/event-hub` — central scrape orchestrator that fans out to the per-venue scrapers in `packages/scrapers`, classifies events via `packages/classify`, and runs the TMDb/OMDb/DeepL enrichment passes. Each app reads from the resulting `EVENTS` array via its own `scripts/scrape.ts` derive step.
- `packages/scrapers` — per-venue scraper modules (Reservix HTML, Tribe Events REST, schema.org microdata, WP REST + ACF, RSS, Kirby CMS, …) consumed by event-hub.
- `packages/classify` — label-based event classifier (`film:cinema`, `music:classical`, `talk:lecture`, …) driving which app picks up which event.
- `packages/config` — shared `tsconfig` and `biome` presets

Scrapers that need to bypass datacenter-IP blocks, broken TLS chains, or Cloudflare challenges route through an **external** fetch proxy (`FETCH_PROXY_URL` + `FETCH_PROXY_TOKEN`); `apps/fetch-proxy` is no longer an in-repo worker.

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR; htmx for the partial-swap routes
- Tailwind v4 (museums) / hand-rolled lightningcss (everyone else)
- [Bun](https://bun.sh) for tooling — installs, scripts, the scrape pipeline (`bun:sqlite`-free, pure-function)
- Turborepo workspaces
- GitHub Actions: hourly hub scrape (`scrape.yml`), daily scraper-health audit that hands under-delivering scrapers to the Copilot coding agent (`scraper-audit.yml`), nightly Lighthouse + SEO budget enforcement (`lighthouse.yml`), daily manifest-screenshot + OG-image regen against prod (`regen-assets.yml`)
- Cloudflare git integration for deploys

## Common commands

```bash
mise use -g bun@latest                                  # one-time
bun install                                             # from repo root
bun run dev                                             # all apps
bun run typecheck
bun run lint
bun scripts/regen-screenshots.ts --prod                 # manifest screenshots (per-city variants)
bun scripts/regen-og-images.ts                          # OG raster from public/og-image.svg
gh workflow run scrape.yml                              # trigger hub scrape + per-app derives
gh workflow run regen-assets.yml                        # screenshots + OG
gh workflow run lighthouse.yml                          # CWV / a11y / SEO budgets
gh workflow run scraper-audit.yml                       # audit committed bundle for under-delivering scrapers
```

Per-app docs live next to the app (`apps/<slug>/README.md`).
