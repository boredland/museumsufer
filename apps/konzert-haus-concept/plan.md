# konzert.haus — Implementation Plan

> Concert events aggregator for Frankfurt/Rhein-Main.
> Classical, jazz, world, chanson, church music, experimental — no pop/rock.
> Domain: **konzert.haus** (registered), city subdomains for expansion.

## Visual Concept

See [`index.html`](./index.html) for the full design mockup.

**Aesthetic:** Concert hall interior — walnut paneling, burnished brass, felt silence.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--walnut` | `#F7F0E7` | `#110E0C` | page background |
| `--felt` | `#1A1210` | `#F0E8DC` | text |
| `--brass` | `#9E7A38` | `#D4A84B` | accent / links |

**Typography:** Cormorant Garamond (serif, titles) + DM Mono (mono, metadata/tags).

**Genre palette** (6 categories, each tied to a concert hall material):

| Genre | Color name | Light hex | Metaphor |
|-------|-----------|-----------|----------|
| Classical | `--velvet` | `#7B2D3B` | burgundy velvet seats |
| Jazz | `--amber` | `#8B6914` | whiskey amber |
| Sacred/Church | `--stained` | `#2B4A6E` | stained glass blue |
| World/Folk | `--terra` | `#8B5E3C` | terracotta earth |
| Experimental | `--steel` | `#5A6672` | brushed steel |
| Chamber/Chanson | `--salon` | `#3D6B4F` | Biedermeier salon green |

---

## Architecture

Copy **`apps/frankfurt-theaters`** as the base. Same stack:

- **Runtime:** Cloudflare Workers + Hono
- **Data:** Bundled `scrape-data.ts` (no D1 reads for content)
- **Scraping:** GitHub Actions → `scripts/scrape.ts` → regenerate `src/scrape-data.ts` → git push → CF redeploy
- **Frontend:** Server-rendered JSX, inline CSS (Lightning CSS), HTMX for date navigation
- **IDs:** FNV-1a hash (`venue_slug|event_slug`) — deterministic, stable
- **Feeds:** iCal per venue + global, RSS, JSON API
- **PWA:** Service worker with offline support

### Key differences from theaters app

| Concern | Theaters | konzert.haus |
|---------|----------|--------------|
| Entity model | Show → Performance (1:N) | Event (1:1, most concerts are one-off) |
| Genre | n/a (all theater) | 6 genre categories with color-coded tags |
| Geography | Frankfurt city only | Frankfurt + Taunus/Rhein-Main region |
| Filtering | by theater | by genre, by venue, by date |
| Venues | 23 theaters | 20 concert sources |
| Domain | frankfurt.ins.theater | konzert.haus (multi-city ready) |

---

## Data Model

### `ConcertConfig` (static, in `concert-config.ts`)

```ts
export type Genre = "classical" | "jazz" | "sacred" | "world" | "experimental" | "chamber";

export interface VenueConfig {
  slug: string;
  name: string;
  short_name?: string;        // for card display
  address: string;
  lat: number;
  lon: number;
  city: string;               // "frankfurt" | "kronberg" | "bad-homburg" etc.
  website_url: string;
  default_genre: Genre;       // fallback when scraper can't determine genre
  scraper: string;            // scraper module name
}
```

### `Event` / `ScrapedEvent` (replaces Show+Performance)

Most concerts are one-off events (not a recurring show with multiple performances), so we flatten the model:

```ts
export interface Event {
  id: number;                 // FNV-1a of `${venue_slug}|${event_slug}`
  venue_slug: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  date: string;               // ISO date
  time?: string;              // "20:00"
  end_time?: string;
  genre: Genre;
  image_url?: string;
  detail_url?: string;
  ticket_url?: string;
  price_min?: number;
  price_max?: number;
  venue_room?: string;        // "Großer Saal", "Mozart Saal"
  performers?: string;        // "Igor Levit, Klavier" — free text
}

export interface ScrapedEvent {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  date: string;
  time?: string | null;
  end_time?: string | null;
  genre?: Genre | null;       // null → use venue's default_genre
  image_url?: string | null;
  detail_url?: string | null;
  ticket_url?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  venue_room?: string | null;
  performers?: string | null;
}

export interface ScrapeResult {
  venue_slug: string;
  events: ScrapedEvent[];
}

export interface ScrapeData {
  events: Event[];
}
```

### D1

D1 only for operational data (same pattern as theaters):
- Feedback / error logging from scrapers (optional, can defer)
- No content reads at runtime

---

## File Structure

```
apps/konzert-haus/
├── package.json
├── tsconfig.json
├── wrangler.jsonc
├── public/
│   ├── manifest.json
│   ├── icons/
│   └── screenshots/
├── scripts/
│   ├── scrape.ts              # GH Action entry: walk venues, write scrape-data.ts
│   └── inline-css.mjs         # copied from theaters
├── src/
│   ├── index.tsx               # Hono app, routes
│   ├── concert-config.ts       # VenueConfig[] for all 20 venues
│   ├── types.ts                # Event, ScrapeResult, ScrapeData, Genre
│   ├── db.ts                   # in-memory queries over SCRAPE_DATA
│   ├── scrape-data.ts          # auto-generated, committed by GH Action
│   ├── scrape-runner.ts        # dispatch scraper by venue config name
│   ├── frontend.tsx            # SSR: page shell, event cards, date strip, genre filter
│   ├── styles.css              # concert-hall design system (from visual concept)
│   ├── styles-inline.ts        # auto-generated inline CSS string
│   ├── service-worker.ts       # offline PWA cache
│   ├── markdown.ts             # WebMCP / LLM markdown output
│   ├── scrapers/
│   │   ├── alte-oper.ts
│   │   ├── oper.ts             # reuse from theaters app
│   │   ├── dr-hochs.ts
│   │   ├── hfmdk.ts            # GraphQL API scraper
│   │   ├── ensemble-modern.ts
│   │   ├── hr-sinfonieorchester.ts
│   │   ├── holzhausenschloesschen.ts
│   │   ├── jazzkeller.ts
│   │   ├── jazz-frankfurt.ts   # aggregator — emits events across many venues
│   │   ├── jazz-palmengarten.ts
│   │   ├── brotfabrik.ts
│   │   ├── romanfabrik.ts
│   │   ├── hr-bigband.ts
│   │   ├── andreas-koehs.ts    # multi-venue church music
│   │   ├── kirchenmusik-dreikoenig.ts
│   │   ├── stk-musik.ts
│   │   ├── kronberg-academy.ts # includes Casals Forum
│   │   ├── rheingau-festival.ts
│   │   ├── bad-homburg-schloss.ts
│   │   └── bad-soden.ts
│   └── routes/
│       ├── api.ts              # JSON API
│       ├── venue.tsx            # venue detail pages
│       ├── feeds.ts            # iCal + RSS
│       ├── og.ts               # Open Graph images
│       ├── docs.ts             # API docs (Scalar)
│       ├── static.ts           # robots, manifest, llms.txt
│       └── imprint.tsx
```

---

## Routing

| Path | Method | Description |
|------|--------|-------------|
| `/` | GET | Today's concerts (SSR full page) |
| `/tag/{date}` | GET | Concerts for date (SSR full page) |
| `/programme` | GET | HTMX partial: event cards + date strip for `?date=` |
| `/spielort/{slug}` | GET | Venue detail page |
| `/genre/{slug}` | GET | Genre filter page |
| `/api/events` | GET | JSON: events with `?date=`, `?venue=`, `?genre=`, `?from=&to=` |
| `/api/events/{id}` | GET | JSON: single event |
| `/api/venues` | GET | JSON: all venue configs |
| `/api/docs` | GET | Scalar API reference |
| `/feed.ics` | GET | iCal: all events |
| `/spielort/{slug}/feed.ics` | GET | iCal: per venue |
| `/genre/{slug}/feed.ics` | GET | iCal: per genre |
| `/feed.rss` | GET | RSS feed |
| `/og/{id}.png` | GET | OG image for event |
| `/sw.js` | GET | Service worker |
| `/impressum` | GET | Imprint |

---

## Query Layer (`db.ts`)

Same pattern as theaters: in-memory maps over `SCRAPE_DATA`, no async DB calls needed.

```ts
// Key indexes built at module load
const EVENTS_BY_ID = new Map<number, Event>(...)
const EVENTS_BY_DATE = new Map<string, Event[]>(...)
const VENUES_BY_SLUG = new Map<string, VenueConfig>(...)

// Query functions
getEventsForDate(date: string): DayEvent[]
getEventsInRange(from: string, to: string, venue?: string, genre?: Genre): DayEvent[]
getEventById(id: number): DayEvent | null
getDatesWithEvents(from: string, to: string): DateWithCount[]
getGenreCounts(date: string): Map<Genre, number>
```

---

## Frontend Components (SSR JSX)

### Masthead
- "konzert.haus" wordmark in Cormorant Garamond light italic
- Subtitle: "Frankfurt hört zu"
- Theme toggle (light/dark)

### Date Strip
- Horizontal scroll, today highlighted with brass accent
- Event count badge per day
- HTMX: `hx-get="/programme?date={d}" hx-target="#programme"`

### Genre Filter
- Pill bar below date strip
- One pill per genre + "Alle" (all)
- Color-coded per genre palette
- HTMX: filters event list without page reload

### Event Card
- Time (DM Mono, large) + genre color bar on left edge
- Title (Cormorant Garamond semibold)
- Subtitle / performers (DM Mono, quiet)
- Venue name + room
- Price range
- Ticket link (brass accent button)
- Genre tag pill

### Venue Page
- Venue name, address, map link
- Upcoming events list
- iCal subscribe link

---

## Venues (20 sources)

### Tier 1 — Easy (start here)

| # | Venue | Scraper approach | Genre | Est. events/month |
|---|-------|-----------------|-------|-------------------|
| 1 | Alte Oper Frankfurt | HTML card parsing | classical | 30-45 |
| 2 | Oper Frankfurt | Reuse theaters `oper.ts` scraper | classical | 20-25 |
| 3 | Dr. Hoch's Konservatorium | HTML calendar | classical | 10-15 |
| 4 | HfMDK Frankfurt | **GraphQL API** `/api/search/events` | classical | 10-15 |
| 5 | Jazzkeller Frankfurt | HTML cards at `/live.html` | jazz | 16-20 |
| 6 | jazz-frankfurt.de | Semantic HTML aggregator | jazz | 20+ |
| 7 | Brotfabrik | HTML cards with genre tags | mixed | 11 |
| 8 | Romanfabrik | HTML list | mixed | 15-20 |
| 9 | Andreas Köhs Kirchenmusik | Clean HTML | sacred | 5-10 |
| 10 | Kirchenmusik Dreikönig | Semantic HTML | sacred | 5-8/year |
| 11 | Kantorei St. Katharinen | Simple HTML | sacred | ~12/year |
| 12 | Kronberg Academy / Casals Forum | HTML | classical | 10-15 |

### Tier 2 — Moderate (two-step or detail-page scraping)

| # | Venue | Scraper approach | Genre | Est. events/month |
|---|-------|-----------------|-------|-------------------|
| 13 | Ensemble Modern | HTML + detail pages | classical | ~9 (Frankfurt) |
| 14 | hr-Sinfonieorchester | Two-step crawl | classical | 5-8 |
| 15 | hr-Bigband | Two-step crawl | jazz | 5-8 |
| 16 | Holzhausenschlösschen | HTML parsing | chamber | 2-3 |
| 17 | Rheingau Musik Festival | HTML, seasonal | classical | 82+ (Jun-Aug) |

### Tier 3 — Hard (JS-rendered, Angular, etc.)

| # | Venue | Scraper approach | Genre | Est. events/month |
|---|-------|-----------------|-------|-------------------|
| 18 | Bad Homburger Schlosskonzerte | Vue app, needs API extraction | classical | 8-12 (seasonal) |
| 19 | Bad Soden series | Angular / PNG flyers | mixed | seasonal |
| 20 | Jazz im Palmengarten | Via jazz-frankfurt.de | jazz | 7 (Jul-Aug) |

### Estimated daily volume
- Season (Sep–Jun): **7–9 events/day**
- Summer festival (Jul–Aug): **9–11 events/day**
- Off-season lulls: **4–6 events/day**

---

## Implementation Phases

### Phase 1: Scaffold + First Scraper (1–2 days)

1. `cp -r apps/frankfurt-theaters apps/konzert-haus`
2. Rename package to `@museumsufer/konzert-haus`
3. Replace `theater-config.ts` → `concert-config.ts` with `VenueConfig[]`
4. Replace `types.ts` with the Event-based model (flatten Show+Performance)
5. Update `db.ts` query layer for events
6. Strip all existing scrapers, add `alte-oper.ts` as first scraper
7. Update `wrangler.jsonc` (new worker name, D1 binding optional)
8. Translate `styles.css` from visual concept
9. Update `frontend.tsx` with concert-hall design, genre tags, filter bar
10. Verify `bun scripts/scrape.ts` produces valid `scrape-data.ts`
11. `wrangler dev` → check local rendering

### Phase 2: Tier 1 Scrapers (3–5 days)

Implement scrapers 1–12 in priority order:
1. `alte-oper.ts` (highest volume, anchor venue)
2. `oper.ts` (port from theaters, filter to concerts/recitals only)
3. `hfmdk.ts` (GraphQL — cleanest data source)
4. `jazz-frankfurt.ts` (aggregator, covers many jazz venues at once)
5. `jazzkeller.ts`
6. `dr-hochs.ts`
7. `brotfabrik.ts` + `romanfabrik.ts` (similar structure)
8. `kronberg-academy.ts`
9. `andreas-koehs.ts` + `kirchenmusik-dreikoenig.ts` + `stk-musik.ts`

After each scraper: run `bun scripts/scrape.ts`, inspect output, fix edge cases.

### Phase 3: Routes + Feeds (1–2 days)

1. Adapt `routes/api.ts` for events schema (add `genre` filter param)
2. Adapt `routes/feeds.ts` for iCal + RSS (per-venue, per-genre, global)
3. Build `routes/venue.tsx` (venue detail page with upcoming events)
4. Add genre filter pages at `/genre/{slug}`
5. OG image generation for events
6. `llms.txt` + API docs
7. Service worker (cache name: `kh-v1`)

### Phase 4: Deploy + CI (1 day)

1. Create Cloudflare Worker (`konzert-haus`)
2. Configure custom domain: `konzert.haus`
3. Add to `scrape.yml`:
   ```yaml
   konzert-haus:
     if: |
       (github.event_name == 'schedule' && github.event.schedule == '0 7-19 * * *') ||
       (github.event_name == 'workflow_dispatch' && (inputs.app == 'konzert-haus' || inputs.app == 'all'))
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: oven-sh/setup-bun@v2
       - run: bun install --frozen-lockfile
       - name: Run scraper
         working-directory: apps/konzert-haus
         run: bun scripts/scrape.ts
       - name: Commit if changed
         run: |
           git config user.name "scrape-bot"
           git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
           git add apps/konzert-haus/src/scrape-data.ts
           if git diff --cached --quiet; then
             echo "no diff, skipping commit"
             exit 0
           fi
           git commit -m "data(konzert-haus): scheduled scrape $(date -u +%Y-%m-%dT%H:%MZ)"
           push_with_retry() {
             for attempt in 1 2 3; do
               if git pull --rebase origin main && git push; then return 0; fi
               echo "push attempt $attempt failed, retrying"
               sleep $((attempt * 2))
             done
             return 1
           }
           push_with_retry
   ```
4. Add `konzert-haus` to `workflow_dispatch` input options
5. PWA manifest + icons

### Phase 5: Tier 2+3 Scrapers (3–5 days)

1. `ensemble-modern.ts` — HTML + detail page crawl
2. `hr-sinfonieorchester.ts` — two-step
3. `hr-bigband.ts` — two-step (similar pattern to hr-sinfonie)
4. `holzhausenschloesschen.ts`
5. `rheingau-festival.ts` — seasonal, high volume Jun-Aug
6. `bad-homburg-schloss.ts` — Vue app, extract API calls from network tab
7. `bad-soden.ts` — hardest, may need manual fallback
8. `jazz-palmengarten.ts` — seasonal, or via jazz-frankfurt.de

### Phase 6: Polish (1–2 days)

1. Genre auto-detection heuristics (keywords in title/description → Genre)
2. De-duplication: when jazz-frankfurt.de lists an event we also scrape directly, prefer the direct scrape (richer data)
3. Dark mode testing
4. Mobile UX refinement
5. Performance: verify sub-50ms TTFB with bundled data
6. Accessibility: focus states, aria labels, skip links
7. SEO: structured data (Event schema.org), sitemap

---

## Multi-City Architecture

Designed from day one but not built until needed:

- **Subdomain routing:** `frankfurt.konzert.haus`, `berlin.konzert.haus`, etc.
- **Venue config:** `city` field on every VenueConfig, filter at query time
- **Scraper namespacing:** `scrapers/frankfurt/`, `scrapers/berlin/`
- **Same worker:** One worker handles all subdomains, routes by `Host` header
- **Or split workers:** One worker per city if data volume requires it
- The flat event model and city field mean no schema changes when adding cities.

---

## Future Ideas (post-MVP)

- **Submission form** for amateur choirs/Vereine to self-report concerts (the long tail of 60+ Frankfurt choirs that can't be individually scraped)
- **Journal Frankfurt "Klassik"** category as supplementary source
- **chordates.de** (Deutscher Chorverband) if their data quality improves
- **Gluck Festspiele** (Hanau, seasonal — biennial opera festival)
- **Calendar sync** — one-click add to Google/Apple/Outlook
- **"Heute Abend" spotlight** — curated picks for tonight
- **Performer search** — full-text search across performers field
