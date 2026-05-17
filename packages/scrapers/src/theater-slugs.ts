/** Hub source_slugs whose scrapers emit theater-shape events. Other apps
 *  (lehrhaus) use this to decide which events roll up under the
 *  `frankfurt-theaters` source. mousonturm is excluded because it
 *  doubles as a direct lehrhaus source. */
export const THEATER_SLUGS: ReadonlySet<string> = new Set([
  "die-kaes",
  "die-schmiere",
  "dramatische-buehne",
  "dresden-frankfurt-dance-company",
  "english-theatre-frankfurt",
  "galli-theater",
  "gallus-theater",
  "internationales-theater",
  "kellertheater-frankfurt",
  "komoedie-frankfurt",
  "landungsbruecken",
  "neues-theater-hoechst",
  "oper-frankfurt",
  "papageno-musiktheater",
  "schauspiel-frankfurt",
  "stalburg-theater",
  "theater-alte-bruecke",
  "theater-lempenfieber",
  "theater-willy-praml",
  "theaterhaus-frankfurt",
  "tigerpalast-variete",
  "volksbuehne-frankfurt",
]);
