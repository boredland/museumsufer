/**
 * LLM-friendly markdown views of "a day's events" and "a venue's events"
 * served by each app's `Accept: text/markdown` handler. Callers pass
 * events in the `MarkdownEvent` shape + a few branding strings and get a
 * string back.
 */
import { buildUtm } from "./utm";

export interface MarkdownEvent {
  date: string;
  time?: string | null;
  title: string;
  subtitle?: string | null;
  /** Resolved venue name (e.g., "Alte Oper Frankfurt"). */
  venueLabel?: string;
  /** Optional sub-venue (e.g., "Mozart Saal"). */
  venueRoom?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  /** Preferred outbound URL: ticket first, detail page second. */
  ticketUrl?: string | null;
  detailUrl?: string | null;
  /** Pre-formatted markdown appended to the bullet (e.g. " **(Ausverkauft)**").
   *  Also: when set to a "cancelled/sold-out" sentinel the caller can drop price
   *  themselves before populating MarkdownEvent — the renderer is unopinionated. */
  statusSuffix?: string | null;
}

export interface DayMarkdownOptions {
  date: string;
  events: MarkdownEvent[];
  /** Brand line: e.g., "konzert.haus" or "Frankfurt Theater". */
  brand: string;
  /** Locale tag for the date heading (e.g., "de-DE"). */
  localeTag: string;
  /** Shown when no events match. */
  emptyCopy: string;
  /** Lowercased singular noun, used in "5 {nounPlural}." count line. */
  nounSingular: string;
  nounPlural: string;
  /** API URL appended in the footer note. */
  apiUrl: string;
  /** Optional UTM source used for URL tagging; pass the canonical host. */
  utmSource: string;
}

export interface VenueMarkdownOptions {
  events: MarkdownEvent[];
  /** Venue header. */
  venueName: string;
  venueAddress?: string | null;
  venueWebsite?: string | null;
  localeTag: string;
  /** Shown when no events match. */
  emptyCopy: string;
  apiUrl: string;
  utmSource: string;
}

function formatLongDate(iso: string, localeTag: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function eventBullet(
  e: MarkdownEvent,
  opts: { showVenue: boolean; utm: (url: string, src: string) => string },
): string {
  const time = e.time ?? "—";
  const subtitle = e.subtitle ? ` — ${e.subtitle}` : "";
  const price =
    e.priceMin == null
      ? ""
      : e.priceMax && e.priceMax !== e.priceMin
        ? ` · ${e.priceMin}–${e.priceMax} €`
        : ` · ${e.priceMin} €`;
  const room = e.venueRoom ? `, ${e.venueRoom}` : "";
  const venue = opts.showVenue && e.venueLabel ? ` _(${e.venueLabel}${room})_` : room ? ` _(${e.venueRoom})_` : "";
  const urlSource = e.ticketUrl ?? e.detailUrl ?? "";
  const url = urlSource ? opts.utm(urlSource, "markdown") : "";
  const title = url ? `[${e.title}](${url})` : e.title;
  const status = e.statusSuffix ?? "";
  return `- **${time}** ${title}${subtitle}${venue}${price}${status}`;
}

export function renderDayMarkdown(opts: DayMarkdownOptions): string {
  const utm = buildUtm(opts.utmSource);
  const niceDate = formatLongDate(opts.date, opts.localeTag);
  const lines = [`# ${opts.brand} — ${niceDate}`, ""];
  if (!opts.events.length) {
    lines.push(`_${opts.emptyCopy}_`);
    return lines.join("\n");
  }
  const noun = opts.events.length === 1 ? opts.nounSingular : opts.nounPlural;
  lines.push(`${opts.events.length} ${noun}.`);
  lines.push("");
  for (const e of opts.events) lines.push(eventBullet(e, { showVenue: true, utm }));
  lines.push("");
  lines.push("---");
  lines.push(`Daten unter ${opts.apiUrl}`);
  return lines.join("\n");
}

export function renderVenueMarkdown(opts: VenueMarkdownOptions): string {
  const utm = buildUtm(opts.utmSource);
  const lines = [`# ${opts.venueName}`, ""];
  if (opts.venueAddress) lines.push(`_${opts.venueAddress}_`);
  if (opts.venueWebsite) lines.push(`Website: ${utm(opts.venueWebsite, "markdown")}`);
  lines.push("");
  if (!opts.events.length) {
    lines.push(`_${opts.emptyCopy}_`);
    return lines.join("\n");
  }
  const byDate = new Map<string, MarkdownEvent[]>();
  for (const e of opts.events) {
    const arr = byDate.get(e.date);
    if (arr) arr.push(e);
    else byDate.set(e.date, [e]);
  }
  for (const [date, dayEvents] of byDate) {
    lines.push(`## ${formatLongDate(date, opts.localeTag)}`);
    lines.push("");
    for (const e of dayEvents) lines.push(eventBullet(e, { showVenue: false, utm }));
    lines.push("");
  }
  lines.push("---");
  lines.push(`Daten unter ${opts.apiUrl}`);
  return lines.join("\n");
}

/** Content-negotiation helper. Match the `Accept` header for markdown. */
export function wantsMarkdown(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/markdown") || accept.includes("text/x-markdown");
}
