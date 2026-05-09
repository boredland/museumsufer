# Frankfurt culture monorepo

Two Cloudflare Workers that aggregate Frankfurt cultural programming into single-page apps. Both run on the same shape: a daily/hourly GitHub Action regenerates a typed JSON bundle (`src/scrape-data.ts`) committed to the repo; Cloudflare's git integration redeploys the worker on each push; the worker reads from the bundled data with no D1 hot-path.

## Apps

### [`apps/frankfurt-museums`](apps/frankfurt-museums) → [museumsufer.app](https://museumsufer.app)

Daily exhibitions and events for ~40 Museumsufer museums. Aggregates from museumsufer.de + per-museum APIs (15+ deterministic parsers in `api-scrapers.ts`: Tribe Events, TYPO3 calendarize, schema.org Event microdata, WP REST + ACF, RSS, Kirby CMS, …). DeepL EN/FR translation runs in the same scrape pipeline; the cache rides in the bundle. Image proxy with edge caching, distance sorting via RMV, fuzzy search, PWA.

- Scrape: daily 06:00 UTC via `.github/workflows/scrape.yml` (museums job)
- D1: `likes` only (request-time user writes)

### [`apps/frankfurt-theaters`](apps/frankfurt-theaters) → [frankfurt.ins.theater](https://frankfurt.ins.theater)

Hourly performance schedule for 24 Frankfurt theaters — Schauspiel, Oper, Mousonturm, English Theatre, Komödie, Tigerpalast, the Reservix-fronted small houses, plus a dozen long-tail venues. Each theater has its own scraper module under `src/scrapers/` (Reservix HTML, Tribe Events REST, MEC plugin, schema.org microdata, custom CMSes, …). Editorial Programmheft styling — Fraunces serif, JetBrains Mono numerals, single brick-red accent.

- Scrape: hourly 07–19 UTC via `.github/workflows/scrape.yml` (theaters job)
- D1: `feedback` only (user reports)

### [`apps/fetch-proxy`](apps/fetch-proxy)

Generic upstream-fetch proxy used by museums when a museum API blocks edge fetches by region or User-Agent.

## Packages

- `packages/core` — shared utilities: hash, calendar URLs, German formatting, theme FOUC bootstrap, manifest/robots/api-catalog builders, security headers, UTM, scrape logging, bundle writer, null-last comparator
- `packages/config` — shared `tsconfig` and `biome` presets

## Stack

- Cloudflare Workers (TypeScript)
- [Hono](https://hono.dev) v4 + JSX SSR; theaters uses htmx for the date-strip swap
- Tailwind v4 (museums) / hand-rolled lightningcss (theaters)
- [Bun](https://bun.sh) for tooling — installs, scripts, the scrape pipeline (`bun:sqlite`-free, pure-function)
- Turborepo workspaces
- GitHub Actions for scrape; Cloudflare git integration for deploys

## Common commands

```bash
mise use -g bun@latest                                  # one-time
bun install                                             # from repo root
bun run dev                                             # all apps
bun run typecheck
bun run lint
bun run -F @museumsufer/frankfurt-theaters scrape       # one-shot local scrape
bun run -F @museumsufer/frankfurt-museums scrape
gh workflow run scrape.yml -f app=all                   # trigger CI scrape
```

Per-app docs live next to the app (`apps/frankfurt-museums/README.md`, `apps/frankfurt-theaters/README.md`).
