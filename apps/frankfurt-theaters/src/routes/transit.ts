import { Hono } from "hono";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const CENTER_LAT = 50.1109;
const CENTER_LNG = 8.6821;
const MAX_KM = 25;
const WALK_KM_PER_MIN = 0.08;

interface TransitBody {
  lat: number;
  lng: number;
}

interface RmvSvcRes {
  res?: { outConL?: Array<{ dur?: string }> };
}

interface RmvResponse {
  svcResL?: RmvSvcRes[];
}

/**
 * POST /api/transit  → { theaterSlug: minutes, ... }
 *
 * Coordinate-only port of museumsufer's RMV mgate integration. The user's
 * lat/lng is snapped to a ~220m grid for caching, and we POST a batched
 * TripSearch to RMV for each theater whose coordinates we have. Theaters
 * outside ~25km fall through to a haversine walking-time estimate so the
 * UI always renders something.
 *
 * No geo-sorting happens server-side — the response is a flat lookup
 * map. The home page paints minutes onto each Anfahrt button without
 * reordering anything.
 */
app.post("/api/transit", async (c) => {
  const body = (await c.req.json<TransitBody>().catch(() => null)) as TransitBody | null;
  if (!body || typeof body.lat !== "number" || typeof body.lng !== "number") {
    return c.json({ error: "invalid" }, 400);
  }

  const dlat = (body.lat - CENTER_LAT) * 111.32;
  const dlng = (body.lng - CENTER_LNG) * 111.32 * Math.cos((CENTER_LAT * Math.PI) / 180);
  if (Math.sqrt(dlat * dlat + dlng * dlng) > MAX_KM) {
    return c.json({}, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
  }

  const snapLat = Math.round(body.lat * 500) / 500;
  const snapLng = Math.round(body.lng * 500) / 500;
  const ox = Math.round(snapLng * 1e6);
  const oy = Math.round(snapLat * 1e6);

  const queryItems = THEATERS.map((t) => ({
    key: t.slug,
    arrLoc: { type: "C" as const, crd: { x: Math.round(t.lon * 1e6), y: Math.round(t.lat * 1e6) } },
  }));

  const result: Record<string, number> = {};

  const batches: (typeof queryItems)[] = [];
  for (let i = 0; i < queryItems.length; i += 10) batches.push(queryItems.slice(i, i + 10));

  await Promise.all(
    batches.map(async (batch) => {
      const svcReqL = batch.map((item) => ({
        meth: "TripSearch",
        req: {
          depLocL: [{ type: "C", crd: { x: ox, y: oy } }],
          arrLocL: [item.arrLoc],
          numF: 1,
          getPolyline: false,
        },
      }));
      try {
        const res = await fetch("https://www.rmv.de/auskunft/bin/jp/mgate.exe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cf: { cacheTtl: 86400, cacheEverything: true },
          body: JSON.stringify({
            auth: { type: "AID", aid: "x0k4ZR33ICN9CWmj" },
            client: { type: "WEB", id: "RMV", name: "webapp" },
            ver: "1.44",
            ext: "RMV.1",
            lang: "de",
            svcReqL,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as RmvResponse;
        (data.svcResL || []).forEach((r, j) => {
          const dur = r.res?.outConL?.[0]?.dur;
          if (!dur || dur.length < 4) return;
          const minutes = parseInt(dur.slice(0, 2), 10) * 60 + parseInt(dur.slice(2, 4), 10);
          if (Number.isFinite(minutes)) result[batch[j].key] = minutes;
        });
      } catch {
        // network / parsing failure — leave empty, fallback below fills it
      }
    }),
  );

  for (const t of THEATERS) {
    if (result[t.slug] !== undefined) continue;
    const dLat = (t.lat - snapLat) * 111.32;
    const dLng = (t.lon - snapLng) * 111.32 * Math.cos((snapLat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLng * dLng);
    result[t.slug] = Math.round(km / WALK_KM_PER_MIN);
  }

  return c.json(result, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
});

export default app;
