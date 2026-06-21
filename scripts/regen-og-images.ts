/**
 * Rasterise each app's `public/og-image.svg` into a matching
 * `og-image.png` at the canonical 1200×630 OG card size.
 *
 * Twitter and a few older crawlers still prefer raster; the SVG is
 * the source of truth and the PNG is the baked artifact. Keeping the
 * rasteriser in-repo means whoever edits the SVG can refresh both
 * with a single bun command.
 *
 *   bun scripts/regen-og-images.ts                 # all apps
 *   bun scripts/regen-og-images.ts lichtspiel-haus # one app
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rasterizeSvgToPng } from "../packages/core/src/screenshots";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface AppTarget {
  slug: string;
  dir: string;
}

const APPS: readonly AppTarget[] = [
  { slug: "museumsufer", dir: "apps/museumsufer" },
  { slug: "ins-theater", dir: "apps/ins-theater" },
  { slug: "konzert-haus", dir: "apps/konzert-haus" },
  { slug: "lehrhaus", dir: "apps/lehrhaus" },
  { slug: "lichtspiel-haus", dir: "apps/lichtspiel-haus" },
];

async function main(): Promise<void> {
  const wanted = process.argv.slice(2);
  const targets = wanted.length ? APPS.filter((a) => wanted.includes(a.slug)) : APPS;
  if (wanted.length && targets.length !== wanted.length) {
    const missing = wanted.filter((w) => !APPS.some((a) => a.slug === w));
    throw new Error(`unknown app(s): ${missing.join(", ")}. valid: ${APPS.map((a) => a.slug).join(", ")}`);
  }

  for (const app of targets) {
    const svgPath = join(REPO_ROOT, app.dir, "public/og-image.svg");
    const pngPath = join(REPO_ROOT, app.dir, "public/og-image.png");
    if (!existsSync(svgPath)) {
      console.log(`→ ${app.slug}: no og-image.svg, skipping`);
      continue;
    }
    console.log(`→ ${app.slug}`);
    await rasterizeSvgToPng({ svgPath, pngPath });
    console.log(`  wrote ${pngPath}`);
  }
  console.log(`\n✓ done — ${targets.length} app${targets.length === 1 ? "" : "s"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
