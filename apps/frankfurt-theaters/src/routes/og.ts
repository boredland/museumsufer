import { escapeHtml } from "@museumsufer/core";
import { Hono } from "hono";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";

const PAPER = "#F4EFE2";
const INK = "#0F0A05";
const BRICK = "#B5341F";

const app = new Hono<{ Bindings: Env }>();

/**
 * Per-theater Open Graph card. Layout: 1200x630 paper canvas, brick rule
 * top + bottom, the theater name set in a generous serif as the focal
 * point, the "Frankfurt Theater" wordmark below, and the URL in a small
 * mono line at the bottom.
 *
 * Served as SVG with `font-family: Fraunces, Georgia, serif` — social
 * crawlers (Twitter, Slack, Facebook) lack Fraunces and fall back to
 * Georgia, which is still a credible serif. Brand recognition comes
 * from the palette + composition, not from one specific font.
 */
app.get("/theater/:slug/og.svg", (c) => {
  try {
    const slug = c.req.param("slug");
    if (!slug) return c.notFound();
    const config = THEATERS.find((t) => t.slug === slug);
    if (!config) return c.notFound();
    return c.body(buildSvg(config.name, config.address ?? null), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (err) {
    console.error("og route failed:", err instanceof Error ? err.stack : err);
    return c.text(`og route failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});

function buildSvg(theaterName: string, address: string | null): string {
  const W = 1200;
  const H = 630;

  // Pick a font-size that fits within the available width.
  // Each character roughly 0.55em wide; budget 1080px (90px gutters).
  const maxNameWidth = 1080;
  const ratio = 0.55;
  const idealSize = 144;
  const len = theaterName.length;
  const size = Math.min(idealSize, Math.floor(maxNameWidth / (len * ratio)));
  const nameFontSize = Math.max(56, size);

  const safeName = escapeHtml(theaterName);
  const safeCity = escapeHtml(address?.split(",").pop()?.trim() ?? "Frankfurt am Main");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${safeName}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${W}" height="14" fill="${BRICK}"/>
  <rect x="0" y="${H - 14}" width="${W}" height="14" fill="${BRICK}"/>

  <text x="${W / 2}" y="200" text-anchor="middle"
    font-family="'JetBrains Mono', ui-monospace, Menlo, monospace"
    font-size="22" letter-spacing="6" fill="${BRICK}">SPIELPLAN</text>

  <line x1="${W / 2 - 40}" y1="230" x2="${W / 2 + 40}" y2="230" stroke="${BRICK}" stroke-width="2"/>

  <text x="${W / 2}" y="${330 + nameFontSize / 4}" text-anchor="middle"
    font-family="Fraunces, 'Hoefler Text', 'Times New Roman', Georgia, serif"
    font-size="${nameFontSize}" font-weight="700" fill="${INK}"
    letter-spacing="-2">${safeName}</text>

  <text x="${W / 2}" y="460" text-anchor="middle"
    font-family="Fraunces, Georgia, serif"
    font-size="28" font-style="italic" fill="${INK}" opacity="0.62">${safeCity}</text>

  <text x="${W / 2}" y="540" text-anchor="middle"
    font-family="Fraunces, 'Hoefler Text', Georgia, serif"
    font-size="36" font-weight="600" fill="${INK}" letter-spacing="-1">Frankfurt Theater.</text>

  <text x="${W / 2}" y="588" text-anchor="middle"
    font-family="'JetBrains Mono', ui-monospace, Menlo, monospace"
    font-size="20" letter-spacing="4" fill="${BRICK}">frankfurt.ins.theater</text>
</svg>
`;
}

export default app;
