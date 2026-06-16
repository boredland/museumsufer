export { MUSEUM_SLUGS, MUSEUMS } from "./_museums/config";
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
  HAMBURG_BBOX,
  inBbox,
  LANDAU_BBOX,
  VENUE_COORDS,
  withinGeofence,
} from "./venue-coords";

import type { ScraperContext, VenueScraper } from "./types";
import { scrapeCineamo } from "./venues/_cineamo";
import { scrapeKinoheld } from "./venues/_kinoheld";
import { scrapeMeetup } from "./venues/_meetup";
import { scrapeMuseumsFrankfurt } from "./venues/_museums-frankfurt";
import { scrapeStiftungHg } from "./venues/_stiftung-hg";
import { scrapeWdc2026 } from "./venues/_wdc2026";
import { scrapeAlabamaKino } from "./venues/alabama-kino";
import { scrapeAlmaHoppesLustspielhaus } from "./venues/alma-hoppes-lustspielhaus";
import { scrapeAlteOper } from "./venues/alte-oper";
import { scrapeAltonaerTheater } from "./venues/altonaer-theater";
import { scrapeAndreasKoehs } from "./venues/andreas-koehs";
import { scrapeArthouseKinos } from "./venues/arthouse-kinos";
import { scrapeAstorFrankfurt } from "./venues/astor-frankfurt";
import { scrapeAstorHafencity } from "./venues/astor-hafencity";
import { scrapeAutorenbuchhandlungMarx } from "./venues/autorenbuchhandlung-marx";
import { scrapeBadHomburgSchloss } from "./venues/bad-homburg-schloss";
import { scrapeBadSoden } from "./venues/bad-soden";
import { scrapeBnaiBrithFrankfurt } from "./venues/bnai-brith-frankfurt";
import { scrapeBoellHessen } from "./venues/boell-hessen";
import { scrapeBrotfabrik } from "./venues/brotfabrik";
import { scrapeBuergeruniversitaet } from "./venues/buergeruniversitaet";
import { scrapeCaligariWiesbaden } from "./venues/caligari-wiesbaden";
import { scrapeCentralkomitee } from "./venues/centralkomitee";
import { scrapeClubVoltaire } from "./venues/club-voltaire";
import { scrapeCrespoFoundation } from "./venues/crespo-foundation";
import { scrapeDeichtorhallen } from "./venues/deichtorhallen";
import { scrapeDenkbar } from "./venues/denkbar";
import { scrapeDeutschesSchauspielhaus } from "./venues/deutsches-schauspielhaus";
import { scrapeDfgFrankfurt } from "./venues/dfg-frankfurt";
import { scrapeDieKaes } from "./venues/die-kaes";
import { scrapeDieSchmiere } from "./venues/die-schmiere";
import { scrapeDigFrankfurt } from "./venues/dig-frankfurt";
import { scrapeDrHochs } from "./venues/dr-hochs";
import { scrapeDramatischeBuehne } from "./venues/dramatische-buehne";
import { scrapeDresdenFrankfurtDanceCompany } from "./venues/dresden-frankfurt-dance-company";
import { scrapeEnglishTheatreFrankfurt } from "./venues/english-theatre-frankfurt";
import { scrapeEnglishTheatreHamburg } from "./venues/english-theatre-hamburg";
import { scrapeEnsembleModern } from "./venues/ensemble-modern";
import { scrapeErnstDeutschTheater } from "./venues/ernst-deutsch-theater";
import { scrapeEschbornK } from "./venues/eschborn-k";
import { scrapeEvangelischeAkademie } from "./venues/evangelische-akademie";
import { scrapeFesHessen } from "./venues/fes-hessen";
import { scrapeFgzStreitclub } from "./venues/fgz-streitclub";
import { scrapeFilmforumHoechst } from "./venues/filmforum-hoechst";
import { scrapeFilmkreisDarmstadt } from "./venues/filmkreis-darmstadt";
import { scrapeFirstStageTheater } from "./venues/first-stage-theater";
import { scrapeForschungskollegHumanwissenschaften } from "./venues/forschungskolleg-humanwissenschaften";
import { scrapeFrankfurtUas } from "./venues/frankfurt-uas";
import { scrapeFrankfurterSparkasse } from "./venues/frankfurter-sparkasse";
import { scrapeFundusTheater } from "./venues/fundus-theater";
import { scrapeGalliTheater } from "./venues/galli-theater";
import { scrapeGallusTheater } from "./venues/gallus-theater";
import { scrapeHafen2 } from "./venues/hafen-2-offenbach";
import { scrapeHambacherSchloss } from "./venues/hambacher-schloss";
import { scrapeHamburgerKammeroper } from "./venues/hamburger-kammeroper";
import { scrapeHamburgerKammerspiele } from "./venues/hamburger-kammerspiele";
import { scrapeHamburgerKunsthalle } from "./venues/hamburger-kunsthalle";
import { scrapeHamburgerPuppentheater } from "./venues/hamburger-puppentheater";
import { scrapeHamburgerSprechwerk } from "./venues/hamburger-sprechwerk";
import { scrapeHamburgischeStaatsoper } from "./venues/hamburgische-staatsoper";
import { scrapeHansaTheater } from "./venues/hansa-theater";
import { scrapeHarburgerTheater } from "./venues/harburger-theater";
import { scrapeHausAmDom } from "./venues/haus-am-dom";
import { scrapeHessischesStaatsballett } from "./venues/hessisches-staatsballett";
import { scrapeHfmdk } from "./venues/hfmdk";
import { scrapeHoheLuftschiff } from "./venues/hohe-luft-schiff";
import { scrapeHolzhausenschloesschen } from "./venues/holzhausenschloesschen";
import { scrapeHrBigband } from "./venues/hr-bigband";
import { scrapeHrSinfonieorchester } from "./venues/hr-sinfonieorchester";
import { scrapeHsfkFrankfurt } from "./venues/hsfk-frankfurt";
import { scrapeImperialTheater } from "./venues/imperial-theater";
import { scrapeInstitutFrancaisFrankfurt } from "./venues/institut-francais-frankfurt";
import { scrapeInstitutFuerSozialforschung } from "./venues/institut-fuer-sozialforschung";
import { scrapeInstitutoCervantesFrankfurt } from "./venues/instituto-cervantes-frankfurt";
import { scrapeInternationalesTheater } from "./venues/internationales-theater";
import { scrapeJazzFrankfurt } from "./venues/jazz-frankfurt";
import { scrapeJazzPalmengarten } from "./venues/jazz-palmengarten";
import { scrapeJazzkeller } from "./venues/jazzkeller";
import { scrapeJuedischeGemeinde } from "./venues/juedische-gemeinde-frankfurt";
import { scrapeKampnagel } from "./venues/kampnagel";
import { scrapeKarlMarxBuchhandlung } from "./venues/karl-marx-buchhandlung";
import { scrapeKellertheaterFrankfurt } from "./venues/kellertheater-frankfurt";
import { scrapeKinoKoeppern } from "./venues/kino-koeppern";
import { scrapeKirchenmusikDreikoenig } from "./venues/kirchenmusik-dreikoenig";
import { scrapeKomoedieFrankfurt } from "./venues/komoedie-frankfurt";
import { scrapeKomoedieWinterhuderFaehrhaus } from "./venues/komoedie-winterhuder-faehrhaus";
import { scrapeKronbergAcademy } from "./venues/kronberg-academy";
import { scrapeKulturnetzLandau } from "./venues/kulturnetz-landau";
import { scrapeLandauDe } from "./venues/landau-de";
import { scrapeLandinsichtBuchladen } from "./venues/landinsicht-buchladen";
import { scrapeLandungsbruecken } from "./venues/landungsbruecken";
import { scrapeLichthofTheater } from "./venues/lichthof-theater";
import { scrapeLichtwarkTheater } from "./venues/lichtwark-theater";
import { scrapeLiteraturhaus } from "./venues/literaturhaus-frankfurt";
import { scrapeMalsehn } from "./venues/malsehn";
import { scrapeMampf } from "./venues/mampf";
import { scrapeMkgHamburg } from "./venues/mkg-hamburg";
import { scrapeMonsunTheater } from "./venues/monsun-theater";
import { scrapeMousonturm } from "./venues/mousonturm";
import { scrapeMurnauFilmtheater } from "./venues/murnau-filmtheater";
import { scrapeMusikschuleFrankfurt } from "./venues/musikschule-frankfurt";
import { scrapeMutTheater } from "./venues/mut-theater";
import { scrapeNaxos } from "./venues/naxos";
import { scrapeNaxosKino } from "./venues/naxos-kino";
import { scrapeNeuesTheaterHoechst } from "./venues/neues-theater-hoechst";
import { scrapeNipponConnection } from "./venues/nippon-connection";
import { scrapeNormativeOrders } from "./venues/normative-orders";
import { scrapeOhnsorgTheater } from "./venues/ohnsorg-theater";
import { scrapeOpenBooks } from "./venues/openbooks-frankfurt";
import { scrapeOperFrankfurt } from "./venues/oper-frankfurt";
import { scrapeOperFrankfurtKonzerte } from "./venues/oper-frankfurt-konzerte";
import { scrapeOpernloft } from "./venues/opernloft";
import { scrapeOrfeosErben } from "./venues/orfeos-erben";
import { scrapePapagenoMusiktheater } from "./venues/papageno-musiktheater";
import { scrapePfalzDe } from "./venues/pfalz-de";
import { scrapePolytechnische } from "./venues/polytechnische";
import { scrapeProgrammkinoRex } from "./venues/programmkino-rex";
import { scrapePupille } from "./venues/pupille";
import { scrapeRheingauFestival } from "./venues/rheingau-festival";
import { scrapeRlsHessen } from "./venues/rls-hessen";
import { scrapeRoemerberggespraeche } from "./venues/roemerberggespraeche";
import { scrapeRomanfabrik } from "./venues/romanfabrik";
import { scrapeRptuCampuskultur } from "./venues/rptu-campuskultur";
import { scrapeSavoyFilmtheater } from "./venues/savoy-filmtheater";
import { scrapeSchauspielFrankfurt } from "./venues/schauspiel-frankfurt";
import { scrapeShmhMuseums } from "./venues/shmh-museums";
import { scrapeSigmundFreudInstitut } from "./venues/sigmund-freud-institut";
import { scrapeStPauliTheater } from "./venues/st-pauli-theater";
import { scrapeStadtbuechereiFrankfurt } from "./venues/stadtbuecherei-frankfurt";
import { scrapeStalburgTheater } from "./venues/stalburg-theater";
import { scrapeStKatharinen } from "./venues/stk-musik";
import { scrapeSuew } from "./venues/suew";
import { scrapeThaliaTheater } from "./venues/thalia-theater";
import { scrapeTheaterAlteBruecke } from "./venues/theater-alte-bruecke";
import { scrapeTheaterDasZimmer } from "./venues/theater-das-zimmer";
import { scrapeTheaterFuerKinder } from "./venues/theater-fuer-kinder";
import { scrapeTheaterLempenfieber } from "./venues/theater-lempenfieber";
import { scrapeTheaterWillyPraml } from "./venues/theater-willy-praml";
import { scrapeTheaterhausFrankfurt } from "./venues/theaterhaus-frankfurt";
import { scrapeTheaterschiffHamburg } from "./venues/theaterschiff-hamburg";
import { scrapeTigerpalastVariete } from "./venues/tigerpalast-variete";
import { scrapeUnimedizinFrankfurt } from "./venues/unimedizin-frankfurt";
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
  { slug: "alabama-kino", run: (_ctx: ScraperContext) => scrapeAlabamaKino() },
  { slug: "alma-hoppes-lustspielhaus", run: (_ctx: ScraperContext) => scrapeAlmaHoppesLustspielhaus() },
  { slug: "altonaer-theater", run: (_ctx: ScraperContext) => scrapeAltonaerTheater() },
  { slug: "alte-oper", run: (_ctx: ScraperContext) => scrapeAlteOper() },
  { slug: "andreas-koehs", run: (_ctx: ScraperContext) => scrapeAndreasKoehs() },
  { slug: "arthouse-kinos-frankfurt", run: (_ctx: ScraperContext) => scrapeArthouseKinos() },
  { slug: "astor-frankfurt", run: (_ctx: ScraperContext) => scrapeAstorFrankfurt() },
  { slug: "astor-hafencity", run: (_ctx: ScraperContext) => scrapeAstorHafencity() },
  { slug: "autorenbuchhandlung-marx", run: (_ctx: ScraperContext) => scrapeAutorenbuchhandlungMarx() },
  { slug: "bad-homburger-schlosskonzerte", run: (_ctx: ScraperContext) => scrapeBadHomburgSchloss() },
  { slug: "bad-soden", run: (_ctx: ScraperContext) => scrapeBadSoden() },
  { slug: "bnai-brith-frankfurt", run: (_ctx: ScraperContext) => scrapeBnaiBrithFrankfurt() },
  { slug: "boell-hessen", run: (_ctx: ScraperContext) => scrapeBoellHessen() },
  { slug: "brotfabrik", run: (_ctx: ScraperContext) => scrapeBrotfabrik() },
  { slug: "buergeruniversitaet", run: (_ctx: ScraperContext) => scrapeBuergeruniversitaet() },
  { slug: "caligari-wiesbaden", run: (_ctx: ScraperContext) => scrapeCaligariWiesbaden() },
  { slug: "centralkomitee", run: (_ctx: ScraperContext) => scrapeCentralkomitee() },
  { slug: "club-voltaire", run: (_ctx: ScraperContext) => scrapeClubVoltaire() },
  { slug: "crespo-foundation", run: (_ctx: ScraperContext) => scrapeCrespoFoundation() },
  { slug: "denkbar-frankfurt", run: (_ctx: ScraperContext) => scrapeDenkbar() },
  { slug: "deutsches-schauspielhaus", run: (_ctx: ScraperContext) => scrapeDeutschesSchauspielhaus() },
  { slug: "dfg-frankfurt", run: (_ctx: ScraperContext) => scrapeDfgFrankfurt() },
  { slug: "die-kaes", run: (_ctx: ScraperContext) => scrapeDieKaes() },
  { slug: "die-schmiere", run: (_ctx: ScraperContext) => scrapeDieSchmiere() },
  { slug: "dig-frankfurt", run: (_ctx: ScraperContext) => scrapeDigFrankfurt() },
  { slug: "dramatische-buehne", run: (_ctx: ScraperContext) => scrapeDramatischeBuehne() },
  { slug: "dresden-frankfurt-dance-company", run: (_ctx: ScraperContext) => scrapeDresdenFrankfurtDanceCompany() },
  { slug: "dr-hochs-konservatorium", run: (_ctx: ScraperContext) => scrapeDrHochs() },
  { slug: "english-theatre-frankfurt", run: (_ctx: ScraperContext) => scrapeEnglishTheatreFrankfurt() },
  { slug: "english-theatre-hamburg", run: (_ctx: ScraperContext) => scrapeEnglishTheatreHamburg() },
  { slug: "ensemble-modern", run: (_ctx: ScraperContext) => scrapeEnsembleModern() },
  { slug: "ernst-deutsch-theater", run: (_ctx: ScraperContext) => scrapeErnstDeutschTheater() },
  { slug: "eschborn-k", run: (_ctx: ScraperContext) => scrapeEschbornK() },
  { slug: "evangelische-akademie-frankfurt", run: (_ctx: ScraperContext) => scrapeEvangelischeAkademie() },
  { slug: "fes-hessen", run: (_ctx: ScraperContext) => scrapeFesHessen() },
  { slug: "fgz-streitclub", run: (_ctx: ScraperContext) => scrapeFgzStreitclub() },
  { slug: "filmforum-hoechst", run: (_ctx: ScraperContext) => scrapeFilmforumHoechst() },
  { slug: "filmkreis-darmstadt", run: (_ctx: ScraperContext) => scrapeFilmkreisDarmstadt() },
  { slug: "first-stage-theater", run: (ctx: ScraperContext) => scrapeFirstStageTheater(ctx) },
  {
    slug: "forschungskolleg-humanwissenschaften",
    run: (_ctx: ScraperContext) => scrapeForschungskollegHumanwissenschaften(),
  },
  { slug: "frankfurt-uas", run: (_ctx: ScraperContext) => scrapeFrankfurtUas() },
  { slug: "frankfurter-sparkasse", run: (_ctx: ScraperContext) => scrapeFrankfurterSparkasse() },
  { slug: "fundus-theater", run: (_ctx: ScraperContext) => scrapeFundusTheater() },
  { slug: "galli-theater", run: (_ctx: ScraperContext) => scrapeGalliTheater() },
  { slug: "gallus-theater", run: (_ctx: ScraperContext) => scrapeGallusTheater() },
  { slug: "hafen-2-offenbach", run: (_ctx: ScraperContext) => scrapeHafen2() },
  { slug: "hambacher-schloss", run: (_ctx: ScraperContext) => scrapeHambacherSchloss() },
  { slug: "hamburgische-staatsoper", run: (_ctx: ScraperContext) => scrapeHamburgischeStaatsoper() },
  { slug: "hamburger-kammeroper", run: (_ctx: ScraperContext) => scrapeHamburgerKammeroper() },
  { slug: "hamburger-kammerspiele", run: (_ctx: ScraperContext) => scrapeHamburgerKammerspiele() },
  { slug: "hamburger-kunsthalle", run: (_ctx: ScraperContext) => scrapeHamburgerKunsthalle() },
  { slug: "hamburger-puppentheater", run: (_ctx: ScraperContext) => scrapeHamburgerPuppentheater() },
  { slug: "hamburger-sprechwerk", run: (_ctx: ScraperContext) => scrapeHamburgerSprechwerk() },
  { slug: "hansa-theater", run: (_ctx: ScraperContext) => scrapeHansaTheater() },
  { slug: "harburger-theater", run: (_ctx: ScraperContext) => scrapeHarburgerTheater() },
  { slug: "hohe-luft-schiff", run: (_ctx: ScraperContext) => scrapeHoheLuftschiff() },
  { slug: "imperial-theater", run: (_ctx: ScraperContext) => scrapeImperialTheater() },
  { slug: "kampnagel", run: (_ctx: ScraperContext) => scrapeKampnagel() },
  { slug: "haus-am-dom", run: (ctx: ScraperContext) => scrapeHausAmDom(ctx.proxy) },
  { slug: "hessisches-staatsballett", run: (_ctx: ScraperContext) => scrapeHessischesStaatsballett() },
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
  { slug: "jazzkeller", run: (_ctx: ScraperContext) => scrapeJazzkeller() },
  { slug: "juedische-gemeinde-frankfurt", run: (_ctx: ScraperContext) => scrapeJuedischeGemeinde() },
  { slug: "karl-marx-buchhandlung", run: (_ctx: ScraperContext) => scrapeKarlMarxBuchhandlung() },
  { slug: "kellertheater-frankfurt", run: (_ctx: ScraperContext) => scrapeKellertheaterFrankfurt() },
  { slug: "kino-koeppern", run: (_ctx: ScraperContext) => scrapeKinoKoeppern() },
  { slug: "kirchenmusik-dreikoenig", run: (_ctx: ScraperContext) => scrapeKirchenmusikDreikoenig() },
  { slug: "komoedie-frankfurt", run: (_ctx: ScraperContext) => scrapeKomoedieFrankfurt() },
  { slug: "komoedie-winterhuder-faehrhaus", run: (_ctx: ScraperContext) => scrapeKomoedieWinterhuderFaehrhaus() },
  { slug: "kronberg-academy", run: (_ctx: ScraperContext) => scrapeKronbergAcademy() },
  { slug: "kulturnetz-landau", run: (_ctx: ScraperContext) => scrapeKulturnetzLandau() },
  { slug: "landau-de", run: (_ctx: ScraperContext) => scrapeLandauDe() },
  { slug: "landinsicht-buchladen", run: (_ctx: ScraperContext) => scrapeLandinsichtBuchladen() },
  { slug: "landungsbruecken", run: (_ctx: ScraperContext) => scrapeLandungsbruecken() },
  { slug: "lichthof-theater", run: (_ctx: ScraperContext) => scrapeLichthofTheater() },
  { slug: "lichtwark-theater", run: (_ctx: ScraperContext) => scrapeLichtwarkTheater() },
  { slug: "literaturhaus-frankfurt", run: (_ctx: ScraperContext) => scrapeLiteraturhaus() },
  { slug: "malsehn", run: (_ctx: ScraperContext) => scrapeMalsehn() },
  { slug: "mampf", run: (_ctx: ScraperContext) => scrapeMampf() },
  { slug: "monsun-theater", run: (_ctx: ScraperContext) => scrapeMonsunTheater() },
  { slug: "mousonturm", run: (_ctx: ScraperContext) => scrapeMousonturm() },
  { slug: "mut-theater", run: (_ctx: ScraperContext) => scrapeMutTheater() },
  { slug: "cineamo-frankfurt-region", run: (_ctx: ScraperContext) => scrapeCineamo() },
  { slug: "kinoheld-frankfurt-region", run: (_ctx: ScraperContext) => scrapeKinoheld() },
  { slug: "meetup", run: (_ctx: ScraperContext) => scrapeMeetup() },
  { slug: "museums-frankfurt", run: (ctx: ScraperContext) => scrapeMuseumsFrankfurt(ctx) },
  { slug: "deichtorhallen", run: (ctx: ScraperContext) => scrapeDeichtorhallen(ctx) },
  { slug: "mkg-hamburg", run: (ctx: ScraperContext) => scrapeMkgHamburg(ctx) },
  { slug: "museums-hamburg", run: (ctx: ScraperContext) => scrapeShmhMuseums(ctx) },
  { slug: "stiftung-hg", run: (_ctx: ScraperContext) => scrapeStiftungHg() },
  { slug: "murnau-filmtheater", run: (_ctx: ScraperContext) => scrapeMurnauFilmtheater() },
  { slug: "musikschule-frankfurt", run: (_ctx: ScraperContext) => scrapeMusikschuleFrankfurt() },
  { slug: "naxos-hallenkonzerte", run: (_ctx: ScraperContext) => scrapeNaxos() },
  { slug: "naxos-kino", run: (_ctx: ScraperContext) => scrapeNaxosKino() },
  { slug: "neues-theater-hoechst", run: (_ctx: ScraperContext) => scrapeNeuesTheaterHoechst() },
  { slug: "nippon-connection", run: (_ctx: ScraperContext) => scrapeNipponConnection() },
  { slug: "normative-orders", run: (_ctx: ScraperContext) => scrapeNormativeOrders() },
  { slug: "openbooks-frankfurt", run: (_ctx: ScraperContext) => scrapeOpenBooks() },
  { slug: "opernloft", run: (_ctx: ScraperContext) => scrapeOpernloft() },
  { slug: "ohnsorg-theater", run: (_ctx: ScraperContext) => scrapeOhnsorgTheater() },
  { slug: "oper-frankfurt", run: (_ctx: ScraperContext) => scrapeOperFrankfurt() },
  { slug: "oper-frankfurt-konzerte", run: (_ctx: ScraperContext) => scrapeOperFrankfurtKonzerte() },
  { slug: "orfeos-erben", run: (_ctx: ScraperContext) => scrapeOrfeosErben() },
  { slug: "papageno-musiktheater", run: (_ctx: ScraperContext) => scrapePapagenoMusiktheater() },
  { slug: "pfalz-de", run: (_ctx: ScraperContext) => scrapePfalzDe() },
  { slug: "polytechnische-gesellschaft", run: (_ctx: ScraperContext) => scrapePolytechnische() },
  { slug: "programmkino-rex", run: (_ctx: ScraperContext) => scrapeProgrammkinoRex() },
  { slug: "pupille", run: (_ctx: ScraperContext) => scrapePupille() },
  { slug: "rheingau-musikfestival", run: (_ctx: ScraperContext) => scrapeRheingauFestival() },
  { slug: "rls-hessen", run: (_ctx: ScraperContext) => scrapeRlsHessen() },
  { slug: "roemerberggespraeche", run: (_ctx: ScraperContext) => scrapeRoemerberggespraeche() },
  { slug: "romanfabrik", run: (_ctx: ScraperContext) => scrapeRomanfabrik() },
  { slug: "rptu-campuskultur", run: (_ctx: ScraperContext) => scrapeRptuCampuskultur() },
  { slug: "savoy-filmtheater", run: (_ctx: ScraperContext) => scrapeSavoyFilmtheater() },
  { slug: "schauspiel-frankfurt", run: (_ctx: ScraperContext) => scrapeSchauspielFrankfurt() },
  { slug: "sigmund-freud-institut", run: (_ctx: ScraperContext) => scrapeSigmundFreudInstitut() },
  { slug: "st-pauli-theater", run: (_ctx: ScraperContext) => scrapeStPauliTheater() },
  { slug: "st-katharinen", run: (_ctx: ScraperContext) => scrapeStKatharinen() },
  { slug: "stadtbuecherei-frankfurt", run: (ctx: ScraperContext) => scrapeStadtbuechereiFrankfurt(ctx.proxy) },
  { slug: "stalburg-theater", run: (_ctx: ScraperContext) => scrapeStalburgTheater() },
  { slug: "suew", run: (_ctx: ScraperContext) => scrapeSuew() },
  { slug: "thalia-theater", run: (_ctx: ScraperContext) => scrapeThaliaTheater() },
  { slug: "theater-das-zimmer", run: (_ctx: ScraperContext) => scrapeTheaterDasZimmer() },
  { slug: "theater-alte-bruecke", run: (_ctx: ScraperContext) => scrapeTheaterAlteBruecke() },
  { slug: "theater-fuer-kinder", run: (_ctx: ScraperContext) => scrapeTheaterFuerKinder() },
  { slug: "theater-lempenfieber", run: (_ctx: ScraperContext) => scrapeTheaterLempenfieber() },
  { slug: "theater-willy-praml", run: (_ctx: ScraperContext) => scrapeTheaterWillyPraml() },
  { slug: "theaterhaus-frankfurt", run: (_ctx: ScraperContext) => scrapeTheaterhausFrankfurt() },
  { slug: "theaterschiff-hamburg", run: (_ctx: ScraperContext) => scrapeTheaterschiffHamburg() },
  { slug: "tigerpalast-variete", run: (_ctx: ScraperContext) => scrapeTigerpalastVariete() },
  { slug: "unimedizin-frankfurt", run: (ctx: ScraperContext) => scrapeUnimedizinFrankfurt(ctx.proxy) },
  { slug: "union-club-frankfurt", run: (_ctx: ScraperContext) => scrapeUnionClubFrankfurt() },
  { slug: "volksbuehne-frankfurt", run: (_ctx: ScraperContext) => scrapeVolksbuehneFrankfurt() },
  { slug: "waggong", run: (_ctx: ScraperContext) => scrapeWaggong() },
  { slug: "wdc2026", run: (ctx: ScraperContext) => scrapeWdc2026(ctx.proxy) },
  { slug: "ypsilon-buchladen", run: (_ctx: ScraperContext) => scrapeYpsilonBuchladen() },
];

export {
  scrapeAlabamaKino,
  scrapeAlmaHoppesLustspielhaus,
  scrapeAlteOper,
  scrapeAltonaerTheater,
  scrapeAndreasKoehs,
  scrapeArthouseKinos,
  scrapeAstorFrankfurt,
  scrapeAstorHafencity,
  scrapeAutorenbuchhandlungMarx,
  scrapeBadHomburgSchloss,
  scrapeBadSoden,
  scrapeBnaiBrithFrankfurt,
  scrapeBoellHessen,
  scrapeBrotfabrik,
  scrapeBuergeruniversitaet,
  scrapeCaligariWiesbaden,
  scrapeCentralkomitee,
  scrapeClubVoltaire,
  scrapeCrespoFoundation,
  scrapeDeichtorhallen,
  scrapeDenkbar,
  scrapeDeutschesSchauspielhaus,
  scrapeDfgFrankfurt,
  scrapeDieKaes,
  scrapeDieSchmiere,
  scrapeDigFrankfurt,
  scrapeDramatischeBuehne,
  scrapeDresdenFrankfurtDanceCompany,
  scrapeDrHochs,
  scrapeEnglishTheatreFrankfurt,
  scrapeEnglishTheatreHamburg,
  scrapeEnsembleModern,
  scrapeErnstDeutschTheater,
  scrapeEschbornK,
  scrapeEvangelischeAkademie,
  scrapeFesHessen,
  scrapeFgzStreitclub,
  scrapeFilmforumHoechst,
  scrapeFilmkreisDarmstadt,
  scrapeFirstStageTheater,
  scrapeForschungskollegHumanwissenschaften,
  scrapeFrankfurterSparkasse,
  scrapeFrankfurtUas,
  scrapeFundusTheater,
  scrapeGalliTheater,
  scrapeGallusTheater,
  scrapeHafen2,
  scrapeHambacherSchloss,
  scrapeHamburgerKammeroper,
  scrapeHamburgerKammerspiele,
  scrapeHamburgerKunsthalle,
  scrapeHamburgerPuppentheater,
  scrapeHamburgerSprechwerk,
  scrapeHamburgischeStaatsoper,
  scrapeHansaTheater,
  scrapeHarburgerTheater,
  scrapeHausAmDom,
  scrapeHessischesStaatsballett,
  scrapeHfmdk,
  scrapeHoheLuftschiff,
  scrapeHolzhausenschloesschen,
  scrapeHrBigband,
  scrapeHrSinfonieorchester,
  scrapeHsfkFrankfurt,
  scrapeImperialTheater,
  scrapeInstitutFrancaisFrankfurt,
  scrapeInstitutFuerSozialforschung,
  scrapeInstitutoCervantesFrankfurt,
  scrapeInternationalesTheater,
  scrapeJazzFrankfurt,
  scrapeJazzkeller,
  scrapeJazzPalmengarten,
  scrapeJuedischeGemeinde,
  scrapeKampnagel,
  scrapeKarlMarxBuchhandlung,
  scrapeKellertheaterFrankfurt,
  scrapeKinoKoeppern,
  scrapeKirchenmusikDreikoenig,
  scrapeKomoedieFrankfurt,
  scrapeKomoedieWinterhuderFaehrhaus,
  scrapeKronbergAcademy,
  scrapeKulturnetzLandau,
  scrapeLandauDe,
  scrapeLandinsichtBuchladen,
  scrapeLandungsbruecken,
  scrapeLichthofTheater,
  scrapeLichtwarkTheater,
  scrapeLiteraturhaus,
  scrapeMalsehn,
  scrapeMampf,
  scrapeMkgHamburg,
  scrapeMonsunTheater,
  scrapeMousonturm,
  scrapeMurnauFilmtheater,
  scrapeMuseumsFrankfurt,
  scrapeMusikschuleFrankfurt,
  scrapeMutTheater,
  scrapeNaxos,
  scrapeNaxosKino,
  scrapeNeuesTheaterHoechst,
  scrapeNipponConnection,
  scrapeNormativeOrders,
  scrapeOpenBooks,
  scrapeOperFrankfurt,
  scrapeOperFrankfurtKonzerte,
  scrapeOpernloft,
  scrapeOrfeosErben,
  scrapePapagenoMusiktheater,
  scrapePfalzDe,
  scrapePolytechnische,
  scrapeProgrammkinoRex,
  scrapePupille,
  scrapeRheingauFestival,
  scrapeRlsHessen,
  scrapeRoemerberggespraeche,
  scrapeRomanfabrik,
  scrapeRptuCampuskultur,
  scrapeSavoyFilmtheater,
  scrapeSchauspielFrankfurt,
  scrapeShmhMuseums,
  scrapeSigmundFreudInstitut,
  scrapeStadtbuechereiFrankfurt,
  scrapeStalburgTheater,
  scrapeStKatharinen,
  scrapeStPauliTheater,
  scrapeSuew,
  scrapeThaliaTheater,
  scrapeTheaterAlteBruecke,
  scrapeTheaterDasZimmer,
  scrapeTheaterFuerKinder,
  scrapeTheaterhausFrankfurt,
  scrapeTheaterLempenfieber,
  scrapeTheaterschiffHamburg,
  scrapeTheaterWillyPraml,
  scrapeTigerpalastVariete,
  scrapeUnimedizinFrankfurt,
  scrapeUnionClubFrankfurt,
  scrapeVolksbuehneFrankfurt,
  scrapeWaggong,
  scrapeWdc2026,
  scrapeYpsilonBuchladen,
};
