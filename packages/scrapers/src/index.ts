export { MUSEUM_SLUGS } from "./_museums/config";
export { type ProxyConfig, proxyFetch } from "./proxy";
export { THEATER_SLUGS } from "./theater-slugs";
export type {
  CanonicalScrapedEvent,
  ClassifierName,
  ScrapedLabel,
  ScraperContext,
  VenueScrapeResult,
  VenueScraper,
} from "./types";
export {
  type Bbox,
  coordinatesFor,
  FRANKFURT_BBOX,
  GEOFENCE_BBOX,
  inBbox,
  LANDAU_BBOX,
  VENUE_COORDS,
  withinGeofence,
} from "./venue-coords";

import type { ScraperContext, VenueScraper } from "./types";
import { scrapeMuseumsFrankfurt } from "./venues/_museums-frankfurt";
import { scrapeStiftungHg } from "./venues/_stiftung-hg";
import { scrapeAlteOper } from "./venues/alte-oper";
import { scrapeAndreasKoehs } from "./venues/andreas-koehs";
import { scrapeAutorenbuchhandlungMarx } from "./venues/autorenbuchhandlung-marx";
import { scrapeBadHomburgSchloss } from "./venues/bad-homburg-schloss";
import { scrapeBadSoden } from "./venues/bad-soden";
import { scrapeBnaiBrithFrankfurt } from "./venues/bnai-brith-frankfurt";
import { scrapeBoellHessen } from "./venues/boell-hessen";
import { scrapeBrotfabrik } from "./venues/brotfabrik";
import { scrapeBuergeruniversitaet } from "./venues/buergeruniversitaet";
import { scrapeCrespoFoundation } from "./venues/crespo-foundation";
import { scrapeDenkbar } from "./venues/denkbar";
import { scrapeDieKaes } from "./venues/die-kaes";
import { scrapeDieSchmiere } from "./venues/die-schmiere";
import { scrapeDigFrankfurt } from "./venues/dig-frankfurt";
import { scrapeDrHochs } from "./venues/dr-hochs";
import { scrapeDramatischeBuehne } from "./venues/dramatische-buehne";
import { scrapeDresdenFrankfurtDanceCompany } from "./venues/dresden-frankfurt-dance-company";
import { scrapeEnglishTheatreFrankfurt } from "./venues/english-theatre-frankfurt";
import { scrapeEnsembleModern } from "./venues/ensemble-modern";
import { scrapeEvangelischeAkademie } from "./venues/evangelische-akademie";
import { scrapeFesHessen } from "./venues/fes-hessen";
import { scrapeFgzStreitclub } from "./venues/fgz-streitclub";
import { scrapeForschungskollegHumanwissenschaften } from "./venues/forschungskolleg-humanwissenschaften";
import { scrapeFrankfurtUas } from "./venues/frankfurt-uas";
import { scrapeGalliTheater } from "./venues/galli-theater";
import { scrapeGallusTheater } from "./venues/gallus-theater";
import { scrapeHambacherSchloss } from "./venues/hambacher-schloss";
import { scrapeHausAmDom } from "./venues/haus-am-dom";
import { scrapeHfmdk } from "./venues/hfmdk";
import { scrapeHolzhausenschloesschen } from "./venues/holzhausenschloesschen";
import { scrapeHrBigband } from "./venues/hr-bigband";
import { scrapeHrSinfonieorchester } from "./venues/hr-sinfonieorchester";
import { scrapeHsfkFrankfurt } from "./venues/hsfk-frankfurt";
import { scrapeInstitutFrancaisFrankfurt } from "./venues/institut-francais-frankfurt";
import { scrapeInstitutFuerSozialforschung } from "./venues/institut-fuer-sozialforschung";
import { scrapeInstitutoCervantesFrankfurt } from "./venues/instituto-cervantes-frankfurt";
import { scrapeInternationalesTheater } from "./venues/internationales-theater";
import { scrapeJazzFrankfurt } from "./venues/jazz-frankfurt";
import { scrapeJazzPalmengarten } from "./venues/jazz-palmengarten";
import { scrapeJuedischeGemeinde } from "./venues/juedische-gemeinde-frankfurt";
import { scrapeKarlMarxBuchhandlung } from "./venues/karl-marx-buchhandlung";
import { scrapeKellertheaterFrankfurt } from "./venues/kellertheater-frankfurt";
import { scrapeKirchenmusikDreikoenig } from "./venues/kirchenmusik-dreikoenig";
import { scrapeKomoedieFrankfurt } from "./venues/komoedie-frankfurt";
import { scrapeKronbergAcademy } from "./venues/kronberg-academy";
import { scrapeKulturnetzLandau } from "./venues/kulturnetz-landau";
import { scrapeLandauDe } from "./venues/landau-de";
import { scrapeLandinsichtBuchladen } from "./venues/landinsicht-buchladen";
import { scrapeLandungsbruecken } from "./venues/landungsbruecken";
import { scrapeLiteraturhaus } from "./venues/literaturhaus-frankfurt";
import { scrapeMousonturm } from "./venues/mousonturm";
import { scrapeMusikschuleFrankfurt } from "./venues/musikschule-frankfurt";
import { scrapeNaxos } from "./venues/naxos";
import { scrapeNeuesTheaterHoechst } from "./venues/neues-theater-hoechst";
import { scrapeNormativeOrders } from "./venues/normative-orders";
import { scrapeOpenBooks } from "./venues/openbooks-frankfurt";
import { scrapeOperFrankfurt } from "./venues/oper-frankfurt";
import { scrapeOperFrankfurtKonzerte } from "./venues/oper-frankfurt-konzerte";
import { scrapePapagenoMusiktheater } from "./venues/papageno-musiktheater";
import { scrapePfalzDe } from "./venues/pfalz-de";
import { scrapePolytechnische } from "./venues/polytechnische";
import { scrapeRheingauFestival } from "./venues/rheingau-festival";
import { scrapeRlsHessen } from "./venues/rls-hessen";
import { scrapeRoemerberggespraeche } from "./venues/roemerberggespraeche";
import { scrapeRomanfabrik } from "./venues/romanfabrik";
import { scrapeRptuCampuskultur } from "./venues/rptu-campuskultur";
import { scrapeSchauspielFrankfurt } from "./venues/schauspiel-frankfurt";
import { scrapeSigmundFreudInstitut } from "./venues/sigmund-freud-institut";
import { scrapeStadtbuechereiFrankfurt } from "./venues/stadtbuecherei-frankfurt";
import { scrapeStalburgTheater } from "./venues/stalburg-theater";
import { scrapeStKatharinen } from "./venues/stk-musik";
import { scrapeSuew } from "./venues/suew";
import { scrapeTheaterAlteBruecke } from "./venues/theater-alte-bruecke";
import { scrapeTheaterLempenfieber } from "./venues/theater-lempenfieber";
import { scrapeTheaterWillyPraml } from "./venues/theater-willy-praml";
import { scrapeTheaterhausFrankfurt } from "./venues/theaterhaus-frankfurt";
import { scrapeTigerpalastVariete } from "./venues/tigerpalast-variete";
import { scrapeUnionClubFrankfurt } from "./venues/union-club-frankfurt";
import { scrapeVolksbuehneFrankfurt } from "./venues/volksbuehne-frankfurt";
import { scrapeWaggong } from "./venues/waggong";
import { scrapeYpsilonBuchladen } from "./venues/ypsilon-buchladen";

/**
 * The set of canonical hub scrapers. Each emits canonical-shaped events
 * with multi-label tags so the hub's classifier pass can augment them
 * before persisting. Apps continue to maintain their own per-venue
 * scrapers during the parallel-run window; this catalogue grows as
 * individual venues migrate over.
 */
export const VENUE_SCRAPERS: ReadonlyArray<{ slug: string; run: VenueScraper }> = [
  { slug: "alte-oper", run: (_ctx: ScraperContext) => scrapeAlteOper() },
  { slug: "andreas-koehs", run: (_ctx: ScraperContext) => scrapeAndreasKoehs() },
  { slug: "autorenbuchhandlung-marx", run: (_ctx: ScraperContext) => scrapeAutorenbuchhandlungMarx() },
  { slug: "bad-homburger-schlosskonzerte", run: (_ctx: ScraperContext) => scrapeBadHomburgSchloss() },
  { slug: "bad-soden", run: (_ctx: ScraperContext) => scrapeBadSoden() },
  { slug: "bnai-brith-frankfurt", run: (_ctx: ScraperContext) => scrapeBnaiBrithFrankfurt() },
  { slug: "boell-hessen", run: (_ctx: ScraperContext) => scrapeBoellHessen() },
  { slug: "brotfabrik", run: (_ctx: ScraperContext) => scrapeBrotfabrik() },
  { slug: "buergeruniversitaet", run: (_ctx: ScraperContext) => scrapeBuergeruniversitaet() },
  { slug: "crespo-foundation", run: (_ctx: ScraperContext) => scrapeCrespoFoundation() },
  { slug: "denkbar-frankfurt", run: (_ctx: ScraperContext) => scrapeDenkbar() },
  { slug: "die-kaes", run: (_ctx: ScraperContext) => scrapeDieKaes() },
  { slug: "die-schmiere", run: (_ctx: ScraperContext) => scrapeDieSchmiere() },
  { slug: "dig-frankfurt", run: (_ctx: ScraperContext) => scrapeDigFrankfurt() },
  { slug: "dramatische-buehne", run: (_ctx: ScraperContext) => scrapeDramatischeBuehne() },
  { slug: "dresden-frankfurt-dance-company", run: (_ctx: ScraperContext) => scrapeDresdenFrankfurtDanceCompany() },
  { slug: "dr-hochs-konservatorium", run: (_ctx: ScraperContext) => scrapeDrHochs() },
  { slug: "english-theatre-frankfurt", run: (_ctx: ScraperContext) => scrapeEnglishTheatreFrankfurt() },
  { slug: "ensemble-modern", run: (_ctx: ScraperContext) => scrapeEnsembleModern() },
  { slug: "evangelische-akademie-frankfurt", run: (_ctx: ScraperContext) => scrapeEvangelischeAkademie() },
  { slug: "fes-hessen", run: (_ctx: ScraperContext) => scrapeFesHessen() },
  { slug: "fgz-streitclub", run: (_ctx: ScraperContext) => scrapeFgzStreitclub() },
  {
    slug: "forschungskolleg-humanwissenschaften",
    run: (_ctx: ScraperContext) => scrapeForschungskollegHumanwissenschaften(),
  },
  { slug: "frankfurt-uas", run: (_ctx: ScraperContext) => scrapeFrankfurtUas() },
  { slug: "galli-theater", run: (_ctx: ScraperContext) => scrapeGalliTheater() },
  { slug: "gallus-theater", run: (_ctx: ScraperContext) => scrapeGallusTheater() },
  { slug: "hambacher-schloss", run: (_ctx: ScraperContext) => scrapeHambacherSchloss() },
  { slug: "haus-am-dom", run: (_ctx: ScraperContext) => scrapeHausAmDom() },
  { slug: "hfmdk", run: (_ctx: ScraperContext) => scrapeHfmdk() },
  { slug: "holzhausenschloesschen", run: (_ctx: ScraperContext) => scrapeHolzhausenschloesschen() },
  { slug: "hr-bigband", run: (_ctx: ScraperContext) => scrapeHrBigband() },
  { slug: "hr-sinfonieorchester", run: (_ctx: ScraperContext) => scrapeHrSinfonieorchester() },
  { slug: "hsfk-frankfurt", run: (_ctx: ScraperContext) => scrapeHsfkFrankfurt() },
  { slug: "institut-francais-frankfurt", run: (_ctx: ScraperContext) => scrapeInstitutFrancaisFrankfurt() },
  { slug: "institut-fuer-sozialforschung", run: (_ctx: ScraperContext) => scrapeInstitutFuerSozialforschung() },
  { slug: "instituto-cervantes-frankfurt", run: (_ctx: ScraperContext) => scrapeInstitutoCervantesFrankfurt() },
  { slug: "internationales-theater", run: (_ctx: ScraperContext) => scrapeInternationalesTheater() },
  { slug: "jazz-frankfurt", run: (_ctx: ScraperContext) => scrapeJazzFrankfurt() },
  { slug: "jazz-palmengarten", run: (_ctx: ScraperContext) => scrapeJazzPalmengarten() },
  { slug: "juedische-gemeinde-frankfurt", run: (_ctx: ScraperContext) => scrapeJuedischeGemeinde() },
  { slug: "karl-marx-buchhandlung", run: (_ctx: ScraperContext) => scrapeKarlMarxBuchhandlung() },
  { slug: "kellertheater-frankfurt", run: (_ctx: ScraperContext) => scrapeKellertheaterFrankfurt() },
  { slug: "kirchenmusik-dreikoenig", run: (_ctx: ScraperContext) => scrapeKirchenmusikDreikoenig() },
  { slug: "komoedie-frankfurt", run: (_ctx: ScraperContext) => scrapeKomoedieFrankfurt() },
  { slug: "kronberg-academy", run: (_ctx: ScraperContext) => scrapeKronbergAcademy() },
  { slug: "kulturnetz-landau", run: (_ctx: ScraperContext) => scrapeKulturnetzLandau() },
  { slug: "landau-de", run: (_ctx: ScraperContext) => scrapeLandauDe() },
  { slug: "landinsicht-buchladen", run: (_ctx: ScraperContext) => scrapeLandinsichtBuchladen() },
  { slug: "landungsbruecken", run: (_ctx: ScraperContext) => scrapeLandungsbruecken() },
  { slug: "literaturhaus-frankfurt", run: (_ctx: ScraperContext) => scrapeLiteraturhaus() },
  { slug: "mousonturm", run: (_ctx: ScraperContext) => scrapeMousonturm() },
  { slug: "museums-frankfurt", run: (ctx: ScraperContext) => scrapeMuseumsFrankfurt(ctx) },
  { slug: "stiftung-hg", run: (_ctx: ScraperContext) => scrapeStiftungHg() },
  { slug: "musikschule-frankfurt", run: (_ctx: ScraperContext) => scrapeMusikschuleFrankfurt() },
  { slug: "naxos-hallenkonzerte", run: (_ctx: ScraperContext) => scrapeNaxos() },
  { slug: "neues-theater-hoechst", run: (_ctx: ScraperContext) => scrapeNeuesTheaterHoechst() },
  { slug: "normative-orders", run: (_ctx: ScraperContext) => scrapeNormativeOrders() },
  { slug: "openbooks-frankfurt", run: (_ctx: ScraperContext) => scrapeOpenBooks() },
  { slug: "oper-frankfurt", run: (_ctx: ScraperContext) => scrapeOperFrankfurt() },
  { slug: "oper-frankfurt-konzerte", run: (_ctx: ScraperContext) => scrapeOperFrankfurtKonzerte() },
  { slug: "papageno-musiktheater", run: (_ctx: ScraperContext) => scrapePapagenoMusiktheater() },
  { slug: "pfalz-de", run: (_ctx: ScraperContext) => scrapePfalzDe() },
  { slug: "polytechnische-gesellschaft", run: (_ctx: ScraperContext) => scrapePolytechnische() },
  { slug: "rheingau-musikfestival", run: (_ctx: ScraperContext) => scrapeRheingauFestival() },
  { slug: "rls-hessen", run: (_ctx: ScraperContext) => scrapeRlsHessen() },
  { slug: "roemerberggespraeche", run: (_ctx: ScraperContext) => scrapeRoemerberggespraeche() },
  { slug: "romanfabrik", run: (_ctx: ScraperContext) => scrapeRomanfabrik() },
  { slug: "rptu-campuskultur", run: (_ctx: ScraperContext) => scrapeRptuCampuskultur() },
  { slug: "schauspiel-frankfurt", run: (_ctx: ScraperContext) => scrapeSchauspielFrankfurt() },
  { slug: "sigmund-freud-institut", run: (_ctx: ScraperContext) => scrapeSigmundFreudInstitut() },
  { slug: "st-katharinen", run: (_ctx: ScraperContext) => scrapeStKatharinen() },
  { slug: "stadtbuecherei-frankfurt", run: (ctx: ScraperContext) => scrapeStadtbuechereiFrankfurt(ctx.proxy) },
  { slug: "stalburg-theater", run: (_ctx: ScraperContext) => scrapeStalburgTheater() },
  { slug: "suew", run: (_ctx: ScraperContext) => scrapeSuew() },
  { slug: "theater-alte-bruecke", run: (_ctx: ScraperContext) => scrapeTheaterAlteBruecke() },
  { slug: "theater-lempenfieber", run: (_ctx: ScraperContext) => scrapeTheaterLempenfieber() },
  { slug: "theater-willy-praml", run: (_ctx: ScraperContext) => scrapeTheaterWillyPraml() },
  { slug: "theaterhaus-frankfurt", run: (_ctx: ScraperContext) => scrapeTheaterhausFrankfurt() },
  { slug: "tigerpalast-variete", run: (_ctx: ScraperContext) => scrapeTigerpalastVariete() },
  { slug: "union-club-frankfurt", run: (_ctx: ScraperContext) => scrapeUnionClubFrankfurt() },
  { slug: "volksbuehne-frankfurt", run: (_ctx: ScraperContext) => scrapeVolksbuehneFrankfurt() },
  { slug: "waggong", run: (_ctx: ScraperContext) => scrapeWaggong() },
  { slug: "ypsilon-buchladen", run: (_ctx: ScraperContext) => scrapeYpsilonBuchladen() },
];

export {
  scrapeAlteOper,
  scrapeAndreasKoehs,
  scrapeAutorenbuchhandlungMarx,
  scrapeBadHomburgSchloss,
  scrapeBadSoden,
  scrapeBnaiBrithFrankfurt,
  scrapeBoellHessen,
  scrapeBrotfabrik,
  scrapeBuergeruniversitaet,
  scrapeCrespoFoundation,
  scrapeDenkbar,
  scrapeDieKaes,
  scrapeDieSchmiere,
  scrapeDigFrankfurt,
  scrapeDramatischeBuehne,
  scrapeDresdenFrankfurtDanceCompany,
  scrapeDrHochs,
  scrapeEnglishTheatreFrankfurt,
  scrapeEnsembleModern,
  scrapeEvangelischeAkademie,
  scrapeFesHessen,
  scrapeFgzStreitclub,
  scrapeForschungskollegHumanwissenschaften,
  scrapeFrankfurtUas,
  scrapeGalliTheater,
  scrapeGallusTheater,
  scrapeHambacherSchloss,
  scrapeHausAmDom,
  scrapeHfmdk,
  scrapeHolzhausenschloesschen,
  scrapeHrBigband,
  scrapeHrSinfonieorchester,
  scrapeHsfkFrankfurt,
  scrapeInstitutFrancaisFrankfurt,
  scrapeInstitutFuerSozialforschung,
  scrapeInstitutoCervantesFrankfurt,
  scrapeInternationalesTheater,
  scrapeJazzFrankfurt,
  scrapeJazzPalmengarten,
  scrapeJuedischeGemeinde,
  scrapeKarlMarxBuchhandlung,
  scrapeKellertheaterFrankfurt,
  scrapeKirchenmusikDreikoenig,
  scrapeKomoedieFrankfurt,
  scrapeKronbergAcademy,
  scrapeKulturnetzLandau,
  scrapeLandauDe,
  scrapeLandinsichtBuchladen,
  scrapeLandungsbruecken,
  scrapeLiteraturhaus,
  scrapeMousonturm,
  scrapeMuseumsFrankfurt,
  scrapeMusikschuleFrankfurt,
  scrapeNaxos,
  scrapeNeuesTheaterHoechst,
  scrapeNormativeOrders,
  scrapeOpenBooks,
  scrapeOperFrankfurt,
  scrapeOperFrankfurtKonzerte,
  scrapePapagenoMusiktheater,
  scrapePfalzDe,
  scrapePolytechnische,
  scrapeRheingauFestival,
  scrapeRlsHessen,
  scrapeRoemerberggespraeche,
  scrapeRomanfabrik,
  scrapeRptuCampuskultur,
  scrapeSchauspielFrankfurt,
  scrapeSigmundFreudInstitut,
  scrapeStadtbuechereiFrankfurt,
  scrapeStalburgTheater,
  scrapeStKatharinen,
  scrapeSuew,
  scrapeTheaterAlteBruecke,
  scrapeTheaterhausFrankfurt,
  scrapeTheaterLempenfieber,
  scrapeTheaterWillyPraml,
  scrapeTigerpalastVariete,
  scrapeUnionClubFrankfurt,
  scrapeVolksbuehneFrankfurt,
  scrapeWaggong,
  scrapeYpsilonBuchladen,
};
