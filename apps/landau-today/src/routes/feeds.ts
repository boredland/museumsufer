import { Hono } from "hono";
import { dateOffset, todayIso } from "../date";
import { getEventsForRange } from "../queries";
import { APP_URL, formatDateLong, formatTime } from "../shared";
import type { Env, Event } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/feed.xml", (c) => {
  const events = upcoming(7);
  const xml = buildRss(events);
  return c.text(xml, 200, {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
  });
});

app.get("/rss.xml", (c) => c.redirect("/feed.xml", 301));

app.get("/feed.ics", (c) => {
  const events = upcoming(14);
  const ics = buildIcs(events);
  return c.text(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
  });
});

app.get("/calendar.ics", (c) => c.redirect("/feed.ics", 301));

export default app;

function upcoming(days: number): Event[] {
  return getEventsForRange(todayIso(), dateOffset(days));
}

function buildRss(events: Event[]): string {
  const items = events
    .map((ev) => {
      const time = formatTime(ev.time);
      const title = `${ev.title}${time ? ` (${formatDateLong(ev.date)} ${time})` : ` (${formatDateLong(ev.date)})`}`;
      const link = `${APP_URL}/event/${ev.id}`;
      const desc = `${ev.venue ? `${ev.venue}. ` : ""}${ev.description ?? ""}`.trim();
      const pubDate = new Date(`${ev.date}T${ev.time ?? "00:00"}:00+02:00`).toUTCString();
      return `<item>
<title>${xml(title)}</title>
<link>${xml(link)}</link>
<guid isPermaLink="true">${xml(link)}</guid>
<pubDate>${pubDate}</pubDate>
<category>${xml(ev.category)}</category>
<description>${xml(desc)}</description>
</item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>landau.today</title>
<link>${APP_URL}</link>
<atom:link href="${APP_URL}/feed.xml" rel="self" type="application/rss+xml" />
<description>Veranstaltungen in Landau in der Pfalz.</description>
<language>de-de</language>
${items}
</channel>
</rss>`;
}

function buildIcs(events: Event[]): string {
  const stamp = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const dt = (date: string, time?: string) => date.replace(/-/g, "") + (time ? `T${time.replace(":", "")}00` : "");
  const blocks = events.map((ev) => {
    const lines = [
      "BEGIN:VEVENT",
      `UID:${ev.id}@landau.today`,
      `DTSTAMP:${stamp}`,
      ev.time ? `DTSTART;TZID=Europe/Berlin:${dt(ev.date, ev.time)}` : `DTSTART;VALUE=DATE:${dt(ev.date)}`,
      ev.end_date || ev.end_time
        ? ev.end_time
          ? `DTEND;TZID=Europe/Berlin:${dt(ev.end_date ?? ev.date, ev.end_time)}`
          : `DTEND;VALUE=DATE:${dt(ev.end_date ?? ev.date)}`
        : "",
      `SUMMARY:${icsEscape(ev.title)}`,
      ev.venue ? `LOCATION:${icsEscape(ev.venue)}` : "",
      ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : "",
      `URL:${APP_URL}/event/${ev.id}`,
      "END:VEVENT",
    ];
    return lines.filter(Boolean).join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "PRODID:-//landau.today//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:landau.today",
    ...blocks,
    "END:VCALENDAR",
  ].join("\r\n");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
