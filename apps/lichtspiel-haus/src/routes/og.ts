import { buildOgSvg, cityMeta, dateLocale, detectLocale, fitOgTitleSize } from "@museumsufer/core";
import { Hono } from "hono";
import { getScreeningById } from "../db";
import { SUPPORTED_LOCALES } from "../i18n";
import type { Env } from "../types";

// Dark "auditorium" palette mirroring the site's dark mode — the OG image
// is read primarily in social timelines that match the user's OS theme.
const PALETTE = { paper: "#0E0B07", ink: "#F4EDDF", accent: "#C49A47" };
const FONTS = {
  display: "'Fraunces', 'EB Garamond', Georgia, serif",
  mono: "'DM Mono', ui-monospace, Menlo, monospace",
};

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.get("/og/:id{[0-9]+}/image.svg", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const screening = getScreeningById(id);
  if (!screening) return c.notFound();
  const city = c.get("city") ?? "frankfurt";
  // Crawlers fetch this URL without a ?lang, so the city's own language is
  // the default: a Valencia card must not carry a German date.
  const locale = detectLocale(c.req.raw, SUPPORTED_LOCALES, cityMeta(city).country === "ES" ? "es" : "de");
  return c.body(
    buildSvg(
      screening.title,
      screening.cinema.name,
      screening.date,
      screening.time ?? null,
      screening.version ?? null,
      city,
      dateLocale(locale),
    ),
    {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    },
  );
});

function buildSvg(
  title: string,
  venueName: string,
  date: string,
  time: string | null,
  version: string | null,
  city: string,
  dateTag: string,
): string {
  const titleSize = fitOgTitleSize(title);
  const dateRow = formatDate(date, time, dateTag);
  const versionRow = version ? `${dateRow}  ·  ${version}` : dateRow;
  return buildOgSvg({
    palette: PALETTE,
    fonts: FONTS,
    ariaLabel: title,
    rows: [
      {
        text: `${cityMeta(city).short.toUpperCase()} · LICHTSPIEL·HAUS`,
        y: 150,
        font: "mono",
        size: 20,
        letterSpacing: 8,
        color: PALETTE.accent,
      },
      { text: title, y: 310 + titleSize / 4, font: "display", size: titleSize, weight: 600, tracking: -1 },
      { text: venueName, y: 460, font: "display", size: 30, italic: true, opacity: 0.7 },
      {
        text: versionRow,
        y: 555,
        font: "mono",
        size: 22,
        letterSpacing: 4,
        color: PALETTE.accent,
      },
    ],
  });
}

function formatDate(date: string, time: string | null, dateTag: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const label = d.toLocaleDateString(dateTag, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return time ? `${label} · ${time}` : label;
}

export default app;
