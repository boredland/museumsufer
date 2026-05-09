import { Fragment } from "hono/jsx";
import { CATEGORIES, CATEGORY_BY_SLUG, type CategoryDef } from "./categories";
import { todayIso } from "./date";
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

interface ChipRowProps {
  active?: string;
  date: string;
  counts: Map<string, number>;
}

export function ChipRow({ active, date, counts }: ChipRowProps) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return (
    <nav class="strip" aria-label="Kategorie">
      <div class="strip-rail">
        <a class={`chip ${active ? "" : "active"}`} href={`/?date=${date}`}>
          <span class="t-label">Alle</span>
          {total > 0 ? <span class="count">{total}</span> : null}
        </a>
        {CATEGORIES.map((cat) => {
          const n = counts.get(cat.slug) ?? 0;
          if (n === 0 && active !== cat.slug) return null;
          return (
            <a class={`chip m-${cat.mood} ${active === cat.slug ? "active" : ""}`} href={`/c/${cat.slug}?date=${date}`}>
              <span class="glyph" aria-hidden="true">
                {cat.glyph}
              </span>
              <span class="t-label">{cat.short}</span>
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
}

export function DateStrip({ current, category, counts, daysAhead = 21 }: DateStripProps) {
  const today = todayIso();
  const days: string[] = [];
  const start = new Date(`${today}T12:00:00Z`);
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return (
    <nav class="dates" aria-label="Datum">
      <div class="dates-rail">
        {days.map((iso) => {
          const n = counts.get(iso) ?? 0;
          const href = category ? `/c/${category}?date=${iso}` : `/?date=${iso}`;
          return (
            <a
              class={`day ${iso === current ? "active" : ""} ${iso === today ? "is-today" : ""} ${
                n === 0 ? "empty" : ""
              }`}
              href={href}
              aria-current={iso === current ? "date" : undefined}
            >
              <span class="day-name">{weekdayShort(iso)}</span>
              <span class="day-num">{dayOfMonth(iso)}</span>
              <span class="day-month">{monthShort(iso)}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function DayHeadline({ date, total }: { date: string; total: number }) {
  const today = todayIso();
  const rel = relativeDayLabel(date, today);
  return (
    <div class="day-headline">
      <h2>{rel ?? formatDateLong(date)}</h2>
      <span class="meta">
        {total} {total === 1 ? "Veranstaltung" : "Veranstaltungen"}
      </span>
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
}

/** The ledger row — the page's primary card vocabulary. Looks like a
 *  classified-listing entry: tabular time on the left, hairline rule,
 *  title + venue + price in the body, mood-colored category glyph at
 *  the right. */
export function Ledger({ ev }: LedgerProps) {
  const cat = categoryFor(ev.category);
  const time = formatTime(ev.time);
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
  return (
    <a class={`ledger m-${cat.mood} t-shift`} href={`/event/${ev.id}`} data-cat={cat.slug}>
      <div class={`time${time ? "" : " allday"}`}>
        {time ?? (isOpen ? "ganztags" : "ganztags")}
        {ev.end_time && ev.end_time !== ev.time ? (
          <div style="font-size:0.7em;opacity:0.6">– {formatTime(ev.end_time)}</div>
        ) : null}
      </div>
      <div class="body">
        <div class="title-line">
          {ev.featured ? (
            <span class="ornament" aria-hidden="true">
              ❦
            </span>
          ) : null}
          <span class="t-title">{ev.title}</span>
        </div>
        {visible.length > 0 ? (
          <div class="meta-line">
            {visible.map((s, i) => (
              <span class={i === 0 ? "" : "sep"}>{s}</span>
            ))}
          </div>
        ) : null}
      </div>
      <span class="cat-glyph" title={cat.label} role="img" aria-label={cat.label}>
        {cat.glyph}
      </span>
    </a>
  );
}

interface BroadsideProps {
  ev: Event;
}

/** Full-width image card. Used as visual punctuation every ~6 ledger
 *  rows to break the rhythm; only emitted for events that carry a real
 *  image URL. */
export function Broadside({ ev }: BroadsideProps) {
  const cat = categoryFor(ev.category);
  const img = imageProxyUrl(ev.image_url);
  const time = formatTime(ev.time);
  return (
    <a class="broadside t-shift" href={`/event/${ev.id}`}>
      {img ? (
        <div class="image" style={`background-image:url('${img}')`} aria-hidden="true" />
      ) : (
        <div class="image" style="background:var(--color-paper-2)" aria-hidden="true" />
      )}
      <div class="copy">
        <div class="eyebrow">
          <span style={`color:var(--color-${cat.mood})`}>{cat.glyph}</span> {cat.label} ·{" "}
          {ev.end_date ? formatDateRange(ev.date, ev.end_date) : formatDateLong(ev.date)}
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
}

/** Renders a day's events with periodic broadside breakouts. The cadence
 *  is "every 7 ledger rows, lift one event with an image into a
 *  broadside" — but only if at least 8 rows remain, so the page doesn't
 *  end on a broadside that visually orphan-quotes its category. */
export function EventList({ events }: EventListProps) {
  if (events.length === 0) {
    return <div class="empty">Heute kein Programm gefunden.</div>;
  }
  const ROWS_BETWEEN_BROADSIDES = 7;
  const out: ReturnType<typeof Ledger>[] = [];
  let sinceBroadside = 0;
  events.forEach((ev, idx) => {
    const remaining = events.length - idx;
    const eligible = !!ev.image_url && sinceBroadside >= ROWS_BETWEEN_BROADSIDES && remaining >= 4;
    if (eligible) {
      out.push(<Broadside ev={ev} />);
      sinceBroadside = 0;
    } else {
      out.push(<Ledger ev={ev} />);
      sinceBroadside++;
    }
  });
  return <Fragment>{out}</Fragment>;
}
