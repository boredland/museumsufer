import { createImageProxy } from "@museumsufer/core/image-proxy";

const ALLOWED_HOSTS = new Set([
  "www.astor-filmlounge.de",
  "astor-filmlounge.de",
  "www.arthouse-kinos.de",
  "www.arthouse-mainz.de",
  "www.orfeos.de",
  "www.dff.film",
  "dff.film",
  // Filmforum Höchst scraper produces .com (not .de) hostnames for
  // its wp-content uploads; keep both registered so historical scrape
  // data stays proxiable.
  "filmforum-hoechst.com",
  "www.filmforum-hoechst.com",
  "www.filmforum-hoechst.de",
  "filmforum-hoechst.de",
  "www.pupille.org",
  "pupille.org",
  "www.nipponconnection.com",
  // Nippon Connection runs a separate DB subdomain for poster art.
  "db.nipponconnection.com",
  // naxos.Kino serves film stills via the gk-download path of its CMS.
  "naxos-kino.de",
  "www.naxos-kino.de",
  "murnau-stiftung.de",
  "www.murnau-stiftung.de",
  "www.wiesbaden.de",
  "www.filmpalast-hofheim.de",
  "www.kino-kelkheim.de",
  "www.kronberger-lichtspiele.de",
  "www.kino-alte-muehle.de",
  "www.kino-koeppern.de",
  // The scraper sometimes records the same venue under the
  // hyphenless variant; keep both so the proxy doesn't drop them.
  "www.kinokoeppern.de",
  "www.kino-lichtblick.de",
  "www.rex-kino-darmstadt.de",
  "www.filmkreis.tu-darmstadt.de",
  "www.dfg-frankfurt.de",
  "tickets.cinetixx.de",
  // Cinetixx serves its CDN images from a separate hostname.
  "images.cinetixx.com",
  "www.kinoheld.de",
  // TMDb CDN — used by the hub's poster-enrichment pass for events
  // where the venue scraper didn't carry an image_url.
  "image.tmdb.org",
]);

// Off-list hosts get `undefined` (not the raw URL) so PosterCard
// renders the styled fallback instead of an <img> CSP would block.
export const { handleImageProxy, imageProxyUrl } = createImageProxy({
  userAgent: "lichtspiel.haus/1.0 (+https://frankfurt.lichtspiel.haus)",
  allowedHosts: ALLOWED_HOSTS,
  passthroughDisallowed: false,
});
