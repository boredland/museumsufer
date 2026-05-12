/**
 * Manifest-screenshot capture for PWA install prompts. Boots a real
 * Chromium via Playwright, loads `baseUrl` in both portrait (390×844)
 * and landscape (1280×720), and writes `ss-mobile.png` + `ss-wide.png`
 * into `outDir`. Web fonts are awaited so the wordmark doesn't FOUC.
 *
 * Designed to run from a build script after `wrangler dev` is already
 * listening — this module does NOT boot the dev server itself.
 */
import { mkdir } from "node:fs/promises";
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
      });
      const page = await ctx.newPage();
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      if (readySelector) await page.waitForSelector(readySelector, { timeout: readyTimeoutMs });
      await page.evaluate(() => document.fonts.ready);
      if (postReadyDelayMs > 0) await page.waitForTimeout(postReadyDelayMs);

      const path = join(outDir, preset.filename);
      await page.screenshot({ path, fullPage: false });
      written.push(path);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  return written;
}
