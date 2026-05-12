import { buildOgSvg, fitOgTitleSize } from "@museumsufer/core";
import { type Context, Hono } from "hono";
import { getEventById, getExhibitionById, getMuseumById } from "../queries";
import type { Env } from "../types";

const PALETTE = { paper: "#EFE7D8", ink: "#1C1410", accent: "#1F3A52" };
const ACCENT_ALT = "#B45309";
const FONTS = {
  display: "'Fraunces', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
};

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
  return svg(c, "EVENT", ev.title, ev.museum_name, formatDate(ev.date, ev.time ?? null));
});

app.get("/og/exhibition/:id{[0-9]+}/image.svg", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const ex = await getExhibitionById(id);
  if (!ex) return c.notFound();
  return svg(c, "AUSSTELLUNG", ex.title, ex.museum_name, ex.start_date ? formatRange(ex.start_date, ex.end_date) : "");
});

app.get("/og/museum/:id{[0-9]+}/image.svg", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const m = getMuseumById(id);
  if (!m) return c.notFound();
  return svg(c, "MUSEUM", m.name, "Frankfurt am Main", "");
});

function svg(c: Context<{ Bindings: Env }>, kicker: string, title: string, sub: string | undefined, date: string) {
  return c.body(build(kicker, title, sub ?? "", date), { headers: SVG_HEADERS });
}

function build(kicker: string, title: string, sub: string, date: string): string {
  const titleSize = fitOgTitleSize(title);
  return buildOgSvg({
    palette: PALETTE,
    fonts: FONTS,
    ariaLabel: title,
    rules: { thickness: 6, positions: ["top"] },
    decoration: `<rect x="0" y="624" width="1200" height="6" fill="${ACCENT_ALT}"/>`,
    rows: [
      { text: "Museumsufer Frankfurt", y: 130, font: "display", size: 28, italic: true, color: PALETTE.accent },
      { text: kicker, y: 190, font: "mono", size: 18, letterSpacing: 6, color: ACCENT_ALT },
      { text: title, y: 320 + titleSize / 4, font: "display", size: titleSize, weight: 500, tracking: -1 },
      ...(sub ? [{ text: sub, y: 480, font: "display" as const, size: 30, italic: true, opacity: 0.62 }] : []),
      ...(date ? [{ text: date, y: 555, font: "mono" as const, size: 22, letterSpacing: 4, color: ACCENT_ALT }] : []),
    ],
  });
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
