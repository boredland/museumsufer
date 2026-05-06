import type { Performance, Show, Theater } from "./types";

type DayPerformance = Performance & {
  show: Show;
  theater: Pick<Theater, "id" | "name" | "slug" | "website_url">;
};

interface PageProps {
  date: string;
  performances: DayPerformance[];
  prevDate: string;
  nextDate: string;
}

export function renderPage(props: PageProps): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Frankfurt Theater — ${props.date}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 880px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    header { display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    nav { display: flex; gap: .75rem; }
    nav a { text-decoration: none; padding: .25rem .5rem; border: 1px solid #ccc; border-radius: 4px; color: inherit; }
    .perf { display: grid; grid-template-columns: 80px 1fr auto; gap: 1rem; padding: .75rem 0; border-top: 1px solid #eee; align-items: baseline; }
    .perf:last-child { border-bottom: 1px solid #eee; }
    .time { font-variant-numeric: tabular-nums; font-weight: 600; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .meta { color: #666; font-size: .9rem; }
    .badge { font-size: .8rem; padding: .1rem .4rem; border-radius: 4px; }
    .badge--available { background: #d6f5dc; color: #1c6f2c; }
    .badge--sold_out { background: #f9d6d6; color: #8a1c1c; }
    .badge--unknown { background: #eee; color: #555; }
    .badge--cancelled { background: #fce5b6; color: #8a5a1c; }
    .empty { color: #888; padding: 2rem 0; }
  </style>
</head>
<body>
  <header>
    <h1>Frankfurt Theater</h1>
    <nav>
      <a href="/?date=${props.prevDate}">◀ ${props.prevDate}</a>
      <strong>${props.date}</strong>
      <a href="/?date=${props.nextDate}">${props.nextDate} ▶</a>
    </nav>
  </header>
  ${
    props.performances.length === 0
      ? '<p class="empty">Keine Aufführungen für dieses Datum.</p>'
      : props.performances.map(renderPerformance).join("\n")
  }
</body>
</html>`;
}

function renderPerformance(p: DayPerformance): string {
  const time = p.time ?? "—";
  const endTime = p.end_time ? `–${p.end_time}` : "";
  const room = p.venue_room ? ` · ${escapeHtml(p.venue_room)}` : "";
  const ticket = p.ticket_url ? `<a href="${escapeHtml(p.ticket_url)}" target="_blank" rel="noopener">Tickets</a>` : "";
  const subtitle = p.show.subtitle ? `<div class="meta">${escapeHtml(p.show.subtitle)}</div>` : "";

  return `<article class="perf">
    <div class="time">${time}${endTime}</div>
    <div>
      <div class="title">${escapeHtml(p.show.title)}</div>
      <div class="meta">${escapeHtml(p.theater.name)}${room}</div>
      ${subtitle}
    </div>
    <div>
      <span class="badge badge--${p.status}">${badgeLabel(p.status)}</span><br/>
      ${ticket}
    </div>
  </article>`;
}

function badgeLabel(status: string): string {
  switch (status) {
    case "available":
      return "verfügbar";
    case "sold_out":
      return "ausverkauft";
    case "few_left":
      return "wenige Plätze";
    case "cancelled":
      return "abgesagt";
    default:
      return "—";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
