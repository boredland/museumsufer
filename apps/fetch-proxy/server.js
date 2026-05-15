const http = require("node:http");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const PORT = process.env.PORT || 3000;
// Optional sidecar FlareSolverr (https://github.com/FlareSolverr/FlareSolverr) —
// when set, requests that come back as a Cloudflare "Just a moment…" challenge
// are retried through a headless Chromium that can solve it. Provision via
// docker-compose.yml in this directory.
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || "";
const FLARESOLVERR_TIMEOUT_MS = Number(process.env.FLARESOLVERR_TIMEOUT_MS || 60000);

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

http
  .createServer(async (req, res) => {
    if (AUTH_TOKEN) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${AUTH_TOKEN}`) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end('{"error":"unauthorized"}');
        return;
      }
    }

    const url = new URL(req.url, `http://${req.headers.host}`).searchParams.get("url");
    if (!url) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end('{"error":"?url= parameter required"}');
      return;
    }

    console.log(`-> ${url}`);
    try {
      // Step 1: plain fetch with a Chrome UA. Handles the common cases
      // (datacenter-IP blocks, broken TLS chains, anti-bot heuristics that
      // only check headers).
      const direct = await fetch(url, {
        headers: { "User-Agent": CHROME_UA },
        redirect: "follow",
      });
      const directBody = Buffer.from(await direct.arrayBuffer());

      // Step 2: if the response is a Cloudflare interactive challenge AND
      // FlareSolverr is available, retry through it. CF challenge fingerprint:
      // 403 status + a small HTML page containing "Just a moment…" or the
      // cf-chl_ JS-init markers.
      if (FLARESOLVERR_URL && looksLikeCfChallenge(direct.status, directBody)) {
        console.log(`?? CF challenge on ${url} — retrying via FlareSolverr`);
        const solved = await solveWithFlareSolverr(url);
        if (solved) {
          console.log(`<- ${solved.status} ${url} (flaresolverr)`);
          res.writeHead(solved.status, { "content-type": "text/html; charset=utf-8" });
          res.end(solved.body);
          return;
        }
        console.warn(`!! FlareSolverr failed to solve ${url}; returning original 403`);
      }

      console.log(`<- ${direct.status} ${url}`);
      res.writeHead(direct.status, {
        "content-type": direct.headers.get("content-type") || "text/html",
      });
      res.end(directBody);
    } catch (e) {
      console.error(`!! ${url}: ${e.message}`);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  })
  .listen(PORT, () => {
    console.log(`fetch-proxy listening on :${PORT}`);
    if (FLARESOLVERR_URL) console.log(`flaresolverr sidecar: ${FLARESOLVERR_URL}`);
  });

/** Detect a Cloudflare interactive challenge so we know to fall back to
 *  FlareSolverr. Cheap heuristic: small 403 response containing the JS-init
 *  fingerprint. Bigger 403 pages (real "forbidden" responses from the origin)
 *  pass through unchanged. */
function looksLikeCfChallenge(status, body) {
  if (status !== 403 && status !== 503) return false;
  if (body.length > 50_000) return false;
  const head = body.subarray(0, Math.min(body.length, 8192)).toString("utf8");
  return /Just a moment\.\.\./i.test(head) || /cf-chl_/i.test(head) || /__cf_chl_opt/i.test(head);
}

async function solveWithFlareSolverr(url) {
  try {
    const res = await fetch(`${FLARESOLVERR_URL.replace(/\/$/, "")}/v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "request.get", url, maxTimeout: FLARESOLVERR_TIMEOUT_MS }),
    });
    if (!res.ok) {
      console.warn(`!! flaresolverr http ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.status !== "ok" || !data.solution) {
      console.warn(`!! flaresolverr status=${data.status} message=${data.message ?? ""}`);
      return null;
    }
    return {
      status: data.solution.status || 200,
      body: data.solution.response || "",
    };
  } catch (e) {
    console.warn(`!! flaresolverr threw: ${e.message}`);
    return null;
  }
}
