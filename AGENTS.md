# Agent instructions — Frankfurt culture monorepo

Six Cloudflare Workers aggregating Frankfurt/Rhein-Main (+ Landau) cultural
programming. A daily/hourly GitHub Action runs `packages/event-hub`'s scrape,
which fans out to the per-venue scrapers in `packages/scrapers`, classifies via
`packages/classify`, runs the TMDb/OMDb/DeepL enrichment passes, and commits typed
bundles each app reads at the edge. See `README.md` for the app/package map.

## Determinism rule (read before touching the scrape path)

`packages/event-hub/scripts/scrape.ts` MUST stay byte-deterministic: two
consecutive runs on identical upstream data produce a byte-identical
`data/events.ts`, so the GH Action's commit-if-changed step stays quiet. Anything
non-deterministic or network-flaky (an LLM call, a live geocode) does **not** belong
in the scrape path. Such work runs as a **hand-run dev/enrichment helper** whose
output you review and commit as static data; the scrape then consumes only the
committed artifact. The TMDb/OMDb/DeepL caches (`packages/event-hub/data/*.ts`,
seeded + persisted in `scrape.ts`) are the established pattern: an API key fills a
committed cache, and a cache hit makes reruns deterministic and key-free.

## LLM access (AI proxy)

Need a model in dev/tooling? Hit the **AI proxy** — one OpenAI-compatible endpoint
fronting Gemini, Mistral, and Copilot/GitHub (`openai/*`) models. The access token
is **baked into the URL path**, so there's no bearer; `apiKey` is an unused
placeholder (the SDK just wants a non-empty string).

```ts
import OpenAI from "openai";
const client = new OpenAI({ baseURL: process.env.AI_PROXY_URL, apiKey: "unused" });
const res = await client.chat.completions.create({
  model: "gemini-2.5-flash",
  messages: [{ role: "user", content: "…" }],
});
```

Or plain `fetch` (no SDK): `POST ${AI_PROXY_URL}/chat/completions` with
`{ model, messages, response_format }`. Set a normal Chrome `User-Agent` on
hand-rolled requests — the proxy is Cloudflare-fronted and 403s
(`error code: 1010`, "browser banned") on a default Bun/undici UA. The `openai`
SDK already sends an acceptable UA.

**Auth — `AI_PROXY_URL`, stored both ways:** an **Actions variable** (dev) and an
**Actions secret** (CI), same as the fetch proxy. Never hardcode the URL in source.
Locally:

```sh
export AI_PROXY_URL=$(gh variable get AI_PROXY_URL)
```

**Models.** Catalog is dynamic — `GET $AI_PROXY_URL/models` (`owned_by` is
`gemini`/`mistral`/`github`). Prefer the **flash / flash-lite** Gemini models
(`gemini-2.5-flash`, `gemini-flash-latest`, `gemini-flash-lite-latest`) — fast,
cheap. The `openai/*` Copilot models occasionally 502 (`AiGatewayError`); retry, or
prefer Gemini/Mistral if you need zero flakes.

**Search grounding — native Gemini path, not the OpenAI surface.** The
OpenAI-compat `/chat/completions` cannot ground (a `google_search` tool shape 400s).
Use `POST $AI_PROXY_URL/v1beta/models/<model>:generateContent` with a Gemini-native
body (`contents`/`parts`) and `"tools": [{"google_search": {}}]`; the response
carries `candidates[0].groundingMetadata` (`webSearchQueries`, `groundingChunks`
with source URLs) to verify answers are sourced, not invented.

**Discipline.** This is a **dev/enrichment** tool, never the live scrape/hash path
(see the determinism rule above). Use it to produce a reviewed, committed artifact
(e.g. a PDF-programme cache keyed by content hash), then have the scrape read only
that committed file.
