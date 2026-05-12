/**
 * SVG Open Graph card builder shared by every app's `/og/...` route.
 *
 * Each app supplies its own palette, fonts, and text rows; this module
 * owns the canvas envelope, escaping, the fit-title-to-width math, and
 * the optional top/bottom accent rules.
 *
 * Output is an SVG string set at the standard 1200×630 OG size by
 * default. Social crawlers (Twitter, Slack, Facebook) render it as an
 * image preview; system fonts fall back when the per-app display face
 * isn't installed.
 */
import { escapeHtml } from "./escape";

export interface OgPalette {
  paper: string;
  ink: string;
  accent: string;
}

export interface OgFonts {
  /** Stack for headlines + brand wordmarks. */
  display: string;
  /** Monospace stack for kicker + footer URL lines. */
  mono: string;
}

export interface OgTextRow {
  text: string;
  /** y baseline in SVG units (0–height). */
  y: number;
  font: "display" | "mono";
  size: number;
  weight?: number;
  italic?: boolean;
  opacity?: number;
  /** Letter-spacing in SVG units. */
  letterSpacing?: number;
  /** Override `palette.ink` for this row. */
  color?: string;
  /** Negative letter-spacing for tight display headlines. */
  tracking?: number;
}

export interface OgCardOptions {
  width?: number;
  height?: number;
  palette: OgPalette;
  fonts: OgFonts;
  rows: OgTextRow[];
  /** Accent rule(s) painted in `palette.accent`. Default: top + bottom 6px. */
  rules?: { thickness?: number; positions?: ("top" | "bottom")[] };
  /** Custom SVG fragments inserted between the paper rect and the rules. */
  decoration?: string;
  /** Used as the SVG's `aria-label`. */
  ariaLabel?: string;
}

/**
 * Pick a font-size that fits `title` within `maxWidth` SVG units, given
 * an average character-width ratio (em-relative). Clamps between
 * `minSize` and `maxSize`. Default tuning matches the constants used by
 * konzert-haus / landau / museums today.
 */
export function fitOgTitleSize(
  title: string,
  options: { maxWidth?: number; ratio?: number; minSize?: number; maxSize?: number } = {},
): number {
  const { maxWidth = 1080, ratio = 0.55, minSize = 48, maxSize = 96 } = options;
  const len = Math.max(title.length, 1);
  return Math.max(minSize, Math.min(maxSize, Math.floor(maxWidth / (len * ratio))));
}

export function buildOgSvg(opts: OgCardOptions): string {
  const {
    width = 1200,
    height = 630,
    palette,
    fonts,
    rows,
    rules = { thickness: 6, positions: ["top", "bottom"] },
    decoration = "",
    ariaLabel,
  } = opts;

  const ruleThickness = rules.thickness ?? 6;
  const positions = rules.positions ?? ["top", "bottom"];
  const ruleSvg = positions
    .map((pos) =>
      pos === "top"
        ? `<rect x="0" y="0" width="${width}" height="${ruleThickness}" fill="${palette.accent}"/>`
        : `<rect x="0" y="${height - ruleThickness}" width="${width}" height="${ruleThickness}" fill="${palette.accent}"/>`,
    )
    .join("\n  ");

  const aria = ariaLabel ?? rows.find((r) => r.font === "display")?.text ?? "Open Graph card";

  const rowsSvg = rows
    .map((r) => {
      const family = r.font === "mono" ? fonts.mono : fonts.display;
      const attrs = [
        `x="${width / 2}"`,
        `y="${r.y}"`,
        `text-anchor="middle"`,
        `font-family=${JSON.stringify(family)}`,
        `font-size="${r.size}"`,
      ];
      if (r.weight) attrs.push(`font-weight="${r.weight}"`);
      if (r.italic) attrs.push(`font-style="italic"`);
      if (r.opacity != null) attrs.push(`opacity="${r.opacity}"`);
      if (r.letterSpacing != null) attrs.push(`letter-spacing="${r.letterSpacing}"`);
      else if (r.tracking != null) attrs.push(`letter-spacing="${r.tracking}"`);
      attrs.push(`fill="${r.color ?? palette.ink}"`);
      return `<text ${attrs.join(" ")}>${escapeHtml(r.text)}</text>`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(aria)}">
  <rect width="${width}" height="${height}" fill="${palette.paper}"/>
  ${ruleSvg}
  ${decoration}
  ${rowsSvg}
</svg>
`;
}
