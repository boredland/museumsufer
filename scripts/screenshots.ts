import { chromium } from "playwright";

const FORMATS = {
  landscape: { width: 1280, height: 720, isMobile: false },
  portrait: { width: 390, height: 844, isMobile: true },
} as const;

type Format = keyof typeof FORMATS;

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? "true";
  }
  return args;
}

function usage(): never {
  console.error(`usage: tsx scripts/screenshots.ts --format=<landscape|portrait> --out=<path> [--url=<url>] [--width=<n>] [--height=<n>] [--theme=<light|dark>] [--locale=<lc>]

defaults:
  url    http://localhost:8790
  theme  light
  locale de-DE
formats:
  landscape  1280x720 (desktop)
  portrait   390x844  (mobile)
`);
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const format = args.format as Format | undefined;
  const out = args.out;
  if (!out || (format && !(format in FORMATS))) usage();
  if (!format && !(args.width && args.height)) usage();

  const preset = format ? FORMATS[format] : { isMobile: false, width: 0, height: 0 };
  const width = args.width ? Number(args.width) : preset.width;
  const height = args.height ? Number(args.height) : preset.height;
  const url = args.url ?? "http://localhost:8790";
  const theme = (args.theme as "light" | "dark") ?? "light";
  const locale = args.locale ?? "de-DE";

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: preset.isMobile,
      colorScheme: theme,
      locale,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(".section", { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`wrote ${out} ${width}x${height} (${theme}, ${locale})`);
  } finally {
    await browser.close();
  }
}

main();
