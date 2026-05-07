import type { DayPerformance } from "./db";
import type { TheaterConfig } from "./theater-config";

/** Human + LLM-friendly markdown view of a day or theater page. */

export function renderDayMarkdown(date: string, performances: DayPerformance[]): string {
  const niceDate = new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const lines = [`# Frankfurt Theater — ${niceDate}`, ""];
  if (!performances.length) {
    lines.push("_Heute kein Programm._");
    return lines.join("\n");
  }
  lines.push(`${performances.length} Vorstellung${performances.length === 1 ? "" : "en"}.`);
  lines.push("");
  for (const p of performances) {
    lines.push(perfBullet(p, { showTheater: true }));
  }
  lines.push("");
  lines.push("---");
  lines.push(`Daten unter https://frankfurt.ins.theater/api/day?date=${date}`);
  return lines.join("\n");
}

export function renderTheaterMarkdown(config: TheaterConfig, performances: DayPerformance[]): string {
  const lines = [`# ${config.name}`, ""];
  if (config.address) lines.push(`_${config.address}_`);
  if (config.website_url) lines.push(`Website: ${config.website_url}`);
  lines.push("");
  if (!performances.length) {
    lines.push("_Noch kein angekündigtes Programm._");
    return lines.join("\n");
  }

  const byDate = new Map<string, DayPerformance[]>();
  for (const p of performances) {
    const arr = byDate.get(p.date);
    if (arr) arr.push(p);
    else byDate.set(p.date, [p]);
  }
  for (const [date, perfs] of byDate) {
    const heading = new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    lines.push(`## ${heading}`);
    lines.push("");
    for (const p of perfs) lines.push(perfBullet(p, { showTheater: false }));
    lines.push("");
  }
  lines.push("---");
  lines.push(`Daten unter https://frankfurt.ins.theater/api/theater/${config.slug}`);
  return lines.join("\n");
}

function perfBullet(p: DayPerformance, opts: { showTheater: boolean }): string {
  const time = p.time ?? "—";
  const status = p.status === "sold_out" ? " **(Ausverkauft)**" : p.status === "cancelled" ? " **(Entfällt)**" : "";
  const subtitle = p.show.subtitle ? ` — ${p.show.subtitle.replace(/<br\s*\/?>/gi, " · ")}` : "";
  const price =
    p.status === "sold_out" || p.status === "cancelled" || p.price_min == null
      ? ""
      : p.price_max && p.price_max !== p.price_min
        ? ` · ${p.price_min}–${p.price_max} €`
        : ` · ${p.price_min} €`;
  const venue = opts.showTheater
    ? ` _(${p.theater.name}${p.venue_room ? `, ${p.venue_room}` : ""})_`
    : p.venue_room
      ? ` _(${p.venue_room})_`
      : "";
  const url = p.ticket_url ?? p.show.detail_url ?? "";
  const title = url ? `[${p.show.title}](${url})` : p.show.title;
  return `- **${time}** ${title}${subtitle}${venue}${price}${status}`;
}

export function wantsMarkdown(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/markdown") || accept.includes("text/x-markdown");
}
