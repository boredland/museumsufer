/**
 * Regenerate manifest screenshots (ss-wide.png + ss-mobile.png) for
 * every app in the monorepo.
 *
 * Two modes:
 *  - Default (local): boot each app's `wrangler dev` on a unique port,
 *    capture, tear down. Use this during front-end work before deploy.
 *  - `--prod`: skip wrangler entirely and screenshot the live custom
 *    domain. Use this from CI (.github/workflows/regen-assets.yml) so
 *    the committed PNGs always reflect what visitors actually see.
 *
 *   bun scripts/regen-screenshots.ts                       # all, local
 *   bun scripts/regen-screenshots.ts --prod                # all, prod
 *   bun scripts/regen-screenshots.ts lichtspiel-haus       # one, local
 *   bun scripts/regen-screenshots.ts --prod lichtspiel-haus
 */
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureManifestScreenshots } from "../packages/core/src/screenshots";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface AppTarget {
  slug: string;
  dir: string;
  port: number;
  /** Production custom-domain origin; used by --prod mode. */
  prodOrigin: string;
  /**
   * The route to capture. Each app's home is locale-dependent; we keep
   * the default `?lang=de` for consistent screenshots.
   */
  path: string;
  /**
   * Selector that confirms the page has hydrated enough to screenshot.
   * `body` is the safe default; apps with FOUC-sensitive hero sections
   * can name a more specific selector.
   */
  readySelector: string;
}

const APPS: readonly AppTarget[] = [
  {
    slug: "frankfurt-museums",
    dir: "apps/frankfurt-museums",
    port: 8801,
    prodOrigin: "https://museumsufer.app",
    path: "/",
    readySelector: ".section",
  },
  {
    slug: "frankfurt-theaters",
    dir: "apps/frankfurt-theaters",
    port: 8802,
    prodOrigin: "https://frankfurt.ins.theater",
    path: "/",
    readySelector: ".programme",
  },
  {
    slug: "konzert-haus",
    dir: "apps/konzert-haus",
    port: 8803,
    prodOrigin: "https://frankfurt.konzert.haus",
    path: "/",
    readySelector: ".programme",
  },
  {
    slug: "landau-today",
    dir: "apps/landau-today",
    port: 8804,
    prodOrigin: "https://landau.today",
    path: "/",
    readySelector: "main",
  },
  {
    slug: "lehrhaus",
    dir: "apps/lehrhaus",
    port: 8805,
    prodOrigin: "https://frankfurt.lehr.salon",
    path: "/",
    readySelector: ".programme",
  },
  {
    slug: "lichtspiel-haus",
    dir: "apps/lichtspiel-haus",
    port: 8806,
    prodOrigin: "https://frankfurt.lichtspiel.haus",
    path: "/",
    readySelector: ".programme",
  },
];

async function waitForPort(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout waiting for ${url}: ${String(lastErr)}`);
}

async function captureLocal(app: AppTarget): Promise<void> {
  const cwd = join(REPO_ROOT, app.dir);
  const baseUrl = `http://localhost:${app.port}${app.path}`;
  console.log(`\n→ ${app.slug} (local port ${app.port})`);

  const proc = spawn("bun", ["run", "dev", "--port", String(app.port)], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  proc.stdout?.on("data", () => {});
  proc.stderr?.on("data", () => {});

  try {
    await waitForPort(baseUrl);
    const written = await captureManifestScreenshots({
      baseUrl,
      outDir: join(cwd, "public"),
      readySelector: app.readySelector,
    });
    for (const path of written) console.log(`  wrote ${path}`);
  } finally {
    proc.kill("SIGTERM");
    await new Promise<void>((r) => {
      const t = setTimeout(() => {
        proc.kill("SIGKILL");
        r();
      }, 3000);
      proc.once("exit", () => {
        clearTimeout(t);
        r();
      });
    });
  }
}

async function captureProd(app: AppTarget): Promise<void> {
  const cwd = join(REPO_ROOT, app.dir);
  const baseUrl = `${app.prodOrigin}${app.path}`;
  console.log(`\n→ ${app.slug} (${baseUrl})`);
  const written = await captureManifestScreenshots({
    baseUrl,
    outDir: join(cwd, "public"),
    readySelector: app.readySelector,
  });
  for (const path of written) console.log(`  wrote ${path}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const prod = argv.includes("--prod");
  const wanted = argv.filter((a) => a !== "--prod");
  const targets = wanted.length ? APPS.filter((a) => wanted.includes(a.slug)) : APPS;
  if (wanted.length && targets.length !== wanted.length) {
    const missing = wanted.filter((w) => !APPS.some((a) => a.slug === w));
    throw new Error(`unknown app(s): ${missing.join(", ")}. valid: ${APPS.map((a) => a.slug).join(", ")}`);
  }

  // Prod mode fans out — each capture is an HTTPS GET against a
  // different custom domain, fully independent. Local mode stays
  // sequential because each app spawns its own wrangler dev and the
  // bundlers fight over Bun's CSS build lock if they boot together.
  if (prod) {
    await Promise.all(targets.map((app) => captureProd(app)));
  } else {
    for (const app of targets) await captureLocal(app);
  }
  console.log(`\n✓ done — ${targets.length} app${targets.length === 1 ? "" : "s"} (${prod ? "prod" : "local"})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
