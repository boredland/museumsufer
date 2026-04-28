# Agents Guide

This document helps AI agents understand and work on this codebase.

## Project overview

A Cloudflare Worker that aggregates museum exhibitions and events from Frankfurt's Museumsufer into a single page. It collects data from museumsufer.de, 16 museum JSON/HTML APIs, and AI-scraped museum websites, stores everything in D1, translates content via DeepL, and serves a frontend + JSON API.

**Production URL:** https://museumsufer.app

## Tech stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **AI:** Cloudflare Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct`) for parsing museum event pages without APIs
- **Translation:** DeepL API Free (500K chars/month) with D1 hash-based caching
- **Date handling:** dayjs with timezone plugin (Europe/Berlin)
- **Search:** Fuse.js (client-side fuzzy search, loaded from CDN)
- **Build:** wrangler (no bundler config — wrangler handles it)
- **No framework** — vanilla Worker with manual routing in `src/index.ts`

## Key files

| File | Lines | Purpose |
|---|---|---|
| `src/index.ts` | 214 | Entry point. Routes HTTP, SSR with inline data, cron handler, robots.txt, sitemap, OG image, manifest, service worker. |
| `src/scraper.ts` | 258 | Scrapes museumsufer.de for museums (from embedded `museumMapConfig` JSON) and exhibitions (HTML parsing of `.teaserBox` elements). Deterministic — no AI. |
| `src/museum-apis.ts` | 99 | Static registry of 16 museum API endpoints and parser types. Source of truth for structured vs AI scraping. |
| `src/api-scrapers.ts` | 912 | 16 typed parsers: `tribe-events`, `historisches`, `juedisches`, `staedel`, `senckenberg`, `my-calendar`, `liebieghaus`, `mak`, `stadtgeschichte-rss`, `dommuseum`, `junges-museum`, `ledermuseum`, `bibelhaus`, `fkv`, `fdh`. Each returns `ApiEvent[]`. |
| `src/event-scraper.ts` | 518 | Orchestrator: API-first with AI fallback, link matching, detail page enrichment (images + prices for next 7 days). |
| `src/translate.ts` | 199 | DeepL translation pipeline with SHA-256 hash-based D1 caching. Translates DE→EN/FR. |
| `src/api.ts` | 256 | JSON API with SWR caching, RSS/ICS feeds, past-event filtering, per-event ICS download, translation integration. |
| `src/frontend.ts` | 1480 | SSR HTML template: i18n (DE/EN/FR), Fuse.js search, distance sorting with river-side awareness, collapsible sections, visited tracking, Event JSON-LD schema, DeepL attribution badges. |
| `src/i18n.ts` | 171 | Translations (DE/EN/FR) and locale detection from Accept-Language / ?lang= param. |
| `src/date.ts` | 33 | dayjs-based Berlin timezone utilities (toBerlinDate, toBerlinTime, todayIso, dateOffset). |
| `src/shared.ts` | 54 | Shared constants (URLs, USER_AGENT) and utilities (stripHtml, escHtml, normalizeUrl, truncateHtml, nullIfMidnight, German month maps). |
| `src/museum-geo.ts` | 71 | Lat/lng for all 39 museums, haversine distance with Main river-side penalty (+800m for cross-river). |
| `src/image-proxy.ts` | 88 | Edge-cached image proxy with dynamic domain allowlist from DB + subdomain matching. 7-day TTL. |
| `src/service-worker.ts` | 69 | Offline PWA support: network-first for pages/API, cache-first for images. |
| `src/health-check.ts` | 154 | Source health checks for all 16 structured endpoints + museumsufer.de pages. |
| `src/types.ts` | 41 | Env interface (D1 + AI + SCRAPE_SECRET + DEEPL_API_KEY) and data types. |

## Event scraping: three tiers

### Tier 1: Structured APIs (16 museums, best data)

Configured in `src/museum-apis.ts`. When the event scraper finds a matching slug, it calls `fetchEventsFromApi()` and skips AI scraping entirely.

| Museum | Slug | Parser | Notes |
|---|---|---|---|
| Städel Museum | `staedel-museum` | `staedel` | ~370 events, images, sold-out status, `@web`/`@images` URL aliases |
| Historisches Museum | `historisches-museum-frankfurt` | `historisches` | Unix timestamps, `isFree`, "Bibliothek der Generationen" blocklisted |
| Jüdisches Museum | `juedisches-museum-frankfurt` | `juedisches` | TYPO3 feed.json, events routed to Judengasse via `locationAlt` → `museum_slug_override` |
| DAM | `deutsches-architekturmuseum` | `tribe-events` | Standard Tribe Events with cost, image, venue |
| DFF | `dff-deutsches-filminstitut-filmmuseum` | `tribe-events` | Same format |
| Senckenberg | `senckenberg-naturmuseum` | `senckenberg` | WP REST + ACF fields, needs User-Agent |
| MFK | `museum-fuer-kommunikation-frankfurt` | `my-calendar` | My Calendar WP plugin, fallback time extraction from event_desc |
| Liebieghaus | `liebieghaus-skulpturensammlung` | `liebieghaus` | schema.org Event HTML with duration |
| MAK | `museum-angewandte-kunst` | `mak` | mak-event-item elements, time ranges in headings |
| IfS | `institut-fuer-stadtgeschichte` | `stadtgeschichte-rss` | RSS feed with German dates/prices in description |
| Dommuseum | `dommuseum-frankfurt` | `dommuseum` | TYPO3 Calendarize per-event ICS files, needs browser UA |
| Junges Museum | `junges-museum-frankfurt` | `junges-museum` | Drupal Views h2/h3 structure |
| Ledermuseum | `deutsches-ledermuseum-of` | `ledermuseum` | Kirby CMS li.quarter + div.date |
| Bibelhaus | `bibelhaus-erlebnismuseum` | `bibelhaus` | BEM-style bmBase--eventsItem elements |
| FKV | `frankfurter-kunstverein` | `fkv` | WP article with DD.MM.YYYY in p.subtitle |
| Romantik-Museum + Goethe-Haus | `deutsches-romantik-museum`, `frankfurter-goethe-haus` | `fdh` | Two-step: listing → detail pages for c-event-item dates |

### Tier 2: AI-scraped (~22 museums)

Museums with a `website_url` but no API config. The scraper probes common paths, strips HTML, sends to Workers AI. Link matching extracts `<a href>` from raw HTML and fuzzy-matches event titles.

### Tier 3: Detail page enrichment (next 7 days only)

Events with a `detail_url` get enriched: same-domain image extraction (og:image or content img), Workers AI price extraction. Events without price after enrichment get `price = ''` to avoid re-fetching.

## Database schema

Five tables in D1:

- **`museums`** — `id`, `name`, `slug` (unique), `museumsufer_url`, `website_url`, `opening_hours`
- **`exhibitions`** — `museum_id` FK, `title`, `start_date`, `end_date`, `image_url`, `detail_url`. Unique on `(museum_id, title)`.
- **`events`** — `museum_id` FK, `title`, `date`, `time`, `end_time`, `end_date`, `description`, `url`, `detail_url`, `image_url`, `price`. Unique on `(museum_id, title, date)`.
- **`translations`** — `source_hash` (SHA-256), `target_lang`, `source_text`, `translated_text`. Unique on `(source_hash, target_lang)`.

## Data flow

1. **Cron fires** daily at 6am UTC (`scheduled` handler)
2. **`scrape()`** — museums + exhibitions from museumsufer.de
3. **`scrapeMuseumWebsites()`** — API-first with AI fallback + enrichment
4. **`translateEvents()`** — DeepL DE→EN/FR with hash-based caching
5. **Health check** — GitHub Action at 8am UTC validates all sources

## Frontend features

- **i18n**: DE/EN/FR with Accept-Language detection, ?lang= override
- **Translation**: DeepL-translated titles/descriptions with attribution badge
- **Search**: Ctrl+K / visible search bar, Fuse.js fuzzy matching with highlighted results
- **Distance sorting**: "In der Nähe" button, haversine + Main river-side penalty, walking minutes
- **Navigation**: Google Maps walking directions per museum
- **Calendar**: Per-event .ics download, subscribable /feed.ics
- **Visited tracking**: localStorage-persisted checkmarks, collapsed "Already visited" section
- **Collapsible sections**: Events/Exhibitions collapse state persisted in localStorage
- **Ending soon**: Red badges for exhibitions ending within 14/3 days
- **Past events hidden**: Filtered by end_time or +3h default for today
- **PWA**: Installable, offline support via service worker
- **Image proxy**: All museum images served through /img/ with 7-day edge cache

## Date/time scraping: Common issues & patterns

When adding or fixing event scrapers, watch for these recurring problems and use the patterns in `src/api-scrapers.ts` to solve them.

### Problem: Missing or malformed dates

| Issue | Museums | Mitigation |
|---|---|---|
| Dates embedded in German text (e.g., "15. März") | Junges Museum, Ledermuseum, FKV | Use `GERMAN_MONTHS` lookup + `inferYear()` to parse `DD. MONTH` → ISO date. Always validate against `todayIso()` to reject past events. |
| ISO 8601 timestamps (both valid & UTC) | Historisches, Jüdisches, Staedel, Senckenberg | Slice `YYYY-MM-DD` from index 0:10 or split on `T`. For Unix/seconds timestamps, pass to `new Date(ms * 1000)`, then convert with `toBerlinDate()`. |
| Malformed or empty dates | All | Filter with `.filter((ev) => ev.title && ev.date)` after mapping to catch parser failures. Always validate `date < todayIso()` to avoid expired events. |
| Duration instead of end time | Liebieghaus (schema.org `duration="P1H30M"`) | Parse `PT(\d+)H(?:(\d+)M)?` from datetime attributes. Add hours to start time, wrapping at 24 with `% 24`. |

### Problem: Times missing or in wrong format

| Issue | Museums | Mitigation |
|---|---|---|
| Midnight as "00:00" (all-day events) | Liebieghaus, Staedel, Dommuseum, many others | Use `nullIfMidnight(time)` from `shared.ts` to convert "00:00" → `null`. Always apply this AFTER extracting time. |
| Time in description or title, not dedicated field | MFK (My Calendar), Ledermuseum | Use regex: `(\d{1,2})[.:](\d{2})\s*(?:Uhr\|h\b)` to extract HH:MM, handle `.` as hour separator and `:` as both. Try hour-only fallback: `(?:ab\s+)?(\d{1,2})\s*Uhr` → `HH:00`. |
| Time range in single field (e.g., "14:00–16:00") | Junges Museum, MAK | Split on `[-–]`, parse both, store first as `time` and second as `end_time`. Handle both `.` (German) and `:` (ISO) as separators. |
| Seconds or milliseconds | Various APIs | Always slice to `HH:MM` (positions 11:16 for ISO datetime strings). Never store full ISO times in DB. |
| "00:00" for unknown end time | Dommuseum | Only set `end_time` if non-midnight. Discard midnight values: `endTime !== "00:00" ? endTime : null`. |

### Problem: Times leaking into titles

This happens when parsing HTML extracts time alongside title, or scrapers concatenate title + date.

| Symptom | Root cause | Fix |
|---|---|---|
| Title contains "14:00" or "Uhr" | HTML parser grabbed sibling time element in same block | Use `stripHtml()` on title, then trim whitespace. Add negative lookbehind in regex if needed: `(?<![\d:])(PATTERN)` to avoid matching inside times. Extract title and time into separate fields BEFORE building ApiEvent. |
| Title has date like "15. Mai" | AI or HTML parser confused structure | If date parser already extracted date, remove it from title with regex replace: `title.replace(/\d{1,2}\.\s*\w+/g, '')` AFTER date extraction. Or run `stripHtml()` which merges adjacent text nodes. |
| Title has duration like "2 Stunden" | Common in descriptions | Use `truncateHtml()` for descriptions instead of titles. Keep titles short; discard non-title text before `.flatMap()`. |

**Example:** Junges Museum (`fetchJungesMuseum`) extracts from h2/h3 headers separately, ensuring title and date never mix.

### Problem: Invalid date ranges

| Issue | Museums | Fix |
|---|---|---|
| `end_date` before `date` (data error) | Sporadic in HTML sources | Validate: `if (ed !== date) endDate = ed;` BEFORE return. Compare ISO strings (YYYY-MM-DD sorts lexicographically). |
| `end_date` same as `date` | Staedel, Senckenberg, Liebieghaus | Omit it: `endDate !== startDate ? endDate : null`. Only set `end_date` for multi-day events. |
| No `end_date` but `end_time` exists | Normal for same-day events | Store `end_time` only; leave `end_date` null. DB schema allows this. |

### Pattern: Timezone conversions

Always use `src/date.ts` utilities for timezone work:

- **`toBerlinDate(date: Date): string`** — converts `Date` object → ISO date string in Berlin timezone (Europe/Berlin). Use for all timestamp parsing.
- **`toBerlinTime(date: Date): string`** — converts `Date` object → HH:MM time string in Berlin timezone.
- **`todayIso(): string`** — returns today's date in Berlin timezone as YYYY-MM-DD.
- **`dateOffset(days: number): string`** — returns future date (e.g., 30 days from now) as ISO string.
- **`inferYear(month: string, day: string): string`** — infers year for partial dates (e.g., "15. März") by checking if date has already passed this year.

Example (Dommuseum iCal parsing):
```typescript
const startDate = new Date(`${dtStart.slice(0, 4)}-${dtStart.slice(4, 6)}-${dtStart.slice(6, 8)}T${dtStart.slice(9, 11)}:${dtStart.slice(11, 13)}:${dtStart.slice(13, 15)}Z`);
const date = toBerlinDate(startDate);  // Now in Europe/Berlin
const time = toBerlinTime(startDate);   // Now in Europe/Berlin
```

### Pattern: Fallback extraction (multi-level parsing)

When primary date/time fields are missing, try progressively weaker sources:

1. Dedicated API fields (e.g., `start_date`, `event_start_time`)
2. Structured data (schema.org, JSON-LD, microformats)
3. HTML text nodes (regex or AI)
4. Metadata (iCal, RSS timestamps)
5. Default to all-day (time=null)

Example (My Calendar fallback):
```typescript
let time = ev.event_time && ev.event_time !== "00:00:00" ? ev.event_time.slice(0, 5) : null;
if (!time && ev.event_desc) {
  const withMinutes = ev.event_desc.match(/(\d{1,2})[.:](\d{2})\s*(?:Uhr|h\b)/);
  if (withMinutes) time = `${withMinutes[1].padStart(2, "0")}:${withMinutes[2]}`;
}
```

### QA: How to check for missing/broken dates

Before shipping a new scraper:

1. **Manual run:** `curl -X POST https://museumsufer.app/scrape/events -H "Authorization: Bearer $SCRAPE_SECRET"` and check logs for parse errors.
2. **Spot-check DB:** Query a few events: `SELECT title, date, time FROM events WHERE museum_id = ? LIMIT 5`. Look for NULL dates, midnight times, or dates in titles.
3. **Check frontend:** Visit https://museumsufer.app?lang=de, search by museum name, verify dates display correctly without times if `time IS NULL`.
4. **Regression test:** If fixing an existing scraper, ensure at least as many events are extracted (check event count delta).

### Utility functions from `shared.ts`

- **`stripHtml(text: string): string`** — removes tags, decodes entities, collapses whitespace. Use on all user-facing text.
- **`nullIfMidnight(time: string | null): string | null`** — converts "00:00" → null. Apply AFTER extracting time, before storing.
- **`truncateHtml(text: string, maxLen = 500): string | null`** — strips HTML, truncates to word boundary, returns null if empty. Use for descriptions, never for dates.
- **`normalizeUrl(url: string | null, baseUrl: string): string | null`** — prepends baseUrl to relative URLs, handles `/`, `//`, and full URLs correctly.

### Audit findings: Known gaps in production scrapers

These issues exist in the current codebase. When fixing or refactoring scrapers, correct them:

| Parser | Issue | Impact | Fix |
|---|---|---|---|
| **tribe-events** (DAM, DFF) | No `nullIfMidnight()` on start/end times | Midnight times render as "00:00" instead of all-day events | Wrap both lines 86-87 with `nullIfMidnight()` |
| **historisches** | No `nullIfMidnight()` on start time | Extracted times could be "00:00" → shown as midnight | Apply to line 146 |
| **mak** | Manual "00:00" check missing on extracted time | Regex-matched times not filtered | Use `nullIfMidnight()` on line 721 |
| **fkv** | Manual "00:00" check missing | Same as MAK | Use `nullIfMidnight()` on line 721 |
| All parsers | Inconsistent midnight handling | Some use utility, some manual checks | Always use `nullIfMidnight()` from shared.ts |

**Pattern to avoid:** Using `.slice(11, 16)` on ISO datetime without wrapping in `nullIfMidnight()`:
```typescript
// ❌ BAD - midnight times leak through
time: ev.start_date?.slice(11, 16) || null

// ✅ GOOD - always filter midnight
time: nullIfMidnight(ev.start_date?.slice(11, 16) || null)
```

## Common tasks

### Adding a new museum API

1. Find the endpoint (check `/wp-json/`, embedded JSON, network requests)
2. Add slug + endpoint to `MUSEUM_APIS` in `src/museum-apis.ts`
3. Add parser in `src/api-scrapers.ts` (or reuse existing type like `tribe-events`)
4. Add health check case in `src/health-check.ts`
5. Add exhaustive switch case — TypeScript will error if you forget

### Manually triggering scrapes

```bash
curl -X POST https://museumsufer.app/scrape \
  -H "Authorization: Bearer $SCRAPE_SECRET"

curl -X POST https://museumsufer.app/scrape/events \
  -H "Authorization: Bearer $SCRAPE_SECRET"

curl -X POST https://museumsufer.app/scrape/translate \
  -H "Authorization: Bearer $SCRAPE_SECRET"
```

### Running migrations

```bash
wrangler d1 execute museumsufer-db --local --file=./migrations/NNNN_name.sql
wrangler d1 execute museumsufer-db --remote --file=./migrations/NNNN_name.sql
```

## Known limitations

- AI model (17B) sometimes misses events or hallucinates dates. API-based scraping always preferred.
- Some museum websites block Workers fetch or have TLS issues. Fail silently.
- Sequential scraping (~3-5 min). Could parallelize with Cloudflare Queues.
- Museum name matching uses fuzzy slug + German stem normalization. Occasionally creates duplicates.
- Detail enrichment capped at 30 events/run, 7 days ahead.
- DeepL Free: 500K chars/month. Hash-based caching keeps usage low (~5-20K chars/day delta).
- Event schema timezone offset computed at render time — correct for the current date but events spanning DST transitions could be off by 1 hour.

## Investigated but dropped

- **SCHIRN** WP API: `ho_event_data` serialized as single characters (their bug)
- **FKV** WP REST: no event date fields in API (now using HTML parsing instead)
- **Archäologisches Museum** RSS: static program pages, not dated events
- **Junges Museum** Drupal iCal: accepts URLs but returns HTML (module not configured)
- **Curator.io** for Jüdisches Museum: social media aggregator, not events
- **Workers AI m2m100**: available as free translation fallback but lower quality than DeepL

## Deployment

Automated on git push. D1 database ID in `wrangler.toml`. Secrets via `wrangler secret put`.
