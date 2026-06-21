/**
 * Manifest-screenshot capture for PWA install prompts. Boots a real
 * Chromium via Playwright, loads `baseUrl` in both portrait (390×844)
 * and landscape (1280×720), and writes `ss-mobile.png` + `ss-wide.png`
 * into `outDir`. Web fonts are awaited so the wordmark doesn't FOUC.
 *
 * Designed to run from a build script after `wrangler dev` is already
 * listening — this module does NOT boot the dev server itself.
 */
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

export const SCREENSHOT_FORMATS = {
  landscape: { width: 1280, height: 720, isMobile: false, filename: "ss-wide.png" },
  portrait: { width: 390, height: 844, isMobile: true, filename: "ss-mobile.png" },
} as const;

export type ScreenshotFormat = keyof typeof SCREENSHOT_FORMATS;

export interface CaptureOpts {
  baseUrl: string;
  outDir: string;
  readySelector?: string;
  locale?: string;
  theme?: "light" | "dark";
  readyTimeoutMs?: number;
  postReadyDelayMs?: number;
  formats?: readonly ScreenshotFormat[];
  /** Inserted before `.png` in each output filename, e.g. "-hamburg"
   *  yields `ss-wide-hamburg.png`. Defaults to "" (the canonical paths). */
  filenameSuffix?: string;
  /** Override the `Host` header. Lets one local `wrangler dev` serve a
   *  non-default city's content via the host→city middleware (prod mode
   *  just points `baseUrl` at the city's real subdomain instead). */
  hostHeader?: string;
}

export async function captureManifestScreenshots(opts: CaptureOpts): Promise<string[]> {
  const {
    baseUrl,
    outDir,
    readySelector,
    locale = "de-DE",
    theme = "light",
    readyTimeoutMs = 10_000,
    postReadyDelayMs = 400,
    formats = ["landscape", "portrait"] as const,
    filenameSuffix = "",
    hostHeader,
  } = opts;

  await mkdir(outDir, { recursive: true });
  const written: string[] = [];

  const browser = await chromium.launch();
  try {
    for (const format of formats) {
      const preset = SCREENSHOT_FORMATS[format];
      const ctx = await browser.newContext({
        viewport: { width: preset.width, height: preset.height },
        isMobile: preset.isMobile,
        colorScheme: theme,
        locale,
        ...(hostHeader && { extraHTTPHeaders: { Host: hostHeader } }),
      });
      const page = await ctx.newPage();
      // `networkidle` deadlocks on pages with continuous lazy-image
      // loading (lichtspiel-haus screening cards trickle in posters as
      // you scroll), so wait for DOM + the app's own readiness selector
      // instead — that's what actually tells us the page is paintable.
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: readyTimeoutMs });
      if (readySelector) await page.waitForSelector(readySelector, { timeout: readyTimeoutMs });
      await page.evaluate(() => document.fonts.ready);
      if (postReadyDelayMs > 0) await page.waitForTimeout(postReadyDelayMs);

      const path = join(outDir, preset.filename.replace(/\.png$/, `${filenameSuffix}.png`));
      await page.screenshot({ path, fullPage: false });
      written.push(path);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  return written;
}

export interface RasterizeOpts {
  /** Absolute path to the SVG file on disk. */
  svgPath: string;
  /** Absolute path to write the PNG output. */
  pngPath: string;
  /** Pixel dimensions of the output raster. Defaults to 1200×630
   *  (the canonical Open Graph card size). */
  width?: number;
  height?: number;
}

/**
 * Rasterise an SVG file to a PNG at a fixed viewport size by loading
 * it in headless Chromium. Used by `scripts/regen-og-images.ts` to
 * keep `og-image.png` in sync with the hand-authored `og-image.svg`
 * source of truth.
 */
export async function rasterizeSvgToPng(opts: RasterizeOpts): Promise<string> {
  const { svgPath, pngPath, width = 1200, height = 630 } = opts;
  // Inline the SVG body into the HTML. Loading it via <img src="file://…">
  // is blocked by Chromium when the host document has an opaque origin
  // (setContent's about:blank), which silently rendered the broken-image
  // glyph instead of the artwork.
  const svgSource = await readFile(svgPath, "utf8");
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:transparent;}
      svg{display:block;width:${width}px;height:${height}px;}
    </style></head><body>${svgSource}</body></html>`;
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: pngPath, type: "png", fullPage: false });
    await ctx.close();
  } finally {
    await browser.close();
  }
  return pngPath;
}
