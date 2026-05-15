import { buildOgSvg, fitOgTitleSize } from "@museumsufer/core";
import { Hono } from "hono";
import { getEventById } from "../db";
import type { Env } from "../types";

const PALETTE = { paper: "#F2E9D5", ink: "#1C1812", accent: "#A33222" };
const FONTS = {
  display: "'Cormorant Garamond', Georgia, serif",
  mono: "'DM Mono', ui-monospace, Menlo, monospace",
};

const app = new Hono<{ Bindings: Env }>();

app.get("/og/:id{[0-9]+}/image.svg", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const event = getEventById(id);
  if (!event) return c.notFound();
  return c.body(buildSvg(event.title, event.source.name, event.date, event.time ?? null), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
});

function buildSvg(title: string, sourceName: string, date: string, time: string | null): string {
  const titleSize = fitOgTitleSize(title);
  return buildOgSvg({
    palette: PALETTE,
    fonts: FONTS,
    ariaLabel: title,
    rows: [
      { text: "¶ LEHRHAUS", y: 160, font: "mono", size: 20, letterSpacing: 6, color: PALETTE.accent },
      { text: title, y: 300 + titleSize / 4, font: "display", size: titleSize, weight: 500, tracking: -1 },
      { text: sourceName, y: 450, font: "display", size: 30, italic: true, opacity: 0.62 },
      {
        text: formatDate(date, time),
        y: 540,
        font: "mono",
        size: 22,
        letterSpacing: 4,
        color: PALETTE.accent,
      },
    ],
  });
}

function formatDate(date: string, time: string | null): string {
  const d = new Date(`${date}T12:00:00Z`);
  const label = d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return time ? `${label} · ${time}` : label;
}

export default app;
