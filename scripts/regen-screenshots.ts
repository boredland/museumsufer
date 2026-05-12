/**
 * Regenerate manifest screenshots (ss-wide.png + ss-mobile.png) for
 * every app in the monorepo.
 *
 * Boots each app's `wrangler dev` on a unique port, waits for the
 * server to answer, drives Playwright via `@museumsufer/core/screenshots`,
 * then tears the server down. Apps are processed sequentially so
 * wrangler instances don't fight over Bun's CSS build lock.
 *
 *   bun scripts/regen-screenshots.ts               # all apps
 *   bun scripts/regen-screenshots.ts museums theaters
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
  { slug: "frankfurt-museums", dir: "apps/frankfurt-museums", port: 8801, path: "/", readySelector: ".section" },
  { slug: "frankfurt-theaters", dir: "apps/frankfurt-theaters", port: 8802, path: "/", readySelector: ".programme" },
  { slug: "konzert-haus", dir: "apps/konzert-haus", port: 8803, path: "/", readySelector: ".programme" },
  { slug: "landau-today", dir: "apps/landau-today", port: 8804, path: "/", readySelector: "main" },
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

async function captureForApp(app: AppTarget): Promise<void> {
  const cwd = join(REPO_ROOT, app.dir);
  const baseUrl = `http://localhost:${app.port}${app.path}`;
  console.log(`\n→ ${app.slug} (port ${app.port})`);

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

async function main() {
  const wanted = process.argv.slice(2);
  const targets = wanted.length ? APPS.filter((a) => wanted.includes(a.slug)) : APPS;
  if (wanted.length && targets.length !== wanted.length) {
    const missing = wanted.filter((w) => !APPS.some((a) => a.slug === w));
    throw new Error(`unknown app(s): ${missing.join(", ")}. valid: ${APPS.map((a) => a.slug).join(", ")}`);
  }

  for (const app of targets) {
    await captureForApp(app);
  }
  console.log(`\n✓ done — ${targets.length} app${targets.length === 1 ? "" : "s"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
