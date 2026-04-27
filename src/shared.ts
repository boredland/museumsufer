export const MUSEUMSUFER_DE = "https://www.museumsufer.de";
export const APP_URL = "https://museumsufer.app";
export const USER_AGENT = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

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

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateHtml(text: string, maxLen = 500): string | null {
  const stripped = stripHtml(text);
  if (stripped.length === 0) return null;
  if (stripped.length <= maxLen) return stripped;
  const cut = stripped.lastIndexOf(" ", maxLen);
  return `${stripped.slice(0, cut > 0 ? cut : maxLen)}…`;
}

export function nullIfMidnight(time: string | null | undefined): string | null {
  if (!time || time === "00:00") return null;
  return time;
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

export function buildCalendarUrl(ev: {
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  title: string;
  museum_name?: string;
  description: string | null;
  detail_url: string | null;
}): string {
  const date = ev.date.replace(/-/g, "");
  let startDt: string;
  let endDt: string;
  if (ev.time) {
    startDt = `${date}T${ev.time.replace(":", "")}00`;
    if (ev.end_time) {
      const endDate = ev.end_date ? ev.end_date.replace(/-/g, "") : date;
      endDt = `${endDate}T${ev.end_time.replace(":", "")}00`;
    } else {
      const h = (parseInt(ev.time.split(":")[0], 10) + 1) % 24;
      endDt = `${date}T${h.toString().padStart(2, "0")}${ev.time.split(":")[1]}00`;
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
    details: (ev.description || "") + (ev.detail_url ? `\n${ev.detail_url}` : ""),
  });
  if (ev.time) params.set("ctz", "Europe/Berlin");
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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

export function buildOutlookUrl(ev: CalendarEvent): string {
  const desc = (ev.description || "") + (ev.detail_url ? `\n${ev.detail_url}` : "");
  const startIso = ev.time ? `${ev.date}T${ev.time}:00` : ev.date;
  let endIso: string;
  if (ev.time && ev.end_time) {
    endIso = `${ev.end_date || ev.date}T${ev.end_time}:00`;
  } else if (ev.time) {
    const h = (parseInt(ev.time.split(":")[0], 10) + 1) % 24;
    endIso = `${ev.date}T${h.toString().padStart(2, "0")}:${ev.time.split(":")[1]}:00`;
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
    body: desc,
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function buildYahooUrl(ev: CalendarEvent): string {
  const date = ev.date.replace(/-/g, "");
  const desc = (ev.description || "") + (ev.detail_url ? `\n${ev.detail_url}` : "");
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
    desc,
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

export function normalizeUrl(url: string | null | undefined, baseUrl: string): string | null {
  if (!url) return null;
  url = url.trim();
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${baseUrl.replace(/\/$/, "")}${url}`;
  return `${baseUrl.replace(/\/$/, "")}/${url}`;
}
