import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8790";

const targets = [
  { out: "public/ss-wide.png", width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
  { out: "public/ss-mobile.png", width: 390, height: 844, deviceScaleFactor: 1, isMobile: true },
];

async function main() {
  const browser = await chromium.launch();
  try {
    for (const t of targets) {
      const ctx = await browser.newContext({
        viewport: { width: t.width, height: t.height },
        deviceScaleFactor: t.deviceScaleFactor,
        isMobile: t.isMobile,
        colorScheme: "light",
        locale: "de-DE",
      });
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.waitForSelector(".section", { timeout: 10000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.screenshot({ path: t.out, fullPage: false });
      console.log(`wrote ${t.out} ${t.width}x${t.height}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

main();
