import { buildOgSvg, fitOgTitleSize } from "@museumsufer/core";
import { Hono } from "hono";
import { CATEGORY_BY_SLUG } from "../categories";
import { getEventById } from "../queries";
import type { Env } from "../types";

const PALETTE = { paper: "#F2EAD3", ink: "#1B1715", accent: "#5C1F2E" };
const FONTS = {
  display: "'Bodoni Moda', Georgia, serif",
  mono: "'Newsreader', ui-monospace, Menlo, monospace",
};

const app = new Hono<{ Bindings: Env }>();

app.get("/og/:id{[0-9]+}/image.svg", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const ev = getEventById(id);
  if (!ev) return c.notFound();
  const category = CATEGORY_BY_SLUG.get(ev.category);
  return c.body(
    buildSvg(
      ev.title,
      ev.venue ?? ev.city ?? "Landau",
      ev.date,
      ev.time ?? null,
      category?.glyph ?? "❡",
      category?.label ?? "Veranstaltung",
    ),
    { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
});

function buildSvg(
  title: string,
  venue: string,
  date: string,
  time: string | null,
  glyph: string,
  label: string,
): string {
  const titleSize = fitOgTitleSize(title);
  return buildOgSvg({
    palette: PALETTE,
    fonts: FONTS,
    ariaLabel: title,
    rows: [
      { text: "Landau & heute", y: 120, font: "display", size: 28, italic: true, opacity: 0.65 },
      { text: glyph, y: 200, font: "display", size: 56, color: PALETTE.accent },
      { text: label.toUpperCase(), y: 240, font: "mono", size: 18, letterSpacing: 6, color: PALETTE.accent },
      { text: title, y: 340 + titleSize / 4, font: "display", size: titleSize, weight: 500, tracking: -1 },
      { text: venue, y: 490, font: "display", size: 30, italic: true, opacity: 0.62 },
      { text: formatDate(date, time), y: 560, font: "mono", size: 22, letterSpacing: 4, color: PALETTE.accent },
    ],
  });
}

function formatDate(date: string, time: string | null): string {
  const d = new Date(`${date}T12:00:00Z`);
  const label = d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return time ? `${label} · ${time}` : label;
}

export default app;
