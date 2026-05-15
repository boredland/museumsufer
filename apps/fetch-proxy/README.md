# Fetch Proxy

A lightweight HTTP proxy for fetching web pages from servers that block datacenter IPs or have broken SSL certificates. Used by the museumsufer exhibition scraper as a fallback for museums that reject direct requests from Cloudflare Workers — and, via an optional FlareSolverr sidecar, for sources that gate behind Cloudflare's "Just a moment…" interactive challenge.

## Running

### Plain proxy only (no CF-challenge support)

```bash
docker build -t fetch-proxy .
docker run -p 3000:3000 -e AUTH_TOKEN=your-secret fetch-proxy
```

### Proxy + FlareSolverr sidecar (recommended)

```bash
AUTH_TOKEN=your-secret docker compose up -d
```

The compose stack starts two services:
- `fetch-proxy` on `:3000` — public entry point, takes `?url=` requests as before
- `flaresolverr` — internal-only headless-Chromium service that the proxy auto-invokes when it detects a Cloudflare interactive challenge

In Dokploy: import `docker-compose.yml` as a Compose service, set `AUTH_TOKEN` as a stack secret.

## Usage

```
GET /?url=https://example.com
Authorization: Bearer <AUTH_TOKEN>
```

Returns the fetched page content with the original status code and content-type.

**Request flow:**

1. Plain `fetch()` with a Chrome User-Agent — handles datacenter-IP blocks and broken TLS chains.
2. If the response looks like a CF interactive challenge (403/503 + "Just a moment…" body) **and** `FLARESOLVERR_URL` is set, retry via FlareSolverr's `/v1` endpoint. FlareSolverr renders the page in a headless Chromium, solves the JS proof-of-work, and returns the resolved HTML.
3. Otherwise pass the original response through.

TLS verification is disabled on the plain-fetch path (`NODE_TLS_REJECT_UNAUTHORIZED=0`) to handle servers with incomplete certificate chains.

## Integration with museumsufer Worker

1. Set wrangler secrets:

```bash
echo "https://your-proxy-host.example.com" | npx wrangler secret put FETCH_PROXY_URL
echo "your-auth-token" | npx wrangler secret put FETCH_PROXY_TOKEN
```

2. In `src/museum-exhibitions.ts`, mark museums that need the proxy:

```typescript
"bibelhaus-erlebnismuseum": {
  url: "https://www.bibelhaus-frankfurt.de/de/ausstellungen",
  proxy: true,
},
```

3. Deploy: `npx wrangler deploy`

The exhibition scraper (`src/exhibition-scraper.ts`) automatically routes `proxy: true` museums through `FETCH_PROXY_URL` instead of fetching directly.
