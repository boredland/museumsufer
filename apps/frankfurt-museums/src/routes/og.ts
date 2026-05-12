import { escapeHtml } from "@museumsufer/core";
import { type Context, Hono } from "hono";
import { getEventById, getExhibitionById, getMuseumById } from "../queries";
import type { Env } from "../types";

const PAPER = "#EFE7D8";
const INK = "#1C1410";
const RIVER = "#1F3A52";
const ACCENT = "#B45309";

const SVG_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, max-age=86400, s-maxage=604800",
};

const app = new Hono<{ Bindings: Env }>();

app.get("/og/event/:id{[0-9]+}/image.svg", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const ev = await getEventById(id);
  if (!ev) return c.notFound();
  return svgResponse(c, buildSvg("EVENT", ev.title, ev.museum_name, formatDate(ev.date, ev.time ?? null)));
});

app.get("/og/exhibition/:id{[0-9]+}/image.svg", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const ex = await getExhibitionById(id);
  if (!ex) return c.notFound();
  return svgResponse(
    c,
    buildSvg("AUSSTELLUNG", ex.title, ex.museum_name, ex.start_date ? formatRange(ex.start_date, ex.end_date) : ""),
  );
});

app.get("/og/museum/:id{[0-9]+}/image.svg", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const m = getMuseumById(id);
  if (!m) return c.notFound();
  return svgResponse(c, buildSvg("MUSEUM", m.name, "Frankfurt am Main", ""));
});

function svgResponse(c: Context<{ Bindings: Env }>, body: string) {
  return c.body(body, { headers: SVG_HEADERS });
}

function buildSvg(kicker: string, title: string, sub: string, date: string): string {
  const W = 1200;
  const H = 630;
  const len = Math.max(title.length, 1);
  const titleSize = Math.max(48, Math.min(96, Math.floor(1080 / (len * 0.55))));
  const safeTitle = escapeHtml(title);
  const safeSub = escapeHtml(sub);
  const safeKicker = escapeHtml(kicker);
  const safeDate = escapeHtml(date);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${safeTitle}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${RIVER}"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${ACCENT}"/>

  <text x="${W / 2}" y="130" text-anchor="middle" font-family="'Fraunces', Georgia, serif" font-size="28" font-style="italic" fill="${RIVER}">Museumsufer Frankfurt</text>

  <text x="${W / 2}" y="190" text-anchor="middle" font-family="'JetBrains Mono', ui-monospace, Menlo, monospace" font-size="18" letter-spacing="6" fill="${ACCENT}">${safeKicker}</text>

  <text x="${W / 2}" y="${320 + titleSize / 4}" text-anchor="middle" font-family="'Fraunces', Georgia, serif" font-size="${titleSize}" font-weight="500" fill="${INK}" letter-spacing="-1">${safeTitle}</text>

  <text x="${W / 2}" y="480" text-anchor="middle" font-family="'Fraunces', Georgia, serif" font-size="30" font-style="italic" fill="${INK}" opacity="0.62">${safeSub}</text>

  ${date ? `<text x="${W / 2}" y="555" text-anchor="middle" font-family="'JetBrains Mono', ui-monospace, Menlo, monospace" font-size="22" letter-spacing="4" fill="${ACCENT}">${safeDate}</text>` : ""}
</svg>
`;
}

function formatDate(date: string, time: string | null): string {
  const d = new Date(`${date}T12:00:00Z`);
  const label = d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return time ? `${label} · ${time}` : label;
}

function formatRange(start: string, end: string | null | undefined): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  return end ? `${fmt(start)} – ${fmt(end)}` : `ab ${fmt(start)}`;
}

export default app;
