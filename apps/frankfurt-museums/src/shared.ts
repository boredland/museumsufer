import {
  decodeEntities as coreDecodeEntities,
  escapeHtml as coreEscapeHtml,
  normalizeUrl as coreNormalizeUrl,
  nullIfMidnight as coreNullIfMidnight,
  stripHtml as coreStripHtml,
  truncate as coreTruncate,
} from "@museumsufer/core";

export const MUSEUMSUFER_DE = "https://www.museumsufer.de";
export const APP_URL = "https://museumsufer.app";
export const USER_AGENT = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

// Museums uses zero-padded month STRINGS (concatenated into ISO date strings),
// while core/german uses NUMBERS. Different shape, so we keep them local.
export const GERMAN_MONTHS_SHORT: Record<string, string> = {
  jan: "01",
  feb: "02",
  mär: "03",
  mar: "03",
  apr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dez: "12",
};

export const GERMAN_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

// Re-export from @museumsufer/core. Existing call sites keep working.
// `escHtml` keeps its old name; the new core version also escapes apostrophes,
// which is a strict superset of what museums was doing.
export const escHtml = coreEscapeHtml;
export const nullIfMidnight = coreNullIfMidnight;
export const normalizeUrl = coreNormalizeUrl;
export const decodeEntities = coreDecodeEntities;

/**
 * Strip HTML and decode entities. Core's implementation now preserves German
 * named entities (`&auml;` → `ä`, `&szlig;` → `ß`, `&shy;`, …) where the
 * previous local version silently dropped them. This is a strict
 * UX improvement for scraped content.
 */
export const stripHtml = coreStripHtml;

/** Backwards-compatible wrapper around `core.truncate`, keeping the 500-char default. */
export function truncateHtml(text: string, maxLen = 500): string | null {
  return coreTruncate(text, maxLen);
}

/**
 * Stricter image-URL sanitiser than core's: requires `http(s)://` and a valid
 * `URL` constructor parse. Used by museum scrapers where HTML often contains
 * relative paths or junk that we don't want to ship to the proxy.
 */
export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const cleaned = url.split(/\s+/)[0].trim().replace(/&amp;/g, "&");
  if (!cleaned.startsWith("http")) return null;
  try {
    new URL(cleaned);
    return cleaned;
  } catch {
    return null;
  }
}

export function formatDateFull(iso: string, dateLocaleStr: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  const weekday = d.toLocaleDateString(dateLocaleStr, { weekday: "long" });
  const rest = d.toLocaleDateString(dateLocaleStr, { day: "numeric", month: "long", year: "numeric" });
  return `${weekday}, ${rest}`;
}

export function formatDateShort(iso: string, dateLocaleStr: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(dateLocaleStr, { day: "numeric", month: "short" });
}

export interface CalendarEvent {
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  title: string;
  museum_name?: string;
  description: string | null;
  detail_url: string | null;
}

function endHour(time: string): string {
  const h = (parseInt(time.split(":")[0], 10) + 1) % 24;
  return h.toString().padStart(2, "0");
}

function eventDesc(ev: CalendarEvent): string {
  return (ev.description || "") + (ev.detail_url ? `\n${ev.detail_url}` : "");
}

export function buildCalendarUrl(ev: CalendarEvent): string {
  const date = ev.date.replace(/-/g, "");
  let startDt: string;
  let endDt: string;
  if (ev.time) {
    startDt = `${date}T${ev.time.replace(":", "")}00`;
    if (ev.end_time) {
      endDt = `${(ev.end_date || ev.date).replace(/-/g, "")}T${ev.end_time.replace(":", "")}00`;
    } else {
      endDt = `${date}T${endHour(ev.time)}${ev.time.split(":")[1]}00`;
    }
  } else {
    startDt = date;
    endDt = date;
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${startDt}/${endDt}`,
    location: ev.museum_name || "",
    details: eventDesc(ev),
  });
  if (ev.time) params.set("ctz", "Europe/Berlin");
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookUrl(ev: CalendarEvent): string {
  const startIso = ev.time ? `${ev.date}T${ev.time}:00` : ev.date;
  let endIso: string;
  if (ev.time && ev.end_time) {
    endIso = `${ev.end_date || ev.date}T${ev.end_time}:00`;
  } else if (ev.time) {
    endIso = `${ev.date}T${endHour(ev.time)}:${ev.time.split(":")[1]}:00`;
  } else {
    endIso = ev.date;
  }
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: startIso,
    enddt: endIso,
    location: ev.museum_name || "",
    body: eventDesc(ev),
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function buildYahooUrl(ev: CalendarEvent): string {
  const date = ev.date.replace(/-/g, "");
  let st: string;
  let dur: string;
  if (ev.time) {
    st = `${date}T${ev.time.replace(":", "")}00`;
    if (ev.end_time) {
      const startMin = parseInt(ev.time.split(":")[0], 10) * 60 + parseInt(ev.time.split(":")[1], 10);
      const endMin = parseInt(ev.end_time.split(":")[0], 10) * 60 + parseInt(ev.end_time.split(":")[1], 10);
      const diff = endMin > startMin ? endMin - startMin : 60;
      dur = `${String(Math.floor(diff / 60)).padStart(2, "0")}${String(diff % 60).padStart(2, "0")}`;
    } else {
      dur = "0100";
    }
  } else {
    st = date;
    dur = "allday";
  }
  const params = new URLSearchParams({
    v: "60",
    title: ev.title,
    st,
    dur,
    in_loc: ev.museum_name || "",
    desc: eventDesc(ev),
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
}

export function sortByPopularity<T extends { museum_slug?: string; museum_name?: string; like_count?: number }>(
  items: T[],
): T[] {
  const pop: Record<string, number> = {};
  for (const item of items) {
    const slug = item.museum_slug;
    if (!slug) continue;
    const count = item.like_count || 0;
    if (!pop[slug] || count > pop[slug]) pop[slug] = count;
  }
  return [...items].sort((a, b) => {
    const pa = pop[a.museum_slug || ""] || 0;
    const pb = pop[b.museum_slug || ""] || 0;
    if (pa !== pb) return pb - pa;
    return (a.museum_name || "").localeCompare(b.museum_name || "");
  });
}

export function classifyEvent(title: string, description?: string | null): string | null {
  const t = title.toLowerCase();
  const d = (description || "").toLowerCase();
  const haystack = `${t} ${d}`;

  if (
    haystack.includes("führung") ||
    haystack.includes("fuehrung") ||
    haystack.includes("rundgang") ||
    haystack.includes("spaziergang") ||
    haystack.includes("tour")
  )
    return "Führung";
  if (
    haystack.includes("workshop") ||
    haystack.includes("kurs") ||
    haystack.includes("atelier") ||
    haystack.includes("werkstatt")
  )
    return "Workshop";
  if (
    haystack.includes("vortrag") ||
    haystack.includes("lecture") ||
    haystack.includes("gespräch") ||
    haystack.includes("talk") ||
    haystack.includes("buchpräsentation") ||
    haystack.includes("diskussion")
  )
    return "Vortrag";
  if (haystack.includes("konzert") || haystack.includes("musik")) return "Konzert";
  if (haystack.includes("vernissage") || haystack.includes("eröffnung") || haystack.includes("eröffnungsfeier"))
    return "Vernissage";
  if (
    haystack.includes("familie") ||
    haystack.includes("kinder") ||
    haystack.includes(" für kids") ||
    haystack.includes("baby")
  )
    return "Familie";
  if (haystack.includes("film") || haystack.includes("kino") || haystack.includes("cinema")) return "Film";

  return null;
}
