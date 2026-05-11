import { buildUtm } from "@museumsufer/core";
import type { VenueConfig } from "./concert-config";
import type { DayEvent } from "./db";

const utm = buildUtm("frankfurt.konzert.haus");

export function renderDayMarkdown(date: string, events: DayEvent[]): string {
  const niceDate = new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const lines = [`# konzert.haus — ${niceDate}`, ""];
  if (!events.length) {
    lines.push("_Heute keine Konzerte gemeldet._");
    return lines.join("\n");
  }
  lines.push(`${events.length} Konzert${events.length === 1 ? "" : "e"}.`);
  lines.push("");
  for (const e of events) lines.push(eventBullet(e, { showVenue: true }));
  lines.push("");
  lines.push("---");
  lines.push(`Daten unter https://frankfurt.konzert.haus/api/events?date=${date}`);
  return lines.join("\n");
}

export function renderVenueMarkdown(venue: VenueConfig, events: DayEvent[]): string {
  const lines = [`# ${venue.name}`, ""];
  if (venue.address) lines.push(`_${venue.address}_`);
  if (venue.website_url) lines.push(`Website: ${utm(venue.website_url, "markdown")}`);
  lines.push("");
  if (!events.length) {
    lines.push("_Noch kein angekündigtes Programm._");
    return lines.join("\n");
  }
  const byDate = new Map<string, DayEvent[]>();
  for (const e of events) {
    const arr = byDate.get(e.date);
    if (arr) arr.push(e);
    else byDate.set(e.date, [e]);
  }
  for (const [date, dayEvents] of byDate) {
    const heading = new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    lines.push(`## ${heading}`);
    lines.push("");
    for (const e of dayEvents) lines.push(eventBullet(e, { showVenue: false }));
    lines.push("");
  }
  lines.push("---");
  lines.push(`Daten unter https://frankfurt.konzert.haus/api/events?venue=${venue.slug}`);
  return lines.join("\n");
}

function eventBullet(e: DayEvent, opts: { showVenue: boolean }): string {
  const time = e.time ?? "—";
  const subtitle = e.subtitle ? ` — ${e.subtitle}` : "";
  const price =
    e.price_min == null
      ? ""
      : e.price_max && e.price_max !== e.price_min
        ? ` · ${e.price_min}–${e.price_max} €`
        : ` · ${e.price_min} €`;
  const room = e.venue_room ? `, ${e.venue_room}` : "";
  const venue = opts.showVenue ? ` _(${e.venue.name}${room})_` : room ? ` _(${e.venue_room})_` : "";
  const urlSource = e.ticket_url ?? e.detail_url ?? "";
  const url = urlSource ? utm(urlSource, "markdown") : "";
  const title = url ? `[${e.title}](${url})` : e.title;
  return `- **${time}** ${title}${subtitle}${venue}${price}`;
}

export function wantsMarkdown(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/markdown") || accept.includes("text/x-markdown");
}
