import { escapeHtml } from "@museumsufer/core";
import { Hono } from "hono";
import { getEventById } from "../db";
import type { Env } from "../types";

const PAPER = "#F7F0E7";
const INK = "#1A1210";
const BRASS = "#9E7A38";

const app = new Hono<{ Bindings: Env }>();

app.get("/og/:id{[0-9]+}/image.svg", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const event = getEventById(id);
  if (!event) return c.notFound();
  return c.body(buildSvg(event.title, event.venue.name, event.date, event.time ?? null), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
});

function buildSvg(title: string, venueName: string, date: string, time: string | null): string {
  const W = 1200;
  const H = 630;
  const idealSize = 96;
  const len = Math.max(title.length, 1);
  const size = Math.min(idealSize, Math.floor(1080 / (len * 0.55)));
  const titleSize = Math.max(48, size);
  const safeTitle = escapeHtml(title);
  const safeVenue = escapeHtml(venueName);
  const dateLabel = formatDate(date, time);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${safeTitle}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${BRASS}"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${BRASS}"/>

  <text x="${W / 2}" y="160" text-anchor="middle" font-family="'DM Mono', ui-monospace, Menlo, monospace" font-size="20" letter-spacing="6" fill="${BRASS}">KONZERT.HAUS</text>

  <text x="${W / 2}" y="${300 + titleSize / 4}" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="${titleSize}" font-weight="500" fill="${INK}" letter-spacing="-1">${safeTitle}</text>

  <text x="${W / 2}" y="450" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="30" font-style="italic" fill="${INK}" opacity="0.62">${safeVenue}</text>

  <text x="${W / 2}" y="540" text-anchor="middle" font-family="'DM Mono', ui-monospace, Menlo, monospace" font-size="22" letter-spacing="4" fill="${BRASS}">${escapeHtml(dateLabel)}</text>
</svg>
`;
}

function formatDate(date: string, time: string | null): string {
  const d = new Date(`${date}T12:00:00Z`);
  const label = d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return time ? `${label} · ${time}` : label;
}

export default app;
