import { Fragment } from "hono/jsx";
import { CATEGORIES, CATEGORY_BY_SLUG, type CategoryDef } from "./categories";
import { todayIso } from "./date";
import { categoryLabel, DEFAULT_LOCALE, type Locale, type Translations } from "./i18n";
import { imageProxyUrl } from "./image-proxy";
import {
  dayOfMonth,
  formatDateLong,
  formatDateRange,
  formatTime,
  monthShort,
  relativeDayLabel,
  weekdayShort,
} from "./shared";
import type { Event } from "./types";

function langSuffix(locale: Locale, sep: "?" | "&" = "?"): string {
  return locale === DEFAULT_LOCALE ? "" : `${sep}lang=${locale}`;
}

interface ChipRowProps {
  active?: string;
  date: string;
  counts: Map<string, number>;
  tr: Translations;
  locale: Locale;
}

export function ChipRow({ active, date, counts, tr, locale }: ChipRowProps) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  // Anchors are htmx-boosted to swap #content-body in place — see
  // src/index.tsx /partial/content. Falls back to a normal full-nav
  // if htmx isn't loaded (or for shift/cmd-clicks, which htmx
  // forwards to the browser).
  const hxAttrs = { "hx-target": "#content-body", "hx-swap": "innerHTML transition:true", "hx-push-url": "true" };
  const lang = langSuffix(locale, "&");
  return (
    <nav class="strip" aria-label={tr.ariaCategory}>
      <div class="strip-rail">
        <a
          class={`chip ${active ? "" : "active"}`}
          href={`/?date=${date}${lang}`}
          hx-get={`/partial/content?date=${date}`}
          {...hxAttrs}
        >
          <span class="t-label">{tr.chipAll}</span>
          {total > 0 ? <span class="count">{total}</span> : null}
        </a>
        {CATEGORIES.map((cat) => {
          const n = counts.get(cat.slug) ?? 0;
          if (n === 0 && active !== cat.slug) return null;
          const { short } = categoryLabel(cat.slug, tr);
          return (
            <a
              class={`chip m-${cat.mood} ${active === cat.slug ? "active" : ""}`}
              href={`/c/${cat.slug}?date=${date}${lang}`}
              hx-get={`/partial/content?category=${cat.slug}&date=${date}`}
              {...hxAttrs}
            >
              <span class="glyph" aria-hidden="true">
                {cat.glyph}
              </span>
              <span class="t-label">{short}</span>
              {n > 0 ? <span class="count">{n}</span> : null}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

interface DateStripProps {
  current: string;
  category?: string;
  counts: Map<string, number>;
  daysAhead?: number;
  tr: Translations;
  locale: Locale;
}

export function DateStrip({ current, category, counts, daysAhead = 21, tr, locale }: DateStripProps) {
  const today = todayIso();
  const days: string[] = [];
  const start = new Date(`${today}T12:00:00Z`);
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  const hxAttrs = { "hx-target": "#content-body", "hx-swap": "innerHTML transition:true", "hx-push-url": "true" };
  const lang = langSuffix(locale, "&");
  return (
    <nav class="dates" aria-label={tr.ariaDate}>
      <div class="dates-rail">
        {days.map((iso) => {
          const n = counts.get(iso) ?? 0;
          const href = (category ? `/c/${category}?date=${iso}` : `/?date=${iso}`) + lang;
          const partial = category
            ? `/partial/content?category=${category}&date=${iso}`
            : `/partial/content?date=${iso}`;
          return (
            <a
              class={`day ${iso === current ? "active" : ""} ${iso === today ? "is-today" : ""} ${
                n === 0 ? "empty" : ""
              }`}
              href={href}
              hx-get={partial}
              {...hxAttrs}
              aria-current={iso === current ? "date" : undefined}
            >
              <span class="day-name">{weekdayShort(iso, locale)}</span>
              <span class="day-num">{dayOfMonth(iso)}</span>
              <span class="day-month">{monthShort(iso, locale)}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function DayHeadline({
  date,
  total,
  tr,
  locale,
}: {
  date: string;
  total: number;
  tr: Translations;
  locale: Locale;
}) {
  const today = todayIso();
  const rel = relativeDayLabel(date, today, locale);
  return (
    <div class="day-headline">
      <h2>{rel ?? formatDateLong(date, locale)}</h2>
      <div class="day-headline-meta">
        <button type="button" class="near-toggle js-near" aria-pressed="false" title={tr.nearbyHint}>
          <span class="glyph" aria-hidden="true">
            ⌖
          </span>
          <span>{tr.nearby}</span>
        </button>
        <span class="meta">
          {total} {total === 1 ? tr.eventSingular : tr.eventPlural}
        </span>
      </div>
    </div>
  );
}

function categoryFor(slug: string): CategoryDef {
  return CATEGORY_BY_SLUG.get(slug) ?? CATEGORY_BY_SLUG.get("sonstiges")!;
}

/** True when the venue label already contains the city name — avoids
 *  rendering "Stiftskirche Landau · Landau in der Pfalz" with the
 *  city echoed twice. Match on the bare town name, not the full
 *  "Landau in der Pfalz" form. */
function venueIncludesCity(venue: string | undefined, city: string): boolean {
  if (!venue) return false;
  const bare = city.replace(/\s+in der Pfalz$/i, "").replace(/^Landau-/, "");
  return new RegExp(`\\b${bare}\\b`, "i").test(venue);
}

interface LedgerProps {
  ev: Event;
  tr: Translations;
  locale: Locale;
}

/** The ledger row — the page's primary card vocabulary. Looks like a
 *  classified-listing entry: tabular time on the left, hairline rule,
 *  title + venue + price in the body, mood-colored category glyph at
 *  the right. */
export function Ledger({ ev, tr, locale }: LedgerProps) {
  const cat = categoryFor(ev.category);
  const time = formatTime(ev.time, locale);
  const isOpen = !!ev.end_date && !time;
  // Order: venue, city (only if it's not already echoed inside the venue
  // string), organizer (only if distinct from venue), price.
  const cityVisible = ev.city && !venueIncludesCity(ev.venue, ev.city) ? ev.city : null;
  const meta: (string | null)[] = [
    ev.venue || null,
    cityVisible,
    ev.organizer && ev.organizer !== ev.venue ? ev.organizer : null,
    ev.price || null,
  ];
  const visible = meta.filter((s): s is string => !!s);
  const geoAttrs =
    typeof ev.lat === "number" && typeof ev.lng === "number"
      ? { "data-lat": String(ev.lat), "data-lng": String(ev.lng) }
      : {};
  // Card-link pattern: a single anchor wraps the title (and provides
  // the row's main click-target via a ::before that stretches across
  // the whole .ledger). The visited + share buttons live inside the
  // title-line as siblings of the link, raised above the stretched
  // ::before via z-index so their clicks aren't intercepted.
  return (
    <div
      class={`ledger m-${cat.mood}`}
      data-id={String(ev.id)}
      data-search={`${ev.title} ${ev.venue ?? ""} ${ev.city ?? ""} ${cat.label}`.toLowerCase()}
      data-cat={cat.slug}
      {...geoAttrs}
    >
      <div class={`time${time ? "" : " allday"}`}>
        {time ?? (isOpen ? "ganztags" : "ganztags")}
        {ev.end_time && ev.end_time !== ev.time ? (
          <div style="font-size:0.7em;opacity:0.6">– {formatTime(ev.end_time, locale)}</div>
        ) : null}
      </div>
      <div class="body">
        <div class="title-line">
          <a class="t-title-link t-shift" href={`/event/${ev.id}`}>
            {ev.featured ? (
              <span class="ornament" aria-hidden="true">
                ❦
              </span>
            ) : null}
            <span class="t-title">{ev.title}</span>
          </a>
          <button
            type="button"
            class="row-action js-share-row"
            aria-label={tr.copyDirectLink}
            title={tr.copyDirectLink}
            data-id={String(ev.id)}
            data-title={ev.title}
          >
            ↗
          </button>
          <button
            type="button"
            class="row-action js-visited"
            aria-label={tr.markVisited}
            title={tr.markVisited}
            data-id={String(ev.id)}
          >
            ✓
          </button>
        </div>
        {visible.length > 0 ? (
          <div class="meta-line">
            {visible.map((s, i) => (
              <span class={i === 0 ? "" : "sep"}>{s}</span>
            ))}
          </div>
        ) : null}
      </div>
      <span
        class="cat-glyph"
        title={categoryLabel(cat.slug, tr).label}
        role="img"
        aria-label={categoryLabel(cat.slug, tr).label}
      >
        {cat.glyph}
      </span>
    </div>
  );
}

interface BroadsideProps {
  ev: Event;
  tr: Translations;
  locale: Locale;
}

/** Full-width image card. Used as visual punctuation every ~6 ledger
 *  rows to break the rhythm; only emitted for events that carry a real
 *  image URL. */
export function Broadside({ ev, tr, locale }: BroadsideProps) {
  const cat = categoryFor(ev.category);
  const img = imageProxyUrl(ev.image_url);
  const time = formatTime(ev.time, locale);
  const geoAttrs =
    typeof ev.lat === "number" && typeof ev.lng === "number"
      ? { "data-lat": String(ev.lat), "data-lng": String(ev.lng) }
      : {};
  return (
    <a class="broadside t-shift" href={`/event/${ev.id}`} {...geoAttrs}>
      {img ? (
        // CSS background-image can't be lazy-loaded; render an <img>
        // and place it absolutely so it still fills the broadside
        // tile but participates in the browser's lazy-load + decoding
        // pipeline. Saves bandwidth on the events users never scroll
        // far enough to see.
        <div class="image" aria-hidden="true">
          {/* width/height tell the layout engine the aspect ratio up-front so
              the broadside-img cell doesn't shift in (CLS). object-fit: cover
              in the CSS still crops to the .image container's actual size. */}
          <img class="broadside-img" src={img} alt="" width="400" height="200" loading="lazy" decoding="async" />
        </div>
      ) : (
        <div class="image" style="background:var(--color-paper-2)" aria-hidden="true" />
      )}
      <div class="copy">
        <div class="eyebrow">
          <span style={`color:var(--color-${cat.mood})`}>{cat.glyph}</span> {categoryLabel(cat.slug, tr).label} ·{" "}
          {ev.end_date ? formatDateRange(ev.date, ev.end_date, locale) : formatDateLong(ev.date, locale)}
          {time ? ` · ${time}` : ""}
        </div>
        <h3 class="t-title">{ev.title}</h3>
        {ev.description ? <p class="desc">{ev.description}</p> : null}
        <div class="meta-line">
          {ev.venue ?? "Landau"}
          {ev.city && !venueIncludesCity(ev.venue, ev.city) ? ` · ${ev.city}` : ""}
          {ev.price ? ` · ${ev.price}` : ""}
        </div>
      </div>
    </a>
  );
}

interface EventListProps {
  events: Event[];
  date: string;
  tr: Translations;
  locale: Locale;
}

/** Renders a day's events with periodic broadside breakouts. The cadence
 *  is "every 7 ledger rows, lift one event with an image into a
 *  broadside" — but only if at least 8 rows remain, so the page doesn't
 *  end on a broadside that visually orphan-quotes its category. */
export function EventList({ events, tr, locale }: EventListProps) {
  if (events.length === 0) {
    return <div class="empty">{tr.emptyDay}</div>;
  }
  const ROWS_BETWEEN_BROADSIDES = 7;
  const out: ReturnType<typeof Ledger>[] = [];
  let sinceBroadside = 0;
  events.forEach((ev, idx) => {
    const remaining = events.length - idx;
    const eligible = !!ev.image_url && sinceBroadside >= ROWS_BETWEEN_BROADSIDES && remaining >= 4;
    if (eligible) {
      out.push(<Broadside ev={ev} tr={tr} locale={locale} />);
      sinceBroadside = 0;
    } else {
      out.push(<Ledger ev={ev} tr={tr} locale={locale} />);
      sinceBroadside++;
    }
  });
  return <Fragment>{out}</Fragment>;
}
