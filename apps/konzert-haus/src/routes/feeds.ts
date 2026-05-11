import { buildUtm, dateOffset, icsEsc, slugify, todayIso, utcStamp, xmlEsc } from "@museumsufer/core";
import { Hono } from "hono";
import { type DayEvent, getEventById, getEventsInRange, getVenueBySlug } from "../db";
import { type Env, parseGenre } from "../types";
import { APP_URL } from "./static";

const utm = buildUtm("frankfurt.konzert.haus");
const app = new Hono<{ Bindings: Env }>();

app.get("/feed.ics", (c) => {
  const events = getEventsInRange(todayIso(), dateOffset(14));
  return c.body(buildIcs(events, "konzert.haus"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=1800, s-maxage=3600" },
  });
});

app.get("/feed.rss", (c) => {
  const events = getEventsInRange(todayIso(), dateOffset(14));
  return c.body(buildRss(events), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
});

app.get("/feed.xml", (c) => c.redirect("/feed.rss", 301));

app.get("/spielort/:slug/feed.ics", (c) => {
  const slug = c.req.param("slug");
  const venue = getVenueBySlug(slug);
  if (!venue) return c.notFound();
  const events = getEventsInRange(todayIso(), dateOffset(60), { venue: slug });
  return c.body(buildIcs(events, venue.name), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=1800, s-maxage=3600" },
  });
});

app.get("/genre/:slug/feed.ics", (c) => {
  const genre = parseGenre(c.req.param("slug"));
  if (!genre) return c.notFound();
  const events = getEventsInRange(todayIso(), dateOffset(60), { genre });
  return c.body(buildIcs(events, `konzert.haus — ${genre}`), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=1800, s-maxage=3600" },
  });
});

app.get("/event/:id{[0-9]+}/feed.ics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const event = getEventById(id);
  if (!event) return c.notFound();
  return c.body(buildIcs([event], `${event.venue.name} – ${event.title}`), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugForFile(event.title)}-${event.date}.ics"`,
      "Cache-Control": "public, max-age=600",
    },
  });
});

export default app;

function buildIcs(events: DayEvent[], calName: string): string {
  const vevents = events.map(buildVevent);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//konzert.haus//DE",
    `X-WR-CALNAME:${icsEsc(calName)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function buildVevent(e: DayEvent): string {
  const dtDate = e.date.replace(/-/g, "");
  let dtStart: string;
  let dtEnd: string;
  if (e.time) {
    const tStart = e.time.replace(":", "");
    dtStart = `DTSTART;TZID=Europe/Berlin:${dtDate}T${tStart}00`;
    if (e.end_time) {
      const tEnd = e.end_time.replace(":", "");
      dtEnd = `DTEND;TZID=Europe/Berlin:${dtDate}T${tEnd}00`;
    } else {
      const [hh, mm] = e.time.split(":");
      const startHour = parseInt(hh, 10);
      const endHourRaw = startHour + 2;
      const endHour = endHourRaw % 24;
      let endDateStr = dtDate;
      if (endHourRaw >= 24) {
        const next = new Date(`${e.date}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        endDateStr = next.toISOString().slice(0, 10).replace(/-/g, "");
      }
      dtEnd = `DTEND;TZID=Europe/Berlin:${endDateStr}T${String(endHour).padStart(2, "0")}${mm}00`;
    }
  } else {
    dtStart = `DTSTART;VALUE=DATE:${dtDate}`;
    dtEnd = `DTEND;VALUE=DATE:${dtDate}`;
  }

  const titleParts = [e.title, e.subtitle].filter(Boolean) as string[];
  const summary = `SUMMARY:${icsEsc(titleParts.join(" — "))}`;
  const location = `LOCATION:${icsEsc(e.venue_room ? `${e.venue.name} — ${e.venue_room}` : e.venue.name)}`;
  const descLines: string[] = [];
  if (e.performers) descLines.push(e.performers);
  if (e.price_min != null) {
    descLines.push(e.price_max && e.price_max !== e.price_min ? `${e.price_min}–${e.price_max} €` : `${e.price_min} €`);
  }
  if (e.ticket_url) descLines.push(utm(e.ticket_url, "ics"));
  const description = descLines.length ? `DESCRIPTION:${icsEsc(descLines.join("\n"))}` : "";

  const linkSource = e.detail_url ?? e.ticket_url ?? `${APP_URL}/api/events/${e.id}`;
  const url = `URL:${icsEsc(utm(linkSource, "ics"))}`;
  const uid = `UID:event-${e.id}@frankfurt.konzert.haus`;
  const dtstamp = `DTSTAMP:${utcStamp()}`;

  return [
    "BEGIN:VEVENT",
    uid,
    dtstamp,
    dtStart,
    dtEnd,
    summary,
    location,
    description,
    url,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function buildRss(events: DayEvent[]): string {
  const items = events.map((e) => {
    const dateStr = e.time ? `${e.date}T${e.time}:00+02:00` : `${e.date}T00:00:00+02:00`;
    const pubDate = new Date(dateStr).toUTCString();
    const linkSource = e.detail_url ?? e.ticket_url ?? `${APP_URL}/api/events/${e.id}`;
    const link = utm(linkSource, "rss");
    const title = e.title + (e.time ? ` — ${e.time} Uhr` : "");
    const parts: string[] = [];
    parts.push(`${e.venue.name}${e.venue_room ? `, ${e.venue_room}` : ""}`);
    if (e.subtitle) parts.push(e.subtitle);
    if (e.price_min != null) {
      parts.push(e.price_max && e.price_max !== e.price_min ? `${e.price_min}–${e.price_max} €` : `${e.price_min} €`);
    }
    return `    <item>
      <title>${xmlEsc(title)}</title>
      <link>${xmlEsc(link)}</link>
      <guid isPermaLink="false">event-${e.id}@frankfurt.konzert.haus</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${xmlEsc(e.venue.name)}</category>
      <description>${xmlEsc(parts.join(" — "))}</description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>konzert.haus</title>
    <link>${APP_URL}</link>
    <description>Konzerte in Frankfurt und Umgebung — die nächsten 14 Tage</description>
    <language>de</language>
    <atom:link href="${APP_URL}/feed.rss" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;
}

function slugForFile(s: string): string {
  return slugify(s).slice(0, 60);
}
