import { MUSEUMS } from "./_museums/config";

/**
 * Default coordinates for each hub source_slug. Used by the runner to
 * auto-fill `lat`/`lon` on events whose scraper didn't emit per-event
 * coordinates — most venues have one fixed address so the default
 * matches the actual location.
 *
 * Multi-venue regional sources (pfalz-de, suew, kulturnetz-landau, …)
 * carry a centroid coordinate that satisfies the hub's bbox geofence;
 * the landau-today app re-geocodes per event via Nominatim for its
 * "in der Nähe" sort.
 *
 * Museum sub-slugs are not duplicated here — `coordinatesFor` falls
 * through to the `MUSEUMS` config (`packages/scrapers/src/_museums/`)
 * which already carries lat/lng per museum.
 */
export const VENUE_COORDS: Readonly<Record<string, readonly [number, number]>> = {
  // ─── konzert-haus venues ─────────────────────────────────────────
  "alte-oper": [50.1158, 8.6713],
  "andreas-koehs": [50.1115, 8.6839],
  "bad-homburger-schlosskonzerte": [50.2275, 8.6172],
  "bad-soden": [50.1411, 8.4985],
  "bnai-brith-frankfurt": [50.1182, 8.6611],
  brotfabrik: [50.1303, 8.6071],
  "denkbar-frankfurt": [50.1189, 8.6601],
  "dr-hochs-konservatorium": [50.1115, 8.7016],
  "ensemble-modern": [50.1125, 8.7128],
  "evangelische-akademie-frankfurt": [50.1102, 8.6824],
  hfmdk: [50.1232, 8.6749],
  holzhausenschloesschen: [50.1289, 8.6764],
  "hr-bigband": [50.1314, 8.6634],
  "hr-sinfonieorchester": [50.1314, 8.6634],
  "jazz-frankfurt": [50.1109, 8.6821],
  "jazz-palmengarten": [50.1241, 8.6584],
  "kirchenmusik-dreikoenig": [50.1051, 8.6863],
  "kronberg-academy": [50.1828, 8.5202],
  "musikschule-frankfurt": [50.1107, 8.6809],
  "naxos-hallenkonzerte": [50.1198, 8.7027],
  "oper-frankfurt-konzerte": [50.1077, 8.6726],
  "rheingau-musikfestival": [50.0058, 8.0464],
  romanfabrik: [50.1149, 8.7124],
  "st-katharinen": [50.1138, 8.679],
  waggong: [50.1304, 8.7081],

  // ─── frankfurt-theaters venues ───────────────────────────────────
  "die-kaes": [50.1196, 8.7041],
  "die-schmiere": [50.1112, 8.6833],
  "dramatische-buehne": [50.1109, 8.6821],
  "dresden-frankfurt-dance-company": [50.1205, 8.6463],
  "english-theatre-frankfurt": [50.1083, 8.6712],
  "galli-theater": [50.1116, 8.6841],
  "gallus-theater": [50.101, 8.6334],
  "internationales-theater": [50.1135, 8.6976],
  "kellertheater-frankfurt": [50.1108, 8.6852],
  "komoedie-frankfurt": [50.1086, 8.6739],
  landungsbruecken: [50.0976, 8.6519],
  mousonturm: [50.1183, 8.7019],
  "neues-theater-hoechst": [50.1014, 8.5443],
  "oper-frankfurt": [50.1077, 8.6726],
  "papageno-musiktheater": [50.1228, 8.6533],
  "schauspiel-frankfurt": [50.1078, 8.6745],
  "stalburg-theater": [50.1294, 8.6885],
  "theater-alte-bruecke": [50.1078, 8.6874],
  "theater-lempenfieber": [50.1856, 8.6824],
  "theater-willy-praml": [50.1199, 8.7037],
  "theaterhaus-frankfurt": [50.1116, 8.6877],
  "tigerpalast-variete": [50.1146, 8.6836],
  "union-club-frankfurt": [50.1226, 8.647],
  "volksbuehne-frankfurt": [50.1116, 8.6817],

  // ─── lehrhaus direct sources ─────────────────────────────────────
  buergeruniversitaet: [50.1284, 8.6679],
  "dig-frankfurt": [50.1109, 8.6821],
  "fes-hessen": [50.1075, 8.6655],
  "fgz-streitclub": [50.1108, 8.6622],
  "forschungskolleg-humanwissenschaften": [50.2273, 8.6088],
  "haus-am-dom": [50.1107, 8.6826],
  "institut-francais-frankfurt": [50.1208, 8.6595],
  "institut-fuer-sozialforschung": [50.1217, 8.6558],
  "instituto-cervantes-frankfurt": [50.1108, 8.6749],
  "juedische-gemeinde-frankfurt": [50.1167, 8.6712],
  "literaturhaus-frankfurt": [50.1173, 8.6814],
  "normative-orders": [50.1287, 8.666],
  "openbooks-frankfurt": [50.1109, 8.6821],
  "polytechnische-gesellschaft": [50.1136, 8.6833],
  "rls-hessen": [50.1109, 8.6821],
  roemerberggespraeche: [50.1077, 8.6726],
  "sigmund-freud-institut": [50.117, 8.6557],
  "stadtbuecherei-frankfurt": [50.1116, 8.6831],

  // ─── Landau / Pfalz regional sources ─────────────────────────────
  "hambacher-schloss": [49.3236, 8.1153],
  "kulturnetz-landau": [49.198, 8.1192],
  "landau-de": [49.198, 8.1192],
  "pfalz-de": [49.198, 8.1192],
  "rptu-campuskultur": [49.1898, 8.1144],
  suew: [49.198, 8.1192],
};

/** Resolve default coordinates for a hub source_slug. Falls through to the
 *  MUSEUMS config (lat/lng) for museum sub-slugs produced by the
 *  frankfurt-museums orchestrator. */
export function coordinatesFor(sourceSlug: string): readonly [number, number] | null {
  const explicit = VENUE_COORDS[sourceSlug];
  if (explicit) return explicit;
  const museum = MUSEUMS[sourceSlug];
  if (museum) return [museum.lat, museum.lng];
  return null;
}

export interface Bbox {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
}

/** Frankfurt + Landau corridor bbox. Anything outside is dropped by the
 *  hub runner; this is defense-in-depth against scraper-level filter
 *  bugs (e.g. an HR Sinfonie touring show at Wiesbaden slipping through). */
export const GEOFENCE_BBOX: Bbox = {
  minLat: 48.9,
  maxLat: 50.45,
  minLon: 7.85,
  maxLon: 9.05,
};

/** Frankfurt metro + Taunus / Rheingau / Offenbach edge. Bad Homburg and
 *  Forschungskolleg in the north (50.227), Rheingau festival in the west
 *  (8.046), Höchst / Bad Soden in the south-west, Offenbach in the east. */
export const FRANKFURT_BBOX: Bbox = {
  minLat: 49.95,
  maxLat: 50.3,
  minLon: 7.95,
  maxLon: 8.85,
};

/** Landau in der Pfalz + Südliche Weinstraße + Hambach. */
export const LANDAU_BBOX: Bbox = {
  minLat: 49.05,
  maxLat: 49.45,
  minLon: 7.95,
  maxLon: 8.3,
};

export function inBbox(lat: number, lon: number, box: Bbox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon;
}

export function withinGeofence(lat: number, lon: number): boolean {
  return inBbox(lat, lon, GEOFENCE_BBOX);
}
