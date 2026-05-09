# landau.today — port roadmap

Items to port from `frankfurt-museums` (and a few from `frankfurt-theaters`),
ranked by ROI for landau.today. Tick when shipped.

All initial port targets are now live; remaining items are speculative
follow-ups, not blockers.

## Done

- [x] **VRN navigate-to-destination** — per-event "Anfahrt VRN ÖPNV"
      action linking the trip planner with the venue + city pre-filled.
      Region-correct equivalent of museumsufer's RMV link. Plus a Google
      Maps directions link as fallback.
- [x] **Web Share API** — `Teilen` button on the event detail page with
      `navigator.share` → clipboard fallback → `execCommand('copy')`
      fallback. Same idiom as theaters'.
- [x] **Sort by location ("In der Nähe")** — chip-row toggle that pulls
      `navigator.geolocation` and re-orders ledger rows by haversine
      distance against the venue. Distance badges injected client-side.
      Venue coords come from a scrape-time Nominatim pass cached in
      `src/geocode-cache.ts`.
- [x] **PWA / service worker** — `src/service-worker.ts` served as
      `/sw.js`; network-first for navigations + API, cache-first for
      `/img/*`. Manifest already wired.
- [x] **`/api/docs`** — Scalar OpenAPI reference at `/api/docs` and
      machine-readable spec at `/api/docs/openapi.json`. Pairs with the
      existing `/llms.txt`.
- [x] **Visited tracking** — `localStorage`-persisted set of event IDs
      with a per-row ✓ toggle. Visited rows fade to 0.45 opacity. Toggle
      restructured outside the anchor so it doesn't fight the row's
      navigation default.
- [x] **Dark theme** — paper-on-ink inversion of the light palette.
      Driven by `prefers-color-scheme` + a manual toggle button in the
      masthead; FOUC bootstrap from `@museumsufer/core/theme-script`
      reads the persisted choice before first paint.
- [x] **FAQ accordion** — six Heimatzeitung-style Q&A entries on the
      home page; FAQPage JSON-LD via `@museumsufer/core/faq` for SEO.
- [x] **Fuzzy search (⌘K)** — substring + AND-token match across every
      `[data-search]` ledger row. Lighter than museums' Fuse.js — at
      ~400 events, substring is plenty. Same UX shape (Cmd-K focus,
      Escape clear).
- [x] **Partial swap** — shipped as View Transitions API rather than
      htmx; cross-document `@view-transition: navigation: auto` plus
      `view-transition-name: content` smooths every same-origin
      navigation with a fade. Browsers without VT support fall back to
      a normal full-nav. Far less code than htmx for the same end-user
      effect.

## Backlog

Speculative follow-ups; nothing here is on the critical path.

- [ ] **Highlight-on-arrival pulse** — landau.today's share button
      links to `/event/<id>` (a dedicated page), so there's no "scroll
      to and pulse this row" interaction the way museums has it. Could
      revisit if we ever embed event highlights in the day list.
- [ ] **`bun screenshots:manifest`** — the PWA manifest is wired, but
      its `screenshots` array is empty. Generating mobile/wide
      screenshots via Playwright (museums has the script) would round
      out the install prompt on Android.
- [ ] **Fuse.js upgrade** — current substring search is fine at ~400
      events; bring in Fuse.js if the corpus grows past ~5k or if users
      ask for typo-tolerance.
- [ ] **htmx for in-page partial swap** — View Transitions covers the
      common case. htmx would only be worth it if we need to swap a
      sub-region without reloading the rest (e.g., live-updating the
      date counts during a long browsing session). Not currently needed.

## Explicitly NOT porting

These are Frankfurt-specific or out of scope:

- ~~Distance / RMV transit times~~ — different transit authority.
  Replaced by VRN deep-link.
- ~~DeepL translation (DE/EN/FR)~~ — DE-only is on-brand for the
  Pfälzer Heimatzeitung framing.
- ~~Like counter~~ — explicitly opted out.
- ~~AI-fallback scraping (Workers AI)~~ — every source we have is
  structurally clean; no need for HTML→AI fallback.
- ~~Multi-museum config layer~~ — events carry their own
  venue/source/city; no parent table needed.
