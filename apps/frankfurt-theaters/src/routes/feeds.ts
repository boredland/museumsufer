import { Hono } from "hono";
import { dateOffset, todayIso } from "../date";
import { type DayPerformance, getPerformanceById, getPerformancesInRange, getTheaterBySlug } from "../db";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";
import { APP_URL } from "./static";

/**
 * RFC 5545 calendar feeds. Three flavours:
 *   - /feed.ics                       (next 14 days, all theaters)
 *   - /api/theater/{slug}.ics         (next 60 days, single theater)
 *   - /api/performance/{id}.ics       (single performance)
 *
 * Times are emitted with TZID=Europe/Berlin so calendar clients render the
 * local clock time. Cancelled performances ship STATUS:CANCELLED so
 * subscribers see a strikethrough rather than a plain event.
 */
const app = new Hono<{ Bindings: Env }>();

app.get("/feed.ics", async (c) => {
  const from = todayIso();
  const to = dateOffset(14);
  const performances = await getPerformancesInRange(c.env.DB, from, to);
  return c.body(buildIcs(performances, "Frankfurt Theater"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
});

app.get("/feed.xml", async (c) => {
  const from = todayIso();
  const to = dateOffset(14);
  const performances = await getPerformancesInRange(c.env.DB, from, to);
  return c.body(buildRss(performances), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
});

app.get("/rss.xml", (c) => c.redirect("/feed.xml", 301));

app.get("/theater/:slug/feed.ics", async (c) => {
  const slug = c.req.param("slug");
  if (!slug) return c.notFound();
  const theater = await getTheaterBySlug(c.env.DB, slug);
  if (!theater) {
    const known = THEATERS.find((t) => t.slug === slug);
    if (!known) return c.notFound();
  }
  const performances = await getPerformancesInRange(c.env.DB, todayIso(), dateOffset(60), slug);
  const name = theater?.name ?? THEATERS.find((t) => t.slug === slug)?.name ?? slug;
  return c.body(buildIcs(performances, name), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
});

app.get("/performance/:id/feed.ics", async (c) => {
  const idParam = c.req.param("id");
  if (!idParam) return c.notFound();
  const id = parseInt(idParam, 10);
  if (!Number.isFinite(id)) return c.notFound();
  const perf = await getPerformanceById(c.env.DB, id);
  if (!perf) return c.notFound();
  return c.body(buildIcs([perf], `${perf.theater.name} – ${perf.show.title}`), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugForFile(perf.show.title)}-${perf.date}.ics"`,
      "Cache-Control": "public, max-age=600",
    },
  });
});

export default app;

function buildIcs(performances: DayPerformance[], calName: string): string {
  const vevents = performances.map((p) => buildVevent(p));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Frankfurt Theater//DE",
    `X-WR-CALNAME:${icsEsc(calName)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function buildVevent(p: DayPerformance): string {
  const dtDate = p.date.replace(/-/g, "");
  let dtStart: string;
  let dtEnd: string;

  if (p.time) {
    const tStart = p.time.replace(":", "");
    dtStart = `DTSTART;TZID=Europe/Berlin:${dtDate}T${tStart}00`;
    if (p.end_time) {
      const endDate = (p.end_date ?? p.date).replace(/-/g, "");
      const tEnd = p.end_time.replace(":", "");
      dtEnd = `DTEND;TZID=Europe/Berlin:${endDate}T${tEnd}00`;
    } else {
      const [hh, mm] = p.time.split(":");
      const endHour = (parseInt(hh, 10) + 2) % 24;
      dtEnd = `DTEND;TZID=Europe/Berlin:${dtDate}T${String(endHour).padStart(2, "0")}${mm}00`;
    }
  } else {
    dtStart = `DTSTART;VALUE=DATE:${dtDate}`;
    dtEnd = `DTEND;VALUE=DATE:${dtDate}`;
  }

  const title = `${p.show.title}${p.show.subtitle ? ` — ${p.show.subtitle.replace(/\s*<br\s*\/?>\s*/gi, " · ")}` : ""}`;
  const summary = `SUMMARY:${icsEsc(title)}`;
  const locParts = [p.theater.name, p.venue_room].filter((s): s is string => Boolean(s) && s !== p.theater.name);
  const location = `LOCATION:${icsEsc([p.theater.name, ...locParts].join(", "))}`;

  const descLines: string[] = [];
  if (p.show.subtitle) descLines.push(p.show.subtitle.replace(/\s*<br\s*\/?>\s*/gi, " · "));
  if (p.price_min != null) {
    descLines.push(p.price_max && p.price_max !== p.price_min ? `${p.price_min}–${p.price_max} €` : `${p.price_min} €`);
  }
  descLines.push(`Status: ${p.status}`);
  if (p.ticket_url) descLines.push(p.ticket_url);
  const description = descLines.length ? `DESCRIPTION:${icsEsc(descLines.join("\\n"))}` : "";

  const url = p.show.detail_url || p.ticket_url ? `URL:${p.show.detail_url ?? p.ticket_url}` : "";
  const status = p.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED";
  const uid = `UID:perf-${p.id}@frankfurt.ins.theater`;
  const dtstamp = `DTSTAMP:${utcStamp()}`;
  const link = `${APP_URL}/api/performance/${p.id}`;

  return [
    "BEGIN:VEVENT",
    uid,
    dtstamp,
    dtStart,
    dtEnd,
    summary,
    location,
    description,
    url || `URL:${link}`,
    status,
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function utcStamp(): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15)}Z`;
}

function buildRss(performances: DayPerformance[]): string {
  const items = performances.map((p) => {
    const dateStr = p.time ? `${p.date}T${p.time}:00+02:00` : `${p.date}T00:00:00+02:00`;
    const pubDate = new Date(dateStr).toUTCString();
    const link = p.show.detail_url || p.ticket_url || `${APP_URL}/api/performance/${p.id}`;
    const title = p.show.title + (p.time ? ` — ${p.time} Uhr` : "");
    const descParts: string[] = [];
    descParts.push(`${p.theater.name}${p.venue_room && p.venue_room !== p.theater.name ? `, ${p.venue_room}` : ""}`);
    if (p.show.subtitle) descParts.push(p.show.subtitle.replace(/\s*<br\s*\/?>\s*/gi, " · "));
    if (p.status === "sold_out") descParts.push("Ausverkauft");
    else if (p.status === "cancelled") descParts.push("Entfällt");
    else if (p.price_min != null) {
      descParts.push(
        p.price_max && p.price_max !== p.price_min ? `${p.price_min}–${p.price_max} €` : `${p.price_min} €`,
      );
    }
    return `    <item>
      <title>${xmlEsc(title)}</title>
      <link>${xmlEsc(link)}</link>
      <guid isPermaLink="false">perf-${p.id}@frankfurt.ins.theater</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${xmlEsc(p.theater.name)}</category>
      <description>${xmlEsc(descParts.join(" — "))}</description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Frankfurt Theater</title>
    <link>${APP_URL}</link>
    <description>Spielplan der Frankfurter Bühnen — die nächsten 14 Tage</description>
    <language>de</language>
    <atom:link href="${APP_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;
}

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function icsEsc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function slugForFile(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöü]/g, (m) => ({ ä: "ae", ö: "oe", ü: "ue" })[m] ?? m)
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
