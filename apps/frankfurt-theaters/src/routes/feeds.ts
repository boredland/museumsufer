import {
  buildIcsCalendar,
  buildRssFeed,
  buildUtm,
  dateOffset,
  type IcsEventInput,
  type RssItem,
  slugify,
  todayIso,
} from "@museumsufer/core";
import { Hono } from "hono";
import { type DayPerformance, getPerformanceById, getPerformancesInRange, getTheaterBySlug } from "../db";
import type { Env } from "../types";
import { APP_URL } from "./static";

/**
 * RFC 5545 calendar feeds. Three flavours:
 *   - /feed.ics                       (next 14 days, all theaters)
 *   - /theater/{slug}/feed.ics        (next 60 days, single theater)
 *   - /event/{id}/feed.ics            (single performance)
 *
 * Cancelled performances ship STATUS:CANCELLED so subscribers see a
 * strikethrough rather than a plain event. Timed events default to a
 * 2-hour duration when no end_time is set.
 */
const utm = buildUtm("frankfurt.ins.theater");

const app = new Hono<{ Bindings: Env }>();

const ICS_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Cache-Control": "public, max-age=1800, s-maxage=3600",
};
const RSS_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=1800, s-maxage=3600",
};

app.get("/feed.ics", async (c) => {
  const performances = await getPerformancesInRange(todayIso(), dateOffset(14));
  return c.body(buildIcs(performances, "Frankfurt Theater"), { headers: ICS_HEADERS });
});

app.get("/feed.xml", async (c) => {
  const performances = await getPerformancesInRange(todayIso(), dateOffset(14));
  return c.body(buildRss(performances), { headers: RSS_HEADERS });
});

app.get("/rss.xml", (c) => c.redirect("/feed.xml", 301));

app.get("/theater/:slug/feed.ics", async (c) => {
  const slug = c.req.param("slug");
  if (!slug) return c.notFound();
  const theater = await getTheaterBySlug(slug);
  if (!theater) return c.notFound();
  const performances = await getPerformancesInRange(todayIso(), dateOffset(60), slug);
  return c.body(buildIcs(performances, theater.name), { headers: ICS_HEADERS });
});

app.get("/event/:id/feed.ics", async (c) => {
  const idParam = c.req.param("id");
  if (!idParam) return c.notFound();
  const id = parseInt(idParam, 10);
  if (!Number.isFinite(id)) return c.notFound();
  const perf = await getPerformanceById(id);
  if (!perf) return c.notFound();
  return c.body(buildIcs([perf], `${perf.theater.name} – ${perf.show.title}`), {
    headers: {
      ...ICS_HEADERS,
      "Content-Disposition": `attachment; filename="${slugify(perf.show.title).slice(0, 60)}-${perf.date}.ics"`,
      "Cache-Control": "public, max-age=600",
    },
  });
});

export default app;

function toIcsInput(p: DayPerformance): IcsEventInput {
  const sameVenue = !!p.venue_room && p.venue_room.trim().toLowerCase() === p.theater.name.trim().toLowerCase();
  const locParts = [p.theater.name, sameVenue ? null : p.venue_room].filter((s): s is string => Boolean(s));
  const subtitle = p.show.subtitle?.replace(/\s*<br\s*\/?>\s*/gi, " · ");
  const descLines: string[] = [];
  if (subtitle) descLines.push(subtitle);
  if (p.price_min != null) {
    descLines.push(p.price_max && p.price_max !== p.price_min ? `${p.price_min}–${p.price_max} €` : `${p.price_min} €`);
  }
  descLines.push(`Status: ${p.status}`);
  if (p.ticket_url) descLines.push(utm(p.ticket_url, "ics"));
  const link = p.show.detail_url ?? p.ticket_url ?? `${APP_URL}/api/performance/${p.id}`;
  return {
    uid: `perf-${p.id}@frankfurt.ins.theater`,
    date: p.date,
    time: p.time ?? null,
    end_time: p.end_time ?? null,
    end_date: p.end_date ?? null,
    title: `${p.show.title}${subtitle ? ` — ${subtitle}` : ""}`,
    location: [p.theater.name, ...locParts.slice(1)].join(", "),
    description: descLines.join("\n"),
    detail_url: null,
    url: utm(link, "ics"),
    status: p.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    defaultDurationHours: 2,
  };
}

function buildIcs(performances: DayPerformance[], calName: string): string {
  return buildIcsCalendar({
    prodId: "-//Frankfurt Theater//DE",
    name: calName,
    events: performances.map(toIcsInput),
  });
}

function buildRss(performances: DayPerformance[]): string {
  const items: RssItem[] = performances.map((p) => {
    const dateStr = p.time ? `${p.date}T${p.time}:00+02:00` : `${p.date}T00:00:00+02:00`;
    const linkSource = p.show.detail_url || p.ticket_url;
    const link = linkSource ? utm(linkSource, "rss") : `${APP_URL}/api/performance/${p.id}`;
    const descParts: string[] = [];
    const sameRoom = !!p.venue_room && p.venue_room.trim().toLowerCase() === p.theater.name.trim().toLowerCase();
    descParts.push(`${p.theater.name}${p.venue_room && !sameRoom ? `, ${p.venue_room}` : ""}`);
    if (p.show.subtitle) descParts.push(p.show.subtitle.replace(/\s*<br\s*\/?>\s*/gi, " · "));
    if (p.status === "sold_out") descParts.push("Ausverkauft");
    else if (p.status === "cancelled") descParts.push("Entfällt");
    else if (p.price_min != null) {
      descParts.push(
        p.price_max && p.price_max !== p.price_min ? `${p.price_min}–${p.price_max} €` : `${p.price_min} €`,
      );
    }
    return {
      title: p.show.title + (p.time ? ` — ${p.time} Uhr` : ""),
      link,
      guid: `perf-${p.id}@frankfurt.ins.theater`,
      pubDate: new Date(dateStr),
      category: p.theater.name,
      description: descParts.join(" — "),
    };
  });
  return buildRssFeed({
    title: "Frankfurt Theater",
    link: APP_URL,
    selfLink: `${APP_URL}/feed.xml`,
    description: "Spielplan der Frankfurter Bühnen — die nächsten 14 Tage",
    language: "de",
    items,
  });
}
