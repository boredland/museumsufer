export { type ProxyConfig, proxyFetch } from "./proxy";
export type {
  CanonicalScrapedEvent,
  ClassifierName,
  ScrapedLabel,
  ScraperContext,
  VenueScrapeResult,
  VenueScraper,
} from "./types";

import type { ScraperContext, VenueScraper } from "./types";
import { scrapeAlteOper } from "./venues/alte-oper";
import { scrapeAndreasKoehs } from "./venues/andreas-koehs";
import { scrapeBadHomburgSchloss } from "./venues/bad-homburg-schloss";
import { scrapeBadSoden } from "./venues/bad-soden";
import { scrapeBrotfabrik } from "./venues/brotfabrik";
import { scrapeBuergeruniversitaet } from "./venues/buergeruniversitaet";
import { scrapeDenkbar } from "./venues/denkbar";
import { scrapeDieKaes } from "./venues/die-kaes";
import { scrapeDieSchmiere } from "./venues/die-schmiere";
import { scrapeDigFrankfurt } from "./venues/dig-frankfurt";
import { scrapeDrHochs } from "./venues/dr-hochs";
import { scrapeEnglishTheatreFrankfurt } from "./venues/english-theatre-frankfurt";
import { scrapeEnsembleModern } from "./venues/ensemble-modern";
import { scrapeEvangelischeAkademie } from "./venues/evangelische-akademie";
import { scrapeFesHessen } from "./venues/fes-hessen";
import { scrapeFgzStreitclub } from "./venues/fgz-streitclub";
import { scrapeForschungskollegHumanwissenschaften } from "./venues/forschungskolleg-humanwissenschaften";
import { scrapeGalliTheater } from "./venues/galli-theater";
import { scrapeGallusTheater } from "./venues/gallus-theater";
import { scrapeHambacherSchloss } from "./venues/hambacher-schloss";
import { scrapeHausAmDom } from "./venues/haus-am-dom";
import { scrapeHfmdk } from "./venues/hfmdk";
import { scrapeHolzhausenschloesschen } from "./venues/holzhausenschloesschen";
import { scrapeHrBigband } from "./venues/hr-bigband";
import { scrapeHrSinfonieorchester } from "./venues/hr-sinfonieorchester";
import { scrapeInstitutFuerSozialforschung } from "./venues/institut-fuer-sozialforschung";
import { scrapeJazzFrankfurt } from "./venues/jazz-frankfurt";
import { scrapeJazzPalmengarten } from "./venues/jazz-palmengarten";
import { scrapeJuedischeGemeinde } from "./venues/juedische-gemeinde-frankfurt";
import { scrapeKellertheaterFrankfurt } from "./venues/kellertheater-frankfurt";
import { scrapeKirchenmusikDreikoenig } from "./venues/kirchenmusik-dreikoenig";
import { scrapeKomoedieFrankfurt } from "./venues/komoedie-frankfurt";
import { scrapeKronbergAcademy } from "./venues/kronberg-academy";
import { scrapeKulturnetzLandau } from "./venues/kulturnetz-landau";
import { scrapeLandauDe } from "./venues/landau-de";
import { scrapeLiteraturhaus } from "./venues/literaturhaus-frankfurt";
import { scrapeMousonturm } from "./venues/mousonturm";
import { scrapeMusikschuleFrankfurt } from "./venues/musikschule-frankfurt";
import { scrapeNaxos } from "./venues/naxos";
import { scrapeNeuesTheaterHoechst } from "./venues/neues-theater-hoechst";
import { scrapeNormativeOrders } from "./venues/normative-orders";
import { scrapeOpenBooks } from "./venues/openbooks-frankfurt";
import { scrapeOper } from "./venues/oper";
import { scrapePapagenoMusiktheater } from "./venues/papageno-musiktheater";
import { scrapePfalzDe } from "./venues/pfalz-de";
import { scrapePolytechnische } from "./venues/polytechnische";
import { scrapeRheingauFestival } from "./venues/rheingau-festival";
import { scrapeRlsHessen } from "./venues/rls-hessen";
import { scrapeRoemerberggespraeche } from "./venues/roemerberggespraeche";
import { scrapeRomanfabrik } from "./venues/romanfabrik";
import { scrapeRptuCampuskultur } from "./venues/rptu-campuskultur";
import { scrapeSigmundFreudInstitut } from "./venues/sigmund-freud-institut";
import { scrapeStadtbuechereiFrankfurt } from "./venues/stadtbuecherei-frankfurt";
import { scrapeStalburgTheater } from "./venues/stalburg-theater";
import { scrapeStKatharinen } from "./venues/stk-musik";
import { scrapeSuew } from "./venues/suew";
import { scrapeTheaterAlteBruecke } from "./venues/theater-alte-bruecke";
import { scrapeTheaterhausFrankfurt } from "./venues/theaterhaus-frankfurt";
import { scrapeTigerpalastVariete } from "./venues/tigerpalast-variete";
import { scrapeWaggong } from "./venues/waggong";

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
  { slug: "bad-homburger-schlosskonzerte", run: (_ctx: ScraperContext) => scrapeBadHomburgSchloss() },
  { slug: "bad-soden", run: (_ctx: ScraperContext) => scrapeBadSoden() },
  { slug: "brotfabrik", run: (_ctx: ScraperContext) => scrapeBrotfabrik() },
  { slug: "buergeruniversitaet", run: (_ctx: ScraperContext) => scrapeBuergeruniversitaet() },
  { slug: "denkbar-frankfurt", run: (_ctx: ScraperContext) => scrapeDenkbar() },
  { slug: "die-kaes", run: (_ctx: ScraperContext) => scrapeDieKaes() },
  { slug: "die-schmiere", run: (_ctx: ScraperContext) => scrapeDieSchmiere() },
  { slug: "dig-frankfurt", run: (_ctx: ScraperContext) => scrapeDigFrankfurt() },
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
  { slug: "galli-theater", run: (_ctx: ScraperContext) => scrapeGalliTheater() },
  { slug: "gallus-theater", run: (_ctx: ScraperContext) => scrapeGallusTheater() },
  { slug: "hambacher-schloss", run: (_ctx: ScraperContext) => scrapeHambacherSchloss() },
  { slug: "haus-am-dom", run: (_ctx: ScraperContext) => scrapeHausAmDom() },
  { slug: "hfmdk", run: (_ctx: ScraperContext) => scrapeHfmdk() },
  { slug: "holzhausenschloesschen", run: (_ctx: ScraperContext) => scrapeHolzhausenschloesschen() },
  { slug: "hr-bigband", run: (_ctx: ScraperContext) => scrapeHrBigband() },
  { slug: "hr-sinfonieorchester", run: (_ctx: ScraperContext) => scrapeHrSinfonieorchester() },
  { slug: "institut-fuer-sozialforschung", run: (_ctx: ScraperContext) => scrapeInstitutFuerSozialforschung() },
  { slug: "jazz-frankfurt", run: (_ctx: ScraperContext) => scrapeJazzFrankfurt() },
  { slug: "jazz-palmengarten", run: (_ctx: ScraperContext) => scrapeJazzPalmengarten() },
  { slug: "juedische-gemeinde-frankfurt", run: (_ctx: ScraperContext) => scrapeJuedischeGemeinde() },
  { slug: "kellertheater-frankfurt", run: (_ctx: ScraperContext) => scrapeKellertheaterFrankfurt() },
  { slug: "kirchenmusik-dreikoenig", run: (_ctx: ScraperContext) => scrapeKirchenmusikDreikoenig() },
  { slug: "komoedie-frankfurt", run: (_ctx: ScraperContext) => scrapeKomoedieFrankfurt() },
  { slug: "kronberg-academy", run: (_ctx: ScraperContext) => scrapeKronbergAcademy() },
  { slug: "kulturnetz-landau", run: (_ctx: ScraperContext) => scrapeKulturnetzLandau() },
  { slug: "landau-de", run: (_ctx: ScraperContext) => scrapeLandauDe() },
  { slug: "literaturhaus-frankfurt", run: (_ctx: ScraperContext) => scrapeLiteraturhaus() },
  { slug: "mousonturm", run: (_ctx: ScraperContext) => scrapeMousonturm() },
  { slug: "musikschule-frankfurt", run: (_ctx: ScraperContext) => scrapeMusikschuleFrankfurt() },
  { slug: "naxos-hallenkonzerte", run: (_ctx: ScraperContext) => scrapeNaxos() },
  { slug: "neues-theater-hoechst", run: (_ctx: ScraperContext) => scrapeNeuesTheaterHoechst() },
  { slug: "normative-orders", run: (_ctx: ScraperContext) => scrapeNormativeOrders() },
  { slug: "openbooks-frankfurt", run: (_ctx: ScraperContext) => scrapeOpenBooks() },
  { slug: "oper-frankfurt", run: (_ctx: ScraperContext) => scrapeOper() },
  { slug: "papageno-musiktheater", run: (_ctx: ScraperContext) => scrapePapagenoMusiktheater() },
  { slug: "pfalz-de", run: (_ctx: ScraperContext) => scrapePfalzDe() },
  { slug: "polytechnische-gesellschaft", run: (_ctx: ScraperContext) => scrapePolytechnische() },
  { slug: "rheingau-musikfestival", run: (_ctx: ScraperContext) => scrapeRheingauFestival() },
  { slug: "rls-hessen", run: (_ctx: ScraperContext) => scrapeRlsHessen() },
  { slug: "roemerberggespraeche", run: (_ctx: ScraperContext) => scrapeRoemerberggespraeche() },
  { slug: "romanfabrik", run: (_ctx: ScraperContext) => scrapeRomanfabrik() },
  { slug: "rptu-campuskultur", run: (_ctx: ScraperContext) => scrapeRptuCampuskultur() },
  { slug: "sigmund-freud-institut", run: (_ctx: ScraperContext) => scrapeSigmundFreudInstitut() },
  { slug: "st-katharinen", run: (_ctx: ScraperContext) => scrapeStKatharinen() },
  { slug: "stadtbuecherei-frankfurt", run: (ctx: ScraperContext) => scrapeStadtbuechereiFrankfurt(ctx.proxy) },
  { slug: "stalburg-theater", run: (_ctx: ScraperContext) => scrapeStalburgTheater() },
  { slug: "suew", run: (_ctx: ScraperContext) => scrapeSuew() },
  { slug: "theater-alte-bruecke", run: (_ctx: ScraperContext) => scrapeTheaterAlteBruecke() },
  { slug: "theaterhaus-frankfurt", run: (_ctx: ScraperContext) => scrapeTheaterhausFrankfurt() },
  { slug: "tigerpalast-variete", run: (_ctx: ScraperContext) => scrapeTigerpalastVariete() },
  { slug: "waggong", run: (_ctx: ScraperContext) => scrapeWaggong() },
];

export {
  scrapeAlteOper,
  scrapeAndreasKoehs,
  scrapeBadHomburgSchloss,
  scrapeBadSoden,
  scrapeBrotfabrik,
  scrapeBuergeruniversitaet,
  scrapeDenkbar,
  scrapeDieKaes,
  scrapeDieSchmiere,
  scrapeDigFrankfurt,
  scrapeDrHochs,
  scrapeEnglishTheatreFrankfurt,
  scrapeEnsembleModern,
  scrapeEvangelischeAkademie,
  scrapeFesHessen,
  scrapeFgzStreitclub,
  scrapeForschungskollegHumanwissenschaften,
  scrapeGalliTheater,
  scrapeGallusTheater,
  scrapeHambacherSchloss,
  scrapeHausAmDom,
  scrapeHfmdk,
  scrapeHolzhausenschloesschen,
  scrapeHrBigband,
  scrapeHrSinfonieorchester,
  scrapeInstitutFuerSozialforschung,
  scrapeJazzFrankfurt,
  scrapeJazzPalmengarten,
  scrapeJuedischeGemeinde,
  scrapeKellertheaterFrankfurt,
  scrapeKirchenmusikDreikoenig,
  scrapeKomoedieFrankfurt,
  scrapeKronbergAcademy,
  scrapeKulturnetzLandau,
  scrapeLandauDe,
  scrapeLiteraturhaus,
  scrapeMousonturm,
  scrapeMusikschuleFrankfurt,
  scrapeNaxos,
  scrapeNeuesTheaterHoechst,
  scrapeNormativeOrders,
  scrapeOpenBooks,
  scrapeOper,
  scrapePapagenoMusiktheater,
  scrapePfalzDe,
  scrapePolytechnische,
  scrapeRheingauFestival,
  scrapeRlsHessen,
  scrapeRoemerberggespraeche,
  scrapeRomanfabrik,
  scrapeRptuCampuskultur,
  scrapeSigmundFreudInstitut,
  scrapeStadtbuechereiFrankfurt,
  scrapeStalburgTheater,
  scrapeStKatharinen,
  scrapeSuew,
  scrapeTheaterAlteBruecke,
  scrapeTheaterhausFrankfurt,
  scrapeTigerpalastVariete,
  scrapeWaggong,
};
