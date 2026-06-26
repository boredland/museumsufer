import {
  type Bbox,
  cityFor,
  cityOf,
  DARMSTADT_BBOX,
  FRANKFURT_BBOX,
  HAMBURG_BBOX,
  HEIDELBERG_BBOX,
  inBbox,
  LANDAU_BBOX,
  REMSCHEID_BBOX,
  SAARBRUECKEN_BBOX,
  SOLINGEN_BBOX,
  WUPPERTAL_BBOX,
} from "@museumsufer/core/cities";
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
  "autorenbuchhandlung-marx": [50.1029, 8.6748],
  "bad-homburger-schlosskonzerte": [50.2275, 8.6172],
  "b-movie": [53.5557, 9.9646],
  "bad-soden": [50.1411, 8.4985],
  "bnai-brith-frankfurt": [50.1182, 8.6611],
  "boell-hessen": [50.1056, 8.6517],
  "botschaft-der-wildtiere": [53.5382, 10.0181],
  brotfabrik: [50.1303, 8.6071],
  "cafe-mutz": [50.1726, 8.6357],
  "club-voltaire": [50.1151, 8.674],
  "cotton-club": [53.5476, 9.9856],
  "crespo-foundation": [50.1095, 8.6774],
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
  jazzkeller: [50.1144, 8.6737],
  "kirchenmusik-dreikoenig": [50.1051, 8.6863],
  "kronberg-academy": [50.1828, 8.5202],
  mampf: [50.1199, 8.699],
  "musikschule-frankfurt": [50.1107, 8.6809],
  "naxos-hallenkonzerte": [50.1198, 8.7027],
  "oper-frankfurt-konzerte": [50.1077, 8.6726],
  "rheingau-musikfestival": [50.0058, 8.0464],
  romanfabrik: [50.1149, 8.7124],
  "st-katharinen": [50.1138, 8.679],
  waggong: [50.1304, 8.7081],

  // ─── ins-theater venues ───────────────────────────────────
  "die-kaes": [50.1196, 8.7041],
  "die-schmiere": [50.1112, 8.6833],
  "dramatische-buehne": [50.1109, 8.6821],
  "dresden-frankfurt-dance-company": [50.1205, 8.6463],
  "english-theatre-frankfurt": [50.1083, 8.6712],
  "english-theatre-hamburg": [53.5693, 10.0286],
  "galli-theater": [50.1116, 8.6841],
  "gallus-theater": [50.101, 8.6334],
  "gloria-gloriette-heidelberg": [49.4115, 8.696],
  "hamburger-kammeroper": [53.5477, 9.9366],
  "hamburger-kammerspiele": [53.5684, 9.9842],
  "hamburger-puppentheater": [53.5855, 10.0435],
  "hamburger-sprechwerk": [53.5513, 10.0818],
  "imperial-theater": [53.5502, 9.9616],
  "hohe-luft-schiff": [53.5794, 9.9723],
  "theaterschiff-hamburg": [53.5453, 9.9864],
  "alma-hoppes-lustspielhaus": [53.5855, 9.9863],
  "alsterdorf-sommerkino": [53.6123, 10.0243],
  "mut-theater": [53.5622, 9.9608],
  "theater-das-zimmer": [53.5524, 10.0822],
  centralkomitee: [53.5552, 10.0163],
  "hansa-theater": [53.5558, 10.0122],
  "harburger-theater": [53.459, 9.9773],
  "ernst-deutsch-theater": [53.5695, 10.0266],
  "first-stage-theater": [53.5523, 9.9488],
  "deutsches-schauspielhaus": [53.5543, 10.0089],
  "hamburgische-staatsoper": [53.5567, 9.9889],
  "akademie-der-wissenschaften-hamburg": [53.5963, 10.0218],
  kahh: [53.5478, 9.9806],
  "koerber-stiftung": [53.5434, 9.9841],
  kampnagel: [53.5833, 10.0218],
  "st-pauli-theater": [53.5491, 9.963],
  "thalia-theater": [53.5521, 9.9986],
  elbphilharmonie: [53.5414, 9.9842],
  laeiszhalle: [53.5561, 9.9811],
  "hauptkirche-st-michaelis": [53.5484, 9.9789],
  "hauptkirche-st-jacobi": [53.5503, 10.0006],
  "hauptkirche-st-katharinen": [53.5459, 9.9944],
  "hauptkirche-st-petri": [53.5503, 9.9964],
  "ensemble-resonanz": [53.5564, 9.97],
  "hamburger-kunsthalle": [53.5538, 9.9982],
  deichtorhallen: [53.5471, 10.0068],
  "deichtorhallen-phoxxi": [53.5471, 10.0068],
  "deichtorhallen-halle-aktuelle-kunst": [53.5471, 10.0068],
  "deichtorhallen-sammlung-falckenberg": [53.4565, 9.9882],
  "mkg-hamburg": [53.5511, 10.0094],
  "altonaer-museum": [53.5489, 9.9344],
  "jenisch-haus": [53.5525, 9.8656],
  speicherstadtmuseum: [53.5452, 9.9918],
  "museum-der-arbeit": [53.5828, 10.0385],
  "deutsches-hafenmuseum": [53.533, 9.975],
  "museum-fuer-hamburgische-geschichte": [53.5511, 9.9731],
  // Default to Hessisches Staatstheater Wiesbaden — the scraper emits per-event
  // coords (Wiesbaden vs Darmstadt) so this only fires if an event omits both.
  "hessisches-staatstheater-wiesbaden": [50.0823, 8.2417],
  "hessisches-staatsballett": [50.0823, 8.2417],
  alleetheater: [53.5477, 9.9366],
  "altonaer-theater": [53.5478, 9.9351],
  "fundus-theater": [53.5496, 10.0396],
  "internationales-theater": [50.1135, 8.6976],
  "kellertheater-frankfurt": [50.1108, 8.6852],
  "komoedie-frankfurt": [50.1086, 8.6739],
  "komoedie-winterhuder-faehrhaus": [53.5939, 9.9942],
  landungsbruecken: [50.0976, 8.6519],
  "lichthof-theater": [53.5647, 9.9248],
  "lichtmess-kino": [53.5556, 9.935],
  "monsun-theater": [53.5492, 9.9272],
  mousonturm: [50.1183, 8.7019],
  "neues-theater-hoechst": [50.1014, 8.5443],
  "ohnsorg-theater": [53.5528, 10.0075],
  "oper-frankfurt": [50.1077, 8.6726],
  opernloft: [53.5435, 9.9399],
  "papageno-musiktheater": [50.1228, 8.6533],
  "schauspiel-frankfurt": [50.1078, 8.6745],
  "stalburg-theater": [50.1294, 8.6885],
  "theater-alte-bruecke": [50.1078, 8.6874],
  "theater-fuer-kinder": [53.5477, 9.9366],
  "theater-lempenfieber": [50.1856, 8.6824],
  "theater-willy-praml": [50.1199, 8.7037],
  "theaterhaus-frankfurt": [50.1116, 8.6877],
  "lichtwark-theater": [53.4851, 10.2285],
  "staatstheater-mainz": [50.001, 8.269],
  "staatstheater-saarland": [49.234, 6.996],
  "tigerpalast-variete": [50.1146, 8.6836],
  "unimedizin-frankfurt": [50.0942, 8.6536],
  "union-club-frankfurt": [50.1226, 8.647],
  "volksbuehne-frankfurt": [50.1116, 8.6817],

  // ─── lehrhaus direct sources ─────────────────────────────────────
  "stabi-hamburg": [53.5649, 9.9854],
  "hamburger-studienbibliothek": [53.5388, 10.0316],
  "literaturhaus-hamburg": [53.5649, 10.0135],
  buergeruniversitaet: [50.1284, 8.6679],
  "dfg-frankfurt": [50.1109, 8.6736],
  "dig-frankfurt": [50.1109, 8.6821],
  fabrik: [53.5505, 9.9293],
  "fes-hessen": [50.1075, 8.6655],
  "fgz-streitclub": [50.1108, 8.6622],
  "forschungskolleg-humanwissenschaften": [50.2273, 8.6088],
  "frankfurt-uas": [50.1247, 8.692],
  "frankfurter-sparkasse": [50.1112, 8.675],
  // Open-air cinema; exact site varies, central Frankfurt is good enough for routing.
  "freiluftkino-frankfurt": [50.1109, 8.6821],
  "haus-am-dom": [50.1107, 8.6826],
  "hospital-zum-heiligen-geist": [50.1109, 8.6852],
  "hsfk-frankfurt": [50.0925, 8.6863],
  hugenottenhalle: [50.0494, 8.6942],
  "institut-francais-frankfurt": [50.1208, 8.6595],
  "institut-fuer-sozialforschung": [50.1217, 8.6558],
  "instituto-cervantes-frankfurt": [50.1108, 8.6749],
  "juedische-gemeinde-frankfurt": [50.1167, 8.6712],
  "karl-marx-buchhandlung": [50.1228, 8.6529],
  "krankenhaus-nordwest": [50.1431, 8.6093],
  "landinsicht-buchladen": [50.1247, 8.6973],
  "ypsilon-buchladen": [50.1306, 8.6968],
  "literaturhaus-frankfurt": [50.1173, 8.6814],
  "normative-orders": [50.1287, 8.666],
  "openbooks-frankfurt": [50.1109, 8.6821],
  "polytechnische-gesellschaft": [50.1136, 8.6833],
  "rls-hessen": [50.1109, 8.6821],
  roemerberggespraeche: [50.1077, 8.6726],
  "sigmund-freud-institut": [50.117, 8.6557],
  "stadtbuecherei-frankfurt": [50.1116, 8.6831],

  // ─── arthouse cinemas ────────────────────────────────────────────
  "3001-kino": [53.5606, 9.9602],
  "abaton-kino": [53.567, 9.985],
  "alabama-kino": [53.5833, 10.0218],
  "astor-frankfurt": [50.1136, 8.6856],
  "astor-hafencity": [53.543, 9.995],
  "blankeneser-kino": [53.56, 9.812],
  "caligari-wiesbaden": [50.083, 8.2412],
  "capitol-mainz": [50.0046, 8.2693],
  "cinema-frankfurt": [50.1132, 8.6786],
  "elbe-filmtheater": [53.581, 9.849],
  "eldorado-frankfurt": [50.1138, 8.6843],
  "eschborn-k": [50.1457, 8.571],
  "filmforum-hoechst": [50.1014, 8.5443],
  "filmkreis-darmstadt": [49.8746, 8.6557],
  "filmpalast-hofheim": [50.0861, 8.4483],
  filmraum: [53.5798, 9.9426],
  "hafen-2-offenbach": [50.0972, 8.7449],
  "hansa-filmstudio": [53.485, 10.218],
  "harmonie-frankfurt": [50.0976, 8.6818],
  "kino-alte-muehle-bad-vilbel": [50.1846, 8.7464],
  "kamera-heidelberg": [49.414, 8.689],
  "bad-vilbel-open-air-kino": [50.1935, 8.7497],
  "taunale-oberursel": [50.2004, 8.5765],
  "kino-kelkheim": [50.1474, 8.4501],
  "kino-koeppern": [50.2554, 8.6453],
  "koralle-lichtspiele": [53.663, 10.147],
  "kronberger-lichtspiele": [50.1795, 8.5102],
  "lichtblick-moerfelden": [50.0001, 8.5709],
  "magazin-filmkunsttheater": [53.591, 9.99],
  "mainaeppelhaus-lohrberg": [50.152, 8.734],
  malsehn: [50.1235, 8.6789],
  "metropolis-kino": [53.5563, 9.9889],
  "murnau-filmtheater": [50.0857, 8.2456],
  "naxos-kino": [50.1198, 8.7027],
  "nippon-connection": [50.1183, 8.7019],
  "orfeos-erben": [50.1149, 8.6452],
  "passage-kino-hamburg": [53.553, 9.991],
  "programmkino-rex": [49.8773, 8.6555],
  pupille: [50.1247, 8.6573],
  "savoy-filmtheater": [53.5542, 10.0142],
  "schanzenkino-73": [53.561, 9.963],
  "studio-kino": [53.556, 9.957],
  "zeise-kinos": [53.552, 9.933],
  "zeise-open-air": [53.552, 9.933],

  // ─── Landau / Pfalz regional sources ─────────────────────────────
  "hambacher-schloss": [49.3236, 8.1153],
  "kulturnetz-landau": [49.198, 8.1192],
  "landau-de": [49.198, 8.1192],
  "pfalz-de": [49.198, 8.1192],
  "rptu-campuskultur": [49.1898, 8.1144],
  suew: [49.198, 8.1192],
  "museum-wiesbaden": [50.0771, 8.24588],
  "kunsthalle-mainz": [50.0155, 8.2587],
  "dommuseum-mainz": [49.998, 8.274],
  "bach-wiesbaden": [50.0825, 8.24],
  "lutherkirche-wiesbaden": [50.078, 8.238],
  "nhm-mainz": [50.003, 8.269],
  "museum-reinhard-ernst": [50.0775, 8.2385],
  "velvets-theater": [50.0575, 8.2564],
  "kammerspiele-wiesbaden": [50.077, 8.233],
  kuenstlerhaus43: [50.081, 8.239],
  "theater-im-pariser-hof": [50.0853, 8.2427],
  // ─── Norderstedt ──────────────────────────────────────────────
  "musicstar-norderstedt": [53.706, 9.986],
  "sperrstunde-hamburg": [53.55, 9.99],

  // ─── Bergisches Städtedreieck cinemas (Kinoheld) ───────────────
  "rex-filmtheater-wuppertal": [51.258, 7.148],
  "cinema-wuppertal": [51.256, 7.155],
  "das-lumen-filmtheater-solingen": [51.164, 7.082],
  // ─── Saarbrücken ────────────────────────────────────────────────
  "congresshalle-saarbruecken": [49.234, 6.996],
  "garage-saarbruecken": [49.232, 6.995],
  "drp-saarbruecken": [49.241, 7.024],
  "filmhaus-saarbruecken": [49.234, 6.998],
  "kino-achteinhalb": [49.233, 6.997],
  "camera-zwo": [49.235, 7.0],
  "city-kinos-saarbruecken": [49.234, 6.998],
  "kulturbesitz-saarbruecken": [49.233, 6.994],
  "historisches-museum-saar": [49.234, 6.996],
  "studio-30-saarbruecken": [49.232, 6.995],
  "kuba-saarbruecken": [49.241, 7.024],
  "theater-ueberzwerg": [49.234, 6.996],
  "theater-im-viertel": [49.233, 6.997],
  "uni-saarland": [49.254, 7.044],
  "hfm-saar": [49.237, 7.006],
  "literaturarchiv-saar": [49.254, 7.044],
  "ut-kinos-saarbruecken": [49.234, 6.998],
  "passage-kinos-saarbruecken": [49.234, 6.998],
};

/** Resolve default coordinates for a hub source_slug. Falls through to the
 *  MUSEUMS config (lat/lng) for museum sub-slugs produced by the
 *  museumsufer orchestrator. */
export function coordinatesFor(sourceSlug: string): readonly [number, number] | null {
  const explicit = VENUE_COORDS[sourceSlug];
  if (explicit) return explicit;
  const museum = MUSEUMS[sourceSlug];
  if (museum) return [museum.lat, museum.lng];
  return null;
}

// Bbox type, per-city boxes and `inBbox` live in @museumsufer/core/cities so
// both build scripts and worker request paths share one source of truth.
// Re-exported here for back-compat: @museumsufer/event-hub consumers import
// these names from the scrapers barrel.
export {
  type Bbox,
  cityFor,
  cityOf,
  DARMSTADT_BBOX,
  FRANKFURT_BBOX,
  HAMBURG_BBOX,
  HEIDELBERG_BBOX,
  inBbox,
  LANDAU_BBOX,
  REMSCHEID_BBOX,
  SAARBRUECKEN_BBOX,
  SOLINGEN_BBOX,
  WUPPERTAL_BBOX,
};

/** Frankfurt + Landau corridor bbox. Anything outside is dropped by the
 *  hub runner; this is defense-in-depth against scraper-level filter
 *  bugs (e.g. an HR Sinfonie touring show at Wiesbaden slipping through). */
export const GEOFENCE_BBOX: Bbox = {
  minLat: 48.9,
  maxLat: 50.45,
  minLon: 7.85,
  maxLon: 9.05,
};

export function withinGeofence(lat: number, lon: number): boolean {
  return (
    inBbox(lat, lon, GEOFENCE_BBOX) ||
    inBbox(lat, lon, HAMBURG_BBOX) ||
    inBbox(lat, lon, WUPPERTAL_BBOX) ||
    inBbox(lat, lon, SOLINGEN_BBOX) ||
    inBbox(lat, lon, REMSCHEID_BBOX) ||
    inBbox(lat, lon, SAARBRUECKEN_BBOX)
  );
}
