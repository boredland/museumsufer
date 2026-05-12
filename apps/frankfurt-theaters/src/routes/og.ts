import { buildOgSvg, fitOgTitleSize } from "@museumsufer/core";
import { Hono } from "hono";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";

const PALETTE = { paper: "#F4EFE2", ink: "#0F0A05", accent: "#B5341F" };
const FONTS = {
  display: "Fraunces, 'Hoefler Text', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
};

const app = new Hono<{ Bindings: Env }>();

/**
 * Per-theater Open Graph card. Brick rules top + bottom, theater name
 * as the headline, "Frankfurt Theater." wordmark + URL line at the foot.
 */
app.get("/theater/:slug/og.svg", (c) => {
  const slug = c.req.param("slug");
  if (!slug) return c.notFound();
  const config = THEATERS.find((t) => t.slug === slug);
  if (!config) return c.notFound();
  return c.body(buildSvg(config.name, config.address ?? null), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
});

function buildSvg(theaterName: string, address: string | null): string {
  const nameFontSize = fitOgTitleSize(theaterName, { ratio: 0.55, minSize: 56, maxSize: 144 });
  const city = address?.split(",").pop()?.trim() ?? "Frankfurt am Main";
  return buildOgSvg({
    palette: PALETTE,
    fonts: FONTS,
    ariaLabel: theaterName,
    rules: { thickness: 14, positions: ["top", "bottom"] },
    decoration: `<line x1="560" y1="230" x2="640" y2="230" stroke="${PALETTE.accent}" stroke-width="2"/>`,
    rows: [
      { text: "SPIELPLAN", y: 200, font: "mono", size: 22, letterSpacing: 6, color: PALETTE.accent },
      { text: theaterName, y: 330 + nameFontSize / 4, font: "display", size: nameFontSize, weight: 700, tracking: -2 },
      { text: city, y: 460, font: "display", size: 28, italic: true, opacity: 0.62 },
      { text: "Frankfurt Theater.", y: 540, font: "display", size: 36, weight: 600, tracking: -1 },
      { text: "frankfurt.ins.theater", y: 588, font: "mono", size: 20, letterSpacing: 4, color: PALETTE.accent },
    ],
  });
}

export default app;
