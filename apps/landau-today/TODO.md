# landau.today — port roadmap

Items to port from `frankfurt-museums` (and a few from `frankfurt-theaters`),
ranked by ROI for landau.today. Tick when shipped.

## Done

- [x] **VRN navigate-to-destination** — per-event "Anfahrt VRN ÖPNV"
      action linking the trip planner with the venue + city pre-filled.
      Region-correct equivalent of museumsufer's RMV link. Plus a Google
      Maps directions link as fallback.
- [x] **Web Share API** — `Teilen` button on the event detail page with
      `navigator.share` → clipboard fallback → `execCommand('copy')`
      fallback. Same idiom as theaters'. Already present in museums and
      theaters.

## Backlog

### High ROI

- [ ] **Fuzzy search (Fuse.js + ⌘K shortcut)**
      → 408 events deserve in-page search. Largest UX win available.
      Lift `client-script.ts` `applySearchFilter` + `normalizeQuery` from
      museums; build the index from `SCRAPE_DATA.events` at page load.

- [ ] **Health-check workflow**
      → `bun health-check` validates each upstream returns expected
      fields; GH Action opens an issue on regressions. Catches silent
      breakage when a source changes URL/markup. Adapt
      `apps/frankfurt-museums/src/health-check.ts`. Runs at 08:00 UTC
      after the scrape.

- [ ] **PWA / service worker**
      → manifest is already served but the SW was dropped during
      scaffolding. Restore `src/service-worker.ts` (the cloned file from
      museums) plus `bun screenshots:manifest` to populate the
      `screenshots` array. Makes the app installable.

### Medium ROI

- [ ] **htmx partial swap on date-strip and chip clicks**
      → date-strip/chip clicks could swap `<main>` instead of full-nav.
      Theaters does this; idiom is well-established. Adapt
      `apps/frankfurt-museums/src/index.tsx:/partial/content`.

- [ ] **Dark theme**
      → many Konzert / Nachtleben events are evening-only; a paper-on-ink
      inversion of the current palette suits. CSS variables already
      structured (`--color-paper`/`--color-ink`). Adapt
      `theme-script` from `@museumsufer/core` for FOUC-free toggle.

- [ ] **FAQ accordion**
      → both sister apps recently grew matching-idiom FAQ sections.
      Heimatzeitung-style FAQ rounds out SEO + answers common questions
      ("warum nicht <Ort>?", "wie kann ich Veranstaltungen melden?"…).
      Reuse `@museumsufer/core/faq` JSON-LD builder.

### Low ROI / nice-to-have

- [ ] **`/api/docs`** (OpenAPI reference)
      → via `@scalar/hono-api-reference`. Cheap; pairs with `/llms.txt`.
      Adapt `apps/frankfurt-museums/src/routes/docs.ts`.

- [ ] **Highlight-on-arrival pulse** when a shared URL targets a specific
      event in the list. Nice with the share button. Already lives in
      museums' `client-script.ts:highlightShareTarget`.

- [ ] **Visited tracking** ("ich war da" checkmarks, localStorage)
      → less obviously useful for landau where most events are one-off
      single performances rather than long-running exhibitions, but
      cheap to port.

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
