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

interface CityCapture {
  /** City slug, for logging. */
  city: string;
  /** Production custom-domain origin for this city; used by --prod mode. */
  prodOrigin: string;
  /**
   * Filename suffix inserted before `.png` — "" for the canonical
   * `ss-wide.png`/`ss-mobile.png` (the default city), `-hamburg` for
   * the rest. Must match `cityScreenshots()` in the app manifests.
   */
  suffix: string;
}

interface AppTarget {
  slug: string;
  dir: string;
  port: number;
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
  /**
   * One capture per city this Worker serves. Multi-city apps list both
   * Frankfurt (suffix "") and Hamburg (suffix "-hamburg"); single-city
   * apps list one entry. In local mode the city is selected by sending
   * the prod host as the `Host` header to one `wrangler dev`.
   */
  cities: CityCapture[];
}

const APPS: readonly AppTarget[] = [
  {
    slug: "museumsufer",
    dir: "apps/museumsufer",
    port: 8801,
    path: "/",
    readySelector: ".section",
    cities: [
      { city: "frankfurt", prodOrigin: "https://museumsufer.app", suffix: "" },
      { city: "hamburg", prodOrigin: "https://hamburg.ins.museum", suffix: "-hamburg" },
      { city: "darmstadt", prodOrigin: "https://darmstadt.ins.museum", suffix: "-darmstadt" },
      { city: "heidelberg", prodOrigin: "https://heidelberg.ins.museum", suffix: "-heidelberg" },
    ],
  },
  {
    slug: "ins-theater",
    dir: "apps/ins-theater",
    port: 8802,
    path: "/",
    readySelector: ".programme",
    cities: [
      { city: "frankfurt", prodOrigin: "https://frankfurt.ins.theater", suffix: "" },
      { city: "hamburg", prodOrigin: "https://hamburg.ins.theater", suffix: "-hamburg" },
      { city: "darmstadt", prodOrigin: "https://darmstadt.ins.theater", suffix: "-darmstadt" },
      { city: "heidelberg", prodOrigin: "https://heidelberg.ins.theater", suffix: "-heidelberg" },
    ],
  },
  {
    slug: "konzert-haus",
    dir: "apps/konzert-haus",
    port: 8803,
    path: "/",
    readySelector: ".programme",
    cities: [
      { city: "frankfurt", prodOrigin: "https://frankfurt.konzert.haus", suffix: "" },
      { city: "hamburg", prodOrigin: "https://hamburg.konzert.haus", suffix: "-hamburg" },
      { city: "darmstadt", prodOrigin: "https://darmstadt.konzert.haus", suffix: "-darmstadt" },
      { city: "heidelberg", prodOrigin: "https://heidelberg.konzert.haus", suffix: "-heidelberg" },
    ],
  },
  {
    slug: "landau-today",
    dir: "apps/landau-today",
    port: 8804,
    path: "/",
    readySelector: "main",
    cities: [{ city: "landau", prodOrigin: "https://landau.today", suffix: "" }],
  },
  {
    slug: "lehrhaus",
    dir: "apps/lehrhaus",
    port: 8805,
    path: "/",
    readySelector: ".programme",
    cities: [
      { city: "frankfurt", prodOrigin: "https://frankfurt.lehr.salon", suffix: "" },
      { city: "hamburg", prodOrigin: "https://hamburg.lehr.salon", suffix: "-hamburg" },
      { city: "darmstadt", prodOrigin: "https://darmstadt.lehr.salon", suffix: "-darmstadt" },
      { city: "heidelberg", prodOrigin: "https://heidelberg.lehr.salon", suffix: "-heidelberg" },
    ],
  },
  {
    slug: "lichtspiel-haus",
    dir: "apps/lichtspiel-haus",
    port: 8806,
    path: "/",
    readySelector: ".programme",
    cities: [
      { city: "frankfurt", prodOrigin: "https://frankfurt.lichtspiel.haus", suffix: "" },
      { city: "hamburg", prodOrigin: "https://hamburg.lichtspiel.haus", suffix: "-hamburg" },
      { city: "darmstadt", prodOrigin: "https://darmstadt.lichtspiel.haus", suffix: "-darmstadt" },
      { city: "heidelberg", prodOrigin: "https://heidelberg.lichtspiel.haus", suffix: "-heidelberg" },
    ],
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
    // One dev server, N cities: the host→city middleware reads the Host
    // header, so we point each capture at the city's prod host.
    for (const c of app.cities) {
      const written = await captureManifestScreenshots({
        baseUrl,
        outDir: join(cwd, "public"),
        readySelector: app.readySelector,
        filenameSuffix: c.suffix,
        hostHeader: new URL(c.prodOrigin).host,
      });
      for (const path of written) console.log(`  [${c.city}] wrote ${path}`);
    }
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
  // Each city has its own subdomain in prod — hit it directly, no Host
  // override needed. A newly-added city's custom domain may still be
  // provisioning (DNS/cert) right after deploy, so a non-canonical city's
  // failure only warns; the canonical (default-suffix) city must succeed.
  await Promise.all(
    app.cities.map(async (c) => {
      const baseUrl = `${c.prodOrigin}${app.path}`;
      console.log(`\n→ ${app.slug} [${c.city}] (${baseUrl})`);
      try {
        const written = await captureManifestScreenshots({
          baseUrl,
          outDir: join(cwd, "public"),
          readySelector: app.readySelector,
          filenameSuffix: c.suffix,
        });
        for (const path of written) console.log(`  [${c.city}] wrote ${path}`);
      } catch (err) {
        if (c.suffix === "") throw err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  [${c.city}] skipped — ${msg}`);
      }
    }),
  );
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
