import { escapeHtml } from "@museumsufer/core";
import { Hono } from "hono";
import { CATEGORY_BY_SLUG } from "../categories";
import { getEventById } from "../queries";
import type { Env } from "../types";

const PAPER = "#F2EAD3";
const INK = "#1B1715";
const ROTWEIN = "#5C1F2E";

const app = new Hono<{ Bindings: Env }>();

app.get("/og/:id{[0-9]+}/image.svg", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const ev = getEventById(id);
  if (!ev) return c.notFound();
  const category = CATEGORY_BY_SLUG.get(ev.category);
  const glyph = category?.glyph ?? "❡";
  const label = category?.label ?? "Veranstaltung";
  return c.body(buildSvg(ev.title, ev.venue ?? ev.city ?? "Landau", ev.date, ev.time ?? null, glyph, label), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
});

function buildSvg(
  title: string,
  venue: string,
  date: string,
  time: string | null,
  glyph: string,
  label: string,
): string {
  const W = 1200;
  const H = 630;
  const len = Math.max(title.length, 1);
  const titleSize = Math.max(48, Math.min(96, Math.floor(1080 / (len * 0.55))));
  const safeTitle = escapeHtml(title);
  const safeVenue = escapeHtml(venue);
  const safeGlyph = escapeHtml(glyph);
  const safeLabel = escapeHtml(label.toUpperCase());
  const dateLabel = formatDate(date, time);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${safeTitle}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${ROTWEIN}"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${ROTWEIN}"/>

  <text x="${W / 2}" y="120" text-anchor="middle" font-family="'Newsreader', Georgia, serif" font-size="28" font-style="italic" fill="${INK}" opacity="0.65">Landau&amp;heute</text>

  <text x="${W / 2}" y="200" text-anchor="middle" font-family="'Bodoni Moda', Georgia, serif" font-size="56" fill="${ROTWEIN}">${safeGlyph}</text>

  <text x="${W / 2}" y="240" text-anchor="middle" font-family="'Newsreader', ui-monospace, Menlo, monospace" font-size="18" letter-spacing="6" fill="${ROTWEIN}">${safeLabel}</text>

  <text x="${W / 2}" y="${340 + titleSize / 4}" text-anchor="middle" font-family="'Bodoni Moda', Georgia, serif" font-size="${titleSize}" font-weight="500" fill="${INK}" letter-spacing="-1">${safeTitle}</text>

  <text x="${W / 2}" y="490" text-anchor="middle" font-family="'Newsreader', Georgia, serif" font-size="30" font-style="italic" fill="${INK}" opacity="0.62">${safeVenue}</text>

  <text x="${W / 2}" y="560" text-anchor="middle" font-family="'Newsreader', ui-monospace, Menlo, monospace" font-size="22" letter-spacing="4" fill="${ROTWEIN}">${escapeHtml(dateLabel)}</text>
</svg>
`;
}

function formatDate(date: string, time: string | null): string {
  const d = new Date(`${date}T12:00:00Z`);
  const label = d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return time ? `${label} · ${time}` : label;
}

export default app;
