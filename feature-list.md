# Feature list

Four public event sites + one internal proxy. Each public site is a Hono app on a Cloudflare Worker, with hourly-scraped data bundled into the worker, a D1 database for push subscriptions, and a small set of shared primitives in `packages/core` (security headers, robots/llms.txt, api-catalog, markdown rendering, WebMCP wiring, calendar popover, Turnstile lazy-load).

---

## museumsufer.app / frankfurt.ins.museum — `apps/frankfurt-museums`

Aggregated programme for Frankfurt's Museumsufer district (museums + exhibitions + events). Apex `ins.museum` 301-redirects to `frankfurt.ins.museum`; sitemap declares `museumsufer.app` as the canonical brand host.

### User-facing routes
- `GET /` — day view with date strip; `?date=YYYY-MM-DD&range=2-14&lang=de|en|fr`
- `GET /museum/:slug` — single museum: hours, exhibitions, events, JSON-LD `Museum` schema
- `GET /impressum` — imprint
- `GET /api/docs` — Scalar OpenAPI reference UI
- `GET /partial/content` — HTMX fragment for date/range swaps (returns `X-Date-Label`)

### APIs / feeds
- `GET /api/day`, `/api/events`, `/api/exhibitions`, `/api/museums` (`?date`, `?lang`)
- `GET /feed.ics` (+ alias `/calendar.ics`), `GET /api/event/:id.ics`
- `GET /feed.xml` (+ alias `/rss.xml`) — RSS 2.0, 7-day window
- `POST /api/transit` — RMV transit times + walking distance per museum (`{lat,lng}` body, 20 km radius)
- `POST /api/like` — anonymous likes (visitor hash from IP + day)
- `POST /api/contact` — Turnstile-verified, routed to `feedback@ins.museum`
- `GET /api/push/key | subscribe | unsubscribe | me`

### Discovery / agent-readiness
- `/robots.txt` (CF-managed Content Signals + worker sitemap pointer)
- `/sitemap.xml`, `/llms.txt`, `/.well-known/llms.txt`, `/.well-known/api-catalog`
- `/api/docs/openapi.json` (OpenAPI 3.1)
- `Link` headers on HTML: `api-catalog`, `service-desc`, `service-doc`, `describedby`
- Markdown content negotiation on day view + museum pages (`Accept: text/markdown`)
- **WebMCP tools:** `get_events`, `get_exhibitions`, `get_museums`, `get_day_overview`, `search_museumsufer`

### Interactive UI
- Date strip + range nav, HTMX content swaps with URL push
- Theme toggle (light/dark, localStorage, FOUC-prevention inline script)
- Per-event/exhibition like buttons (AJAX)
- Share menus building Google / Outlook / Yahoo calendar deep-links (UTM-tagged)
- Push digest signup dialog with per-museum filters and 3 schedules
- Client-side search (NFD + diacritic-strip)

### Scheduled jobs
- Crons `0 5,6 * * *`, `0 15,16 * * *`, `0 7,8 * * SUN` (Berlin-aware morning 07:00, afternoon 17:00, weekly Sunday 09:00); only the matching local hour dispatches the push digest
- Scraping runs in `.github/workflows/scrape.yml`, regenerates `src/scrape-data.ts`, push triggers CF redeploy

### i18n
- `de` (default), `en`, `fr`; `Accept-Language` detection, `?lang=` override, `Content-Language` per response, hreflang `<link rel=alternate>`

### Data sources
- ~20+ museum-specific scrapers under `src/scrapers/` covering Frankfurt's Museumsufer institutions (Städel, Schirn, MMK, Senckenberg, Jüdisches Museum, Historisches Museum, DAM, MAK, Liebieghaus, Weltkulturen, Bibelhaus, Dommuseum, Caricatura, FFF, FKV, Giersch, Ledermuseum, FDH, Archäologisches, Experiminta, Bürgerstiftung, MFK, DFF/Kino…) plus per-museum exhibition parsers

### Operational
- Cloudflare D1 binding `DB` (push subscriptions, likes)
- Turnstile (site key `0x4AAAAAADNxRIr9duIRP8ag`), `TURNSTILE_SECRET` via wrangler secret
- VAPID env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Cloudflare Email Routing → `feedback@ins.museum`
- `/img/*` image proxy with museum-domain allowlist

---

## frankfurt.ins.theater — `apps/frankfurt-theaters`

Aggregated theatre programme for Frankfurt. Apex `ins.theater` 301-redirects to the subdomain.

### User-facing routes
- `GET /` — day programme with 60-day date strip
- `GET /tag/:date` — dated programme
- `GET /theater/:slug` — single theatre with 60-day schedule
- `GET /partial/programme` — HTMX fragment
- `GET /impressum` (+ `/imprint` → 301)
- `GET /api/docs` — Scalar UI

### APIs / feeds
- `GET /api/day`, `/api/theaters`, `/api/theater/:slug`
- `GET /api/performances?from&to&theater` (≤ 60-day range), `GET /api/performance/:id`
- `GET /feed.ics` (14-day), `GET /performance/:id/feed.ics`
- `GET /feed.xml` / `/rss.xml`
- `POST /api/contact`, `GET|POST /api/push/{key,subscribe,unsubscribe,me}`

### Discovery / agent-readiness
- `/robots.txt`, `/sitemap.xml`, `/llms.txt` (+ `.well-known`), `/.well-known/api-catalog`, `/api/docs/openapi.json`
- `/manifest.json` (PWA)
- `Link` headers + markdown content negotiation on day and theatre views
- `X-Robots-Tag: noindex` on `/api/*` (excluding `/api/docs`)
- **WebMCP tools:** `get_performances`, `get_performances_range`, `get_theaters`, `get_theater`, `search_performances`

### Interactive UI
- 60-day date strip with performance counts; HTMX `hx-push-url` swaps
- Transit popover (RMV app, RMV web, Google Maps, Apple Maps deep-links)
- Calendar popover for per-performance ICS
- Status badges: "Ausverkauft", "Entfällt", "Restkarten"
- Push digest dialog (3 schedules + per-theatre filter)
- Contact dialog (Turnstile-gated)
- "Ask AI" buttons (ChatGPT / Claude / Perplexity deep-links, pre-filled date query)
- Service worker at `/sw.js` (cache v5)

### Scheduled jobs
- Same cron triad as museums; Berlin-local dispatch for morning / afternoon / Sunday digests
- Scraping in GitHub Action, hourly during the active Berlin window

### i18n
- German only (`de-DE`)

### Data sources
~23 venue-specific scrapers in `src/scrapers/` for: Schauspiel Frankfurt, Oper Frankfurt, The English Theatre, Die Komödie, Mousonturm, Neues Theater Höchst, Volksbühne, Stalburg, Tigerpalast, Die Schmiere, Dresden Frankfurt Dance Company, Papageno, Dramatische Bühne, Theater Willy Praml, Kellertheater, Gallus Theater, Theaterhaus, Internationales Theater, Galli Theater, Theater Alte Brücke, Die Käs, Theater Lempenfieber, Landungsbrücken.

### Operational
- D1 (`frankfurt-theaters-db`), Turnstile, VAPID push, Cloudflare Email → `feedback@ins.theater`

---

## frankfurt.konzert.haus — `apps/konzert-haus`

Concert programme aggregator (classical, jazz, sacred, world, experimental, chamber). Apex `konzert.haus` 301-redirects to `frankfurt.konzert.haus`. The URL path is city-scoped (`<city>.konzert.haus`) and currently serves Frankfurt + surrounding region.

### User-facing routes
- `GET /` — day programme with date strip + genre filter
- `GET /tag/:date` — dated programme (hreflang alternates de/en/fr)
- `GET /spielort/:slug` — single venue (60-day schedule, `MusicVenue` JSON-LD)
- `GET /genre/:slug` — genre listing (60-day window)
- `GET /impressum`
- `GET /api/docs` — Scalar UI

### APIs / feeds
- `GET /api/events?date|from|to[,genre,venue,city]` (range capped at 90 days)
- `GET /api/events/:id`, `GET /api/venues`, `GET /api/venues/:slug`
- Calendars: `/feed.ics`, `/spielort/:slug/feed.ics`, `/genre/:slug/feed.ics`, `/event/:id/feed.ics`
- `/feed.rss` (+ `/feed.xml` → redirect)
- `GET /og/:id/image.svg` — dynamic OG image
- `POST /api/contact`, push endpoints

### Discovery / agent-readiness
- `/robots.txt`, `/sitemap.xml`, `/llms.txt` (+ `.well-known`), `/.well-known/api-catalog`, `/api/docs/openapi.json`, `/manifest.json`
- `Link` headers; markdown content negotiation on day view + venue page
- **WebMCP tools:** `get_events`, `get_venues`, `list_venue_slugs`, `list_genres`, `search_programme`

### Interactive UI
- Calendar popover (add to device calendar) per event
- Genre pills (6 genres) + 60-day date strip; HTMX `partial/programme` swaps
- Push digest dialog with genre filter; contact dialog with Turnstile
- Theme toggle, language switcher (de/en/fr)
- Service worker at `/sw.js`
- Past-event filtering (hides events ≥ 30 min in the past on today's view; surfaces the hidden count)

### Scheduled jobs
- Same cron triad as the other apps; Berlin-aware morning / afternoon / Sunday digests

### i18n
- `de` (default), `en`, `fr`; full UI translation incl. genre labels

### Data sources
~19 venue scrapers in `src/scrapers/`, configured in `concert-config.ts`:
- **Frankfurt classical:** alte-oper, oper-frankfurt, dr-hochs-konservatorium, hfmdk, ensemble-modern, hr-sinfonieorchester, holzhausenschlösschen
- **Jazz:** hr-bigband, jazz-frankfurt, jazz-palmengarten
- **World / experimental:** brotfabrik, romanfabrik
- **Sacred:** andreas-koehs, kirchenmusik-dreikoenig, st-katharinen
- **Regional:** kronberg-academy, rheingau-musikfestival, bad-homburger-schlosskonzerte, bad-soden

### Operational
- D1 (`konzert-haus-db`), Turnstile, VAPID push, Cloudflare Email → `feedback@konzert.haus`
- UTM tagging on outbound ticket URLs via `buildUtm("frankfurt.konzert.haus")`

---

## landau.today — `apps/landau-today`

Aggregated cultural events for Landau in der Pfalz and the Südliche Weinstraße. Serves apex `landau.today` + `www.landau.today` (CF custom domains).

### User-facing routes
- `GET /` — today's events, optional `?date=YYYY-MM-DD`
- `GET /c/:cat` — category-filtered view (16 slugs)
- `GET /partial/content` — HTMX fragment for category/date swaps
- `GET /event/:id` — event detail (schema.org, calendar deep-links, VRN transit)
- `GET /event/:id.ics` — single-event iCal
- `GET /impressum` (+ `/imprint` → 301)
- `GET /api/docs`

### APIs / feeds
- `GET /api/day?date&category` — `{date, count, events[]}`
- `GET /api/events` — flexible (`date` or `from`/`to`), ≤ 90-day range
- `GET /api/events/:id`, `GET /api/categories`
- `GET /feed.xml` (RSS, 7-day), `GET /feed.ics` (14-day)
- `POST /api/contact` — Turnstile-verified → `feedback@landau.today`
- `GET|POST /api/push/{key,subscribe,unsubscribe,me}`

### Discovery / agent-readiness
- `/robots.txt`, `/sitemap.xml`, `/llms.txt` (+ `.well-known`), `/.well-known/api-catalog`, `/api/docs/openapi.json`
- `Link` headers; markdown content negotiation on `/` and `/c/:cat`
- **WebMCP tools:** `get_events`, `list_categories`, `search_events`

### Interactive UI
- Client-side search (`.js-search`), diacritic-fold + token match; ⌘/Ctrl+K shortcut
- Theme toggle (localStorage, FOUC inline)
- **"In der Nähe"** — geolocation haversine sort with distance badges; re-stamps order after htmx swap
- Visited-event tracking via `localStorage('landau-today-visited')`
- Per-row share with `?highlight=<id>`; native share API + clipboard fallback + toast
- `?highlight=` arrival animation (pulse + scrollIntoView)
- Service worker (offline cache)
- Push digest dialog (3 schedules + 16 category filters, iOS PWA hint, capability detection)
- Contact dialog (Turnstile lazy-load on open)

### Scheduled jobs
- Same cron triad; Berlin-aware morning/afternoon/Sunday digest delivery
- Scraping in `.github/workflows/scrape.yml`

### i18n
- `de` (default), `fr`; query `?lang=` + `Content-Language` per response

### Data sources (6 scrapers in `src/scrapers/`)
- `kulturnetz` — kulturnetz-landau.de (schema.org microdata, 15 category pages)
- `landau-de` — Advantic CMS; HTML listing joined with ICS feed by title; KatID → unified categories
- `hambacher-schloss` — WP + Modern Events Calendar RSS namespace
- `rptu` — RPTU newsroom RSS, filtered for "Landau"
- `suew` — TYPO3 sfcontenthub, 50+ villages, pagination cap
- `pfalz-de` — Drupal; sitemap pre-filter + per-event verification; recurring events fanned out 30-day horizon; concurrency-limited with overall budget cap

### Categories (16 unified slugs)
`konzert`, `theater`, `tanz`, `kino`, `kabarett`, `literatur`, `vortrag`, `ausstellung`, `feste`, `junge-kultur`, `kurse`, `nachtleben`, `gedenken`, `exkursion`, `sport`, `sonstiges`

### Operational
- D1 (`landau-today-db`), Turnstile, VAPID push, Cloudflare Email Routing
- `/img/*` image proxy with explicit upstream allowlist (kulturnetz, landau.de, suedlicheweinstrasse.de, pfalz.de, hambacher-schloss.de), 7-day edge TTL, strips `Set-Cookie`

---

## fetch-proxy — `apps/fetch-proxy` (internal)

Tiny Node service (Docker, node:22-alpine) that fetches HTML on behalf of the scrapers when an upstream blocks datacenter IPs or has a broken TLS chain.

- `GET /?url=<target>` — proxies the URL, returns body with original status + content-type. Sends a Chrome User-Agent, follows redirects, disables TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`).
- Bearer auth via `Authorization: Bearer <AUTH_TOKEN>` when `AUTH_TOKEN` env var is set (otherwise open).
- 400 if `url` missing, 401 on bad/missing token.
- No scheduled jobs; request-driven only.
- Scrapers route through it by setting `proxy: true` on the upstream config and reading `FETCH_PROXY_URL` + `FETCH_PROXY_TOKEN` from the worker env.

---

## Shared primitives — `packages/core`

Used by every public app. Keeps the four sites byte-for-byte consistent on the agent-facing surface.

- **`buildRobotsTxt`** — emits Sitemap + LLMs pointer; bot rules and Content-Signal directives are owned by Cloudflare's "Managed robots.txt" feature, which prepends them at the edge per-zone.
- **`buildApiCatalog`** — `/.well-known/api-catalog` linkset (api-catalog + service-desc + service-doc + status).
- **`buildManifest`** — PWA manifest builder.
- **`buildWebMcpScript` / `WebMcpToolDef`** — inline WebMCP registration (uses `navigator.modelContext.provideContext` with `registerTool` forward-compat).
- **`renderDayMarkdown` / `renderVenueMarkdown` / `wantsMarkdown`** — markdown views for content-negotiated agent responses.
- **`securityHeaders`** — standard security headers middleware (CSP, X-CTO, Referrer-Policy, Permissions-Policy).
- **`handleContactRequest`** — shared Turnstile-verified contact form → Cloudflare Email Routing.
- **`CalendarPopover` + `POPOVER_POSITIONING_SCRIPT`** — add-to-calendar UI.
- **`HTMX_LIFECYCLE_SCRIPT`, `TURNSTILE_LAZY_LOAD_SCRIPT`, `THEME_FOUC_SCRIPT`** — small inline JS snippets re-used across apps.
- **`buildHreflangAlternates`, `langSwitchItems`, `buildLangParam`** — i18n routing helpers.
- **`buildUtm`** — UTM tagger for outbound ticket / detail URLs.
- **Date helpers:** `todayIso`, `dateOffset`, `berlinHourMinute`, `formatLocalisedDateLong`, German month/weekday tables, `compareNullsLast`, `escapeHtml`.
