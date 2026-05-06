# Frankfurt culture monorepo

Cloudflare Workers that aggregate Frankfurt cultural programming into single-page apps.

## Apps

| App | Domain | What it does |
|---|---|---|
| [`apps/frankfurt-museums`](apps/frankfurt-museums) | [museumsufer.app](https://museumsufer.app) | Daily exhibitions and events from ~40 Museumsufer museums. |
| `apps/frankfurt-theaters` | frankfurt.ins.theater | Performances, seat availability, and prices from Frankfurt theaters (in progress). |
| [`apps/fetch-proxy`](apps/fetch-proxy) | — | Generic upstream fetch proxy used by the apps. |

## Packages

- `packages/config` — shared `tsconfig`/`biome` presets
- `packages/core` — shared utilities

## Stack

- Cloudflare Workers (TypeScript), D1 (SQLite), Workers AI, DeepL
- [Hono](https://hono.dev) v4 + JSX SSR + Tailwind + htmx
- Turborepo + npm workspaces
- Daily cron + GitHub Actions health check

## Common commands

```bash
npm install
npm run dev           # all apps
npm run build         # all apps
npm run typecheck
npm run lint
npm run health-check  # all apps
```

Per-app docs live next to the app (e.g. `apps/frankfurt-museums/README.md`).
