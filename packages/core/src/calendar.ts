/**
 * Cross-vendor "Add to calendar" URL builders + RFC-5545 ICS emitters.
 * Originally split across each app's own helpers; lifted to core so all
 * three apps share one implementation.
 *
 * `location` is the human-readable venue label (museum name, theater
 * name + room, etc.). The original museums shape called it
 * `museum_name`; renamed here to keep the helper neutral.
 */
import { icsEsc, utcStamp, xmlEsc } from "./escape";

export interface CalendarEvent {
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  title: string;
  location?: string;
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

export function buildGoogleCalendarUrl(ev: CalendarEvent): string {
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
    location: ev.location || "",
    details: eventDesc(ev),
  });
  if (ev.time) params.set("ctz", "Europe/Berlin");
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarUrl(ev: CalendarEvent): string {
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
    location: ev.location || "",
    body: eventDesc(ev),
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function buildYahooCalendarUrl(ev: CalendarEvent): string {
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
    in_loc: ev.location || "",
    desc: eventDesc(ev),
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
}

// ─── ICS / RFC 5545 ──────────────────────────────────────────────────

export type IcsStatus = "CONFIRMED" | "CANCELLED" | "TENTATIVE";

export interface IcsEventInput extends CalendarEvent {
  /** Stable cross-run UID — typically `${id}@${host}`. */
  uid: string;
  /** Optional URL field on the VEVENT. Falls back to `detail_url`. */
  url?: string;
  /** VEVENT STATUS line. Default "CONFIRMED" when explicitly set; omitted otherwise. */
  status?: IcsStatus;
  /** When the event has a start time but no end_time, synthesise an end
   *  this many hours later. Defaults to 2 (matches the convention used
   *  by konzert-haus / theaters). Set 0 to emit no DTEND. */
  defaultDurationHours?: number;
}

/** Emit a single VEVENT block (no surrounding VCALENDAR). All-day events
 *  use VALUE=DATE; timed events use TZID=Europe/Berlin which the calling
 *  feed must declare in its VTIMEZONE block (or rely on consumer
 *  fallback — most do). */
export function buildIcsVevent(ev: IcsEventInput): string {
  const dt = (date: string, time?: string | null) =>
    date.replace(/-/g, "") + (time ? `T${time.replace(":", "")}00` : "");
  const stamp = utcStamp();
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${stamp}`,
    ev.time ? `DTSTART;TZID=Europe/Berlin:${dt(ev.date, ev.time)}` : `DTSTART;VALUE=DATE:${dt(ev.date)}`,
  ];
  if (ev.end_date || ev.end_time) {
    lines.push(
      ev.end_time
        ? `DTEND;TZID=Europe/Berlin:${dt(ev.end_date ?? ev.date, ev.end_time)}`
        : `DTEND;VALUE=DATE:${dt(ev.end_date ?? ev.date)}`,
    );
  } else if (ev.time && (ev.defaultDurationHours ?? 0) > 0) {
    const dur = ev.defaultDurationHours ?? 2;
    const [h, m] = ev.time.split(":").map(Number);
    const endH = (h + dur) % 24;
    const endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    lines.push(`DTEND;TZID=Europe/Berlin:${dt(ev.date, endTime)}`);
  }
  if (ev.status) lines.push(`STATUS:${ev.status}`);
  lines.push(`SUMMARY:${icsEsc(ev.title)}`);
  if (ev.location) lines.push(`LOCATION:${icsEsc(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${icsEsc(ev.description)}`);
  const url = ev.url ?? ev.detail_url;
  if (url) lines.push(`URL:${url}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export interface IcsCalendarOptions {
  /** PRODID — published calendar identifier (e.g., "-//landau.today//EN"). */
  prodId: string;
  /** X-WR-CALNAME — human-readable calendar name in the consumer UI. */
  name?: string;
  events: IcsEventInput[];
}

export function buildIcsCalendar(opts: IcsCalendarOptions): string {
  const head = ["BEGIN:VCALENDAR", `PRODID:${opts.prodId}`, "VERSION:2.0", "CALSCALE:GREGORIAN"];
  if (opts.name) head.push(`X-WR-CALNAME:${icsEsc(opts.name)}`);
  return [...head, ...opts.events.map(buildIcsVevent), "END:VCALENDAR"].join("\r\n");
}

// ─── RSS 2.0 ─────────────────────────────────────────────────────────

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: Date | string;
  category?: string;
  guid?: string;
}

export interface RssChannelOptions {
  title: string;
  link: string;
  description: string;
  /** Self-link href to advertise via <atom:link rel="self">. */
  selfLink: string;
  language?: string;
  items: RssItem[];
}

export function buildRssFeed(opts: RssChannelOptions): string {
  const itemsXml = opts.items
    .map((item) => {
      const pubDate =
        item.pubDate instanceof Date ? item.pubDate.toUTCString() : (item.pubDate ?? new Date().toUTCString());
      const guid = item.guid ?? item.link;
      return [
        "<item>",
        `<title>${xmlEsc(item.title)}</title>`,
        `<link>${xmlEsc(item.link)}</link>`,
        `<guid isPermaLink="true">${xmlEsc(guid)}</guid>`,
        `<pubDate>${pubDate}</pubDate>`,
        item.category ? `<category>${xmlEsc(item.category)}</category>` : "",
        item.description ? `<description>${xmlEsc(item.description)}</description>` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xmlEsc(opts.title)}</title>
<link>${xmlEsc(opts.link)}</link>
<atom:link href="${xmlEsc(opts.selfLink)}" rel="self" type="application/rss+xml" />
<description>${xmlEsc(opts.description)}</description>
<language>${opts.language ?? "de-de"}</language>
${itemsXml}
</channel>
</rss>`;
}
