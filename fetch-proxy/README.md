# Fetch Proxy

A lightweight HTTP proxy for fetching web pages from servers that block datacenter IPs or have broken SSL certificates. Used by the museumsufer exhibition scraper as a fallback for museums that reject direct requests from Cloudflare Workers.

## Running

```bash
docker build -t fetch-proxy .
docker run -p 3000:3000 -e AUTH_TOKEN=your-secret fetch-proxy
```

Or with docker-compose / Dokploy: set `AUTH_TOKEN` as an environment variable.

## Usage

```
GET /?url=https://example.com
Authorization: Bearer <AUTH_TOKEN>
```

Returns the fetched page content with the original status code and content-type. Uses a browser-like User-Agent. TLS verification is disabled to handle servers with incomplete certificate chains.

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
