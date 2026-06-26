/**
 * Regenerate PWA icon PNGs (icon-512.png, icon-192.png, icon-512-maskable.png,
 * icon-192-maskable.png) from each app's favicon.svg.
 *
 * The favicon.svg is the source of truth for the icon design; the PNGs are
 * the baked artifacts for PWA manifests and older crawlers.
 *
 *   bun scripts/regen-icons.ts                 # all apps
 *   bun scripts/regen-icons.ts lichtspiel-haus # one app
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

const ICON_SIZES = [
  { size: 512, filename: "icon-512.png" },
  { size: 192, filename: "icon-192.png" },
] as const;

const MASKABLE_SIZES = [
  { size: 512, filename: "icon-512-maskable.png" },
  { size: 192, filename: "icon-192-maskable.png" },
] as const;

async function main(): Promise<void> {
  const wanted = process.argv.slice(2);
  const targets = wanted.length ? APPS.filter((a) => wanted.includes(a.slug)) : APPS;
  if (wanted.length && targets.length !== wanted.length) {
    const missing = wanted.filter((w) => !APPS.some((a) => a.slug === w));
    throw new Error(`unknown app(s): ${missing.join(", ")}. valid: ${APPS.map((a) => a.slug).join(", ")}`);
  }

  for (const app of targets) {
    const faviconPath = join(REPO_ROOT, app.dir, "public/favicon.svg");
    if (!existsSync(faviconPath)) {
      console.log(`→ ${app.slug}: no favicon.svg, skipping`);
      continue;
    }

    const outDir = join(REPO_ROOT, app.dir, "public");
    console.log(`→ ${app.slug}`);

    // Standard icons: rasterize favicon.svg at each size
    for (const { size, filename } of ICON_SIZES) {
      const pngPath = join(outDir, filename);
      await rasterizeSvgToPng({
        svgPath: faviconPath,
        pngPath,
        width: size,
        height: size,
      });
      console.log(`  wrote ${filename}`);
    }

    // Maskable icons: same favicon.svg, safe zone is handled by the
    // rounded-rect background in the SVG itself (all apps use full-bleed
    // backgrounds with rx so no extra padding is needed).
    for (const { size, filename } of MASKABLE_SIZES) {
      const pngPath = join(outDir, filename);
      await rasterizeSvgToPng({
        svgPath: faviconPath,
        pngPath,
        width: size,
        height: size,
      });
      console.log(`  wrote ${filename}`);
    }
  }
  console.log(`\n✓ done — ${targets.length} app${targets.length === 1 ? "" : "s"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
