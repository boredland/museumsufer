export type EventApiType =
  | "tribe-events"
  | "historisches"
  | "juedisches"
  | "staedel"
  | "senckenberg"
  | "my-calendar"
  | "liebieghaus"
  | "mak"
  | "stadtgeschichte-rss"
  | "dommuseum"
  | "ledermuseum"
  | "bibelhaus"
  | "fkv"
  | "fdh"
  | "dff-kino"
  | "archaeologisches"
  | "fritz-bauer-wollheim"
  | "experiminta"
  | "caricatura"
  | "weltkulturen"
  | "eventon"
  | "buergerstiftung"
  | "schirn"
  | "mmk"
  | "giersch"
  | "fff";

export type ExhibitionApiType =
  | "mmk-cms"
  | "schirn"
  | "weltkulturen"
  | "caricatura"
  | "giersch"
  | "fff"
  | "staedel"
  | "liebieghaus"
  | "historisches"
  | "senckenberg"
  | "juedisches"
  | "mak"
  | "ledermuseum"
  | "fkv"
  | "fdh"
  | "dff"
  | "archaeologisches"
  | "dam-tribe"
  | "mfk";

export interface ProxyConfig {
  url: string;
  token?: string;
}

export interface MuseumConfig {
  name?: string;
  description?: string;
  image?: string;
  website?: string;
  abbreviation?: string;
  group?: string;
  lat: number;
  lng: number;
  rmvStopLid?: string;
  spa?: true;
  proxy?: true;
  hidden?: true;
  skipEvents?: true;
  exhibitionUrl?: string;
  eventApi?: {
    type: EventApiType;
    endpoint: string;
  };
  exhibitionApi?: {
    type: ExhibitionApiType;
    endpoint: string;
  };
}

export const MUSEUMS: Record<string, MuseumConfig> = {
  "archaeologisches-museum-frankfurt": {
    lat: 50.1073,
    lng: 8.6832,
    rmvStopLid: "A=1@O=Frankfurt (Main) Elisabethenstraße@X=8688119@Y=50105882@U=80@L=3000905@",
    exhibitionUrl: "https://archaeologisches-museum-frankfurt.de/index.php/de/ausstellungen/",
    eventApi: {
      type: "archaeologisches",
      endpoint: "https://archaeologisches-museum-frankfurt.de/index.php/de/kalender",
    },
    exhibitionApi: {
      type: "archaeologisches",
      endpoint: "https://archaeologisches-museum-frankfurt.de/index.php/de/ausstellungen",
    },
  },
  "bibelhaus-erlebnismuseum": {
    lat: 50.1044,
    lng: 8.6926,
    rmvStopLid: "A=1@O=Frankfurt (Main) Affentorplatz@X=8689854@Y=50104668@U=80@L=3000926@",
    proxy: true,
    exhibitionUrl: "https://www.bibelhaus-frankfurt.de/de/ausstellungen",
    eventApi: { type: "bibelhaus", endpoint: "https://www.bibelhaus-frankfurt.de/de/programm" },
  },
  "caricatura-museum-frankfurt": {
    abbreviation: "Caricatura",
    lat: 50.1109,
    lng: 8.6845,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    exhibitionUrl: "https://caricatura-museum.de/ausstellungen/sonderausstellung/",
    eventApi: { type: "caricatura", endpoint: "https://caricatura-museum.de/veranstaltungen" },
    exhibitionApi: { type: "caricatura", endpoint: "https://caricatura-museum.de/ausstellungen/" },
  },
  "deutsches-architekturmuseum": {
    abbreviation: "DAM",
    lat: 50.1049,
    lng: 8.6715,
    rmvStopLid: "A=1@O=Frankfurt (Main) Weser-/Münchener Straße@X=8670285@Y=50107958@U=80@L=3000007@",
    exhibitionUrl: "https://www.dam-online.de/programm/ausstellungen/",
    eventApi: { type: "tribe-events", endpoint: "https://dam-online.de/wp-json/tribe/events/v1/events" },
    // The /programm/ausstellungen/ page renders the same Tribe entries with
    // JSON-LD Event blocks; exhibitions vs single-day workshops are
    // distinguished by duration (>=7 days).
    exhibitionApi: { type: "dam-tribe", endpoint: "https://www.dam-online.de/programm/ausstellungen/" },
  },
  "deutsches-ledermuseum-of": {
    lat: 50.0984,
    lng: 8.7587,
    rmvStopLid: "A=1@O=Offenbach (Main)-Zentrum Hauptbahnhof@X=8760662@Y=50099643@U=80@L=3002501@",
    exhibitionUrl: "https://www.ledermuseum.de/ausstellungen",
    eventApi: { type: "ledermuseum", endpoint: "https://www.ledermuseum.de/programm" },
    exhibitionApi: { type: "ledermuseum", endpoint: "https://www.ledermuseum.de/ausstellungen" },
  },
  "deutsches-romantik-museum": {
    lat: 50.1118,
    lng: 8.6776,
    rmvStopLid: "A=1@O=Frankfurt (Main) Roßmarkt@X=8676029@Y=50112525@U=80@L=3000013@",
    exhibitionUrl: "https://deutsches-romantik-museum.de/ausstellungen/",
    eventApi: { type: "fdh", endpoint: "https://deutsches-romantik-museum.de/programm/" },
    exhibitionApi: { type: "fdh", endpoint: "https://deutsches-romantik-museum.de/ausstellungen/" },
  },
  "dff-deutsches-filminstitut-filmmuseum": {
    abbreviation: "DFF",
    lat: 50.1052,
    lng: 8.6728,
    rmvStopLid: "A=1@O=Frankfurt (Main) Weser-/Münchener Straße@X=8670285@Y=50107958@U=80@L=3000007@",
    exhibitionUrl: "https://www.dff.film/besuch/ausstellungen/",
    eventApi: { type: "dff-kino", endpoint: "https://booking.cinetixx.de/api/cinemas/events/cinema/2038440885" },
    exhibitionApi: { type: "dff", endpoint: "https://www.dff.film/besuch/ausstellungen/" },
  },
  "dommuseum-frankfurt": {
    lat: 50.1114,
    lng: 8.6855,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    exhibitionUrl: "https://dommuseum-frankfurt.de/",
    eventApi: { type: "dommuseum", endpoint: "https://dommuseum-frankfurt.de/besuchen/kalender" },
  },
  "eintracht-frankfurt-museum": {
    lat: 50.0685,
    lng: 8.6455,
    rmvStopLid: "A=1@O=Frankfurt (Main) Stadion Osttribüne@X=8651686@Y=50068909@U=80@L=3001808@",
    // SPA without parseable event listing.
    skipEvents: true,
  },
  "fotografie-forum-frankfurt": {
    lat: 50.1118,
    lng: 8.6907,
    rmvStopLid: "A=1@O=Frankfurt (Main) Börneplatz/Stoltzestraße@X=8688874@Y=50112606@U=80@L=3060775@",
    exhibitionUrl: "https://www.fffrankfurt.org/aktuell/",
    eventApi: { type: "fff", endpoint: "https://www.fffrankfurt.org/aktuell/" },
    exhibitionApi: { type: "fff", endpoint: "https://www.fffrankfurt.org/aktuell/" },
  },
  "frankfurter-goethe-haus": {
    lat: 50.1113,
    lng: 8.6776,
    rmvStopLid: "A=1@O=Frankfurt (Main) Karmeliterkloster@X=8678186@Y=50110125@U=80@L=3060835@",
    hidden: true,
    exhibitionUrl: "https://frankfurter-goethe-haus.de/ausstellung/",
    eventApi: { type: "fdh", endpoint: "https://www.goethehaus-frankfurt.de/programm/" },
    exhibitionApi: { type: "fdh", endpoint: "https://frankfurter-goethe-haus.de/ausstellung/" },
  },
  "frankfurter-kunstverein": {
    abbreviation: "FKV",
    lat: 50.1108,
    lng: 8.6907,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hospital Zum Heiligen Geist@X=8692722@Y=50110637@U=80@L=3000524@",
    exhibitionUrl: "https://www.fkv.de/exhibitions-current-preview/",
    eventApi: { type: "fkv", endpoint: "https://www.fkv.de/current-events/" },
    exhibitionApi: { type: "fkv", endpoint: "https://www.fkv.de/exhibitions-current-preview/" },
  },
  "geldmuseum-der-deutschen-bundesbank": {
    lat: 50.1283,
    lng: 8.6208,
    rmvStopLid: "A=1@O=Frankfurt (Main) Fischstein@X=8624952@Y=50129344@U=80@L=3001223@",
    exhibitionUrl: "https://www.bundesbank.de/de/bundesbank/geldmuseum/ausstellungen/",
    // Bundesbank site has no machine-parseable event listing.
    skipEvents: true,
  },
  "haus-der-stadtgeschichte-of": {
    lat: 50.0984,
    lng: 8.7643,
    rmvStopLid: "A=1@O=Offenbach (Main)-Senefelderquartier Friedensstraße@X=8766622@Y=50097864@U=80@L=3008612@",
    exhibitionUrl: "https://www.offenbach.de/microsite/haus_der_stadtgeschichte/ausstellungen/index.php",
    // Offenbach city microsite, no event listing.
    skipEvents: true,
  },
  "hindemith-kabinett": {
    lat: 50.1059,
    lng: 8.6969,
    rmvStopLid: "A=1@O=Frankfurt (Main) Zum Apothekerhof@X=8697953@Y=50105271@U=80@L=3001994@",
    // Tiny venue inside the Kuhhirtenturm, no online events presence.
    skipEvents: true,
  },
  "historisches-museum-frankfurt": {
    abbreviation: "HMF",
    lat: 50.1092,
    lng: 8.6819,
    rmvStopLid: "A=1@O=Frankfurt (Main) Römer/Paulskirche@X=8682007@Y=50110934@U=80@L=3000002@",
    exhibitionUrl: "https://historisches-museum-frankfurt.de/de/",
    eventApi: { type: "historisches", endpoint: "https://historisches-museum-frankfurt.de/api/calendar" },
    exhibitionApi: {
      type: "historisches",
      endpoint: "https://historisches-museum-frankfurt.de/api/calendar?type=specialExhibition",
    },
  },
  "ikonenmuseum-frankfurt": {
    lat: 50.1058,
    lng: 8.6961,
    rmvStopLid: "A=1@O=Frankfurt (Main) Wasserweg@X=8694798@Y=50105432@U=80@L=3000028@",
    skipEvents: true,
    exhibitionUrl: "https://www.museumangewandtekunst.de/de/presse/ikonenmuseum/",
  },
  "institut-fuer-stadtgeschichte": {
    lat: 50.1088,
    lng: 8.673,
    rmvStopLid: "A=1@O=Frankfurt (Main) Willy-Brandt-Platz@X=8673898@Y=50108992@U=80@L=3000004@",
    exhibitionUrl: "https://www.stadtgeschichte-ffm.de/de/veranstaltungen/ausstellungen",
    eventApi: {
      type: "stadtgeschichte-rss",
      endpoint: "https://www.stadtgeschichte-ffm.de/rss/isg_rss.php?L=de",
    },
  },
  "juedisches-museum-frankfurt": {
    abbreviation: "JMF",
    group: "jmf",
    lat: 50.104,
    lng: 8.6649,
    rmvStopLid: "A=1@O=Frankfurt (Main) Baseler Platz@X=8664792@Y=50104507@U=80@L=3000025@",
    exhibitionUrl: "https://www.juedischesmuseum.de/besuch/ausstellungen",
    eventApi: {
      type: "juedisches",
      endpoint: "https://www.juedischesmuseum.de/besuch/feed.json?records%5BL%5D=0&records%5Buid%5D=329",
    },
    exhibitionApi: { type: "juedisches", endpoint: "https://www.juedischesmuseum.de/besuch/ausstellungen" },
  },
  "juedisches-museum-museum-judengasse-frankfurt": {
    group: "jmf",
    lat: 50.1143,
    lng: 8.6922,
    rmvStopLid: "A=1@O=Frankfurt (Main) Allerheiligentor@X=8693666@Y=50113316@U=80@L=3000523@",
    // Events arrive via the parent's `juedisches` API + locationAlt-based slug override
    // (fetchJuedisches in api-scrapers.ts), so don't double-scrape via the AI fallback.
    skipEvents: true,
    exhibitionUrl: "https://www.juedischesmuseum.de/besuch/museum-judengasse/",
  },
  "junges-museum-frankfurt": {
    lat: 50.109,
    lng: 8.683,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    exhibitionUrl: "https://junges-museum-frankfurt.de/ausstellung",
    skipEvents: true,
  },
  "klingspor-museum-of": {
    lat: 50.0988,
    lng: 8.77,
    rmvStopLid: "A=1@O=Offenbach (Main)-Mathildenviertel Tempelseestraße@X=8771234@Y=50101019@U=80@L=3002661@",
    exhibitionUrl: "https://www.offenbach.de/microsite/klingspor_museum/ausstellungen/index.php",
    // Offenbach city microsite, no event listing path.
    skipEvents: true,
  },
  "liebieghaus-skulpturensammlung": {
    abbreviation: "Liebieghaus",
    lat: 50.0996,
    lng: 8.66,
    rmvStopLid: "A=1@O=Frankfurt (Main) Zanderstraße@X=8658976@Y=50099922@U=80@L=3001978@",
    exhibitionUrl: "https://www.liebieghaus.de/de/ausstellungen/",
    eventApi: { type: "liebieghaus", endpoint: "https://www.liebieghaus.de/de/kalender" },
    exhibitionApi: { type: "liebieghaus", endpoint: "https://www.liebieghaus.de/de/ausstellungen/" },
  },
  "momem-museum-of-modern-electronic-music": {
    abbreviation: "MOMEM",
    lat: 50.114,
    lng: 8.6727,
    rmvStopLid: "A=1@O=Frankfurt (Main) Freßgass@X=8672406@Y=50114377@U=80@L=3065052@",
    exhibitionUrl: "https://momem.org/ausstellungen/",
    // SPA, no parseable event listing.
    skipEvents: true,
  },
  "museum-angewandte-kunst": {
    abbreviation: "MAK",
    lat: 50.1056,
    lng: 8.68,
    rmvStopLid: "A=1@O=Frankfurt (Main) Schweizer-/Gartenstraße@X=8679553@Y=50103338@U=80@L=3000914@",
    exhibitionUrl: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/",
    eventApi: { type: "mak", endpoint: "https://www.museumangewandtekunst.de/de/kalender/" },
    exhibitionApi: { type: "mak", endpoint: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/" },
  },
  "museum-fuer-kommunikation-frankfurt": {
    abbreviation: "MFK",
    lat: 50.1038,
    lng: 8.6702,
    rmvStopLid: "A=1@O=Frankfurt (Main) Baseler Platz@X=8664792@Y=50104507@U=80@L=3000025@",
    exhibitionUrl: "https://www.mfk-frankfurt.de/ausstellungen/",
    eventApi: { type: "my-calendar", endpoint: "https://www.mfk-frankfurt.de/wp-json/my-calendar/v1/events" },
    exhibitionApi: { type: "mfk", endpoint: "https://www.mfk-frankfurt.de/ausstellungen/" },
  },
  "museum-giersch-der-goethe-universitaet": {
    lat: 50.0986,
    lng: 8.6545,
    rmvStopLid: "A=1@O=Frankfurt (Main) Gutleut-/Heilbronner Straße@X=8654212@Y=50099751@U=80@L=3000016@",
    exhibitionUrl: "https://www.mggu.de/ausstellungen/",
    eventApi: { type: "giersch", endpoint: "https://www.mggu.de/veranstaltungen/" },
    exhibitionApi: { type: "giersch", endpoint: "https://www.mggu.de/ausstellungen/" },
  },
  "museum-mmk-museum-mmk-fuer-moderne-kunst": {
    abbreviation: "MMK",
    group: "mmk",
    lat: 50.1126,
    lng: 8.6878,
    rmvStopLid: "A=1@O=Frankfurt (Main) Börneplatz@X=8687993@Y=50112552@U=80@L=3000522@",
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
    // The cms.mmk.art /whats-on/ feed returns events for all three MMK
    // venues; fetchMmk routes them to zollamt-mmk / tower-mmk via
    // related_venues + museum_slug_override. The /exhibitions/ feed is
    // structurally identical for upcoming exhibitions.
    eventApi: { type: "mmk", endpoint: "https://cms.mmk.art/whats-on/" },
    exhibitionApi: { type: "mmk-cms", endpoint: "https://cms.mmk.art/exhibitions/" },
  },
  "museum-sinclair-haus-bad-homburg": {
    lat: 50.2267,
    lng: 8.6124,
    rmvStopLid: "A=1@O=Bad Homburg v.d.H. Markt@X=8612097@Y=50228890@U=80@L=3002349@",
    exhibitionUrl: "https://kunst-und-natur.de/museum-sinclair-haus/ausstellungen/",
    // Site has no parseable event listing.
    skipEvents: true,
  },
  portikus: {
    lat: 50.1077,
    lng: 8.6891,
    rmvStopLid: "A=1@O=Frankfurt (Main) Elisabethenstraße@X=8688119@Y=50105882@U=80@L=3000905@",
    exhibitionUrl: "https://www.portikus.de/de/exhibitions/",
    // Small kunsthalle, no parseable event listing.
    skipEvents: true,
  },
  "porzellan-museum-frankfurt": {
    lat: 50.0999,
    lng: 8.5476,
    rmvStopLid: "A=1@O=Frankfurt (Main) Mainberg@X=8549524@Y=50100012@U=80@L=3001005@",
    skipEvents: true,
  },
  "schirn-kunsthalle-frankfurt": {
    abbreviation: "Schirn",
    lat: 50.1102,
    lng: 8.659,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hohenstaufenstraße@X=8657655@Y=50110826@U=80@L=3001938@",
    exhibitionUrl: "https://www.schirn.de/ausstellung/",
    eventApi: { type: "schirn", endpoint: "https://www.schirn.de/de/veranstaltungen/" },
    exhibitionApi: { type: "schirn", endpoint: "https://www.schirn.de/programm/" },
  },
  "schirn-in-bockenheim": {
    lat: 50.1102,
    lng: 8.659,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hohenstaufenstraße@X=8657655@Y=50110826@U=80@L=3001938@",
    exhibitionUrl: "https://www.schirn.de/ausstellung/",
    // Events come via the parent schirn endpoint with a museum_slug_override
    // when the page's bockenheim-indicator carries content.
    skipEvents: true,
  },
  "senckenberg-naturmuseum": {
    abbreviation: "SNF",
    lat: 50.1175,
    lng: 8.6522,
    rmvStopLid: "A=1@O=Frankfurt (Main) Senckenbergmuseum@X=8652720@Y=50117047@U=80@L=3000211@",
    exhibitionUrl: "https://museumfrankfurt.senckenberg.de/de/ausstellungen/sonderausstellungen/",
    eventApi: {
      type: "senckenberg",
      endpoint: "https://museumfrankfurt.senckenberg.de/wp-json/wp/v2/events?per_page=100",
    },
    exhibitionApi: {
      type: "senckenberg",
      endpoint: "https://museumfrankfurt.senckenberg.de/wp-json/wp/v2/exhibition?per_page=100",
    },
  },
  "staedel-museum": {
    abbreviation: "Städel",
    lat: 50.1016,
    lng: 8.6721,
    rmvStopLid: "A=1@O=Frankfurt (Main) Otto-Hahn-Platz@X=8675678@Y=50101864@U=80@L=3000922@",
    exhibitionUrl: "https://www.staedelmuseum.de/de/ausstellungen-programm",
    eventApi: { type: "staedel", endpoint: "https://www.staedelmuseum.de/de/api/finder" },
    exhibitionApi: { type: "staedel", endpoint: "https://www.staedelmuseum.de/de/api/finder" },
  },
  "stoltze-museum": {
    lat: 50.111,
    lng: 8.6846,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    // No standalone website with an event listing.
    skipEvents: true,
  },
  "struwwelpeter-museum": {
    lat: 50.1112,
    lng: 8.684,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    exhibitionUrl: "https://www.struwwelpeter-museum.de/sonderausstellungen/",
    // No event listing, only special exhibitions.
    skipEvents: true,
  },
  "tower-mmk-museum-mmk-fuer-moderne-kunst": {
    abbreviation: "MMK",
    group: "mmk",
    lat: 50.1105,
    lng: 8.6698,
    rmvStopLid: "A=1@O=Frankfurt (Main) Weserstraße@X=8668837@Y=50109918@U=80@L=3060766@",
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
    // Events arrive via the parent's mmk API + related_venues slug override.
    skipEvents: true,
  },
  "weltkulturen-museum": {
    lat: 50.1042,
    lng: 8.6779,
    rmvStopLid: "A=1@O=Frankfurt (Main) Schweizer-/Gartenstraße@X=8679553@Y=50103338@U=80@L=3000914@",
    exhibitionUrl: "https://weltkulturenmuseum.de/de/ausstellungen/",
    eventApi: { type: "weltkulturen", endpoint: "https://weltkulturenmuseum.de/de/veranstaltungen" },
    exhibitionApi: { type: "weltkulturen", endpoint: "https://weltkulturenmuseum.de/de/ausstellungen/" },
  },
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst": {
    abbreviation: "MMK",
    group: "mmk",
    lat: 50.1122,
    lng: 8.6855,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
    // Events arrive via the parent's mmk API + related_venues slug override.
    skipEvents: true,
  },

  // --- Manual additions (not on museumsufer.de) ---

  "kunststiftung-dz-bank": {
    name: "Kunststiftung DZ BANK",
    description: "Zeitgenössische Fotokunst und Medienkunst im Herzen Frankfurts.",
    image: "https://kunststiftungdzbank.de/wp-content/uploads/2026/02/Cwynar_Scroll-1-Still_akt.jpg",
    website: "https://kunststiftungdzbank.de/",
    lat: 50.1134,
    lng: 8.6696,
    rmvStopLid: "A=1@O=Frankfurt (Main) Taunusanlage@X=8668765@Y=50113487@U=80@L=3000011@",
    exhibitionUrl: "https://kunststiftungdzbank.de/ausstellen/",
    // Booking via Evenito on a hash-routed page; no parseable event listing.
    skipEvents: true,
  },
  "frankfurter-feldbahnmuseum": {
    name: "Frankfurter Feldbahnmuseum",
    description: "Historische Feldbahnen und Schmalspurlokomotiven zum Anfassen und Mitfahren.",
    image: "https://www.feldbahn-ffm.de/wp-content/uploads/2021/11/ffm_aktuelles_21-10_20.jpg",
    website: "https://www.feldbahnmuseum.de/",
    lat: 50.1069,
    lng: 8.6119,
    rmvStopLid: "A=1@O=Frankfurt (Main) Gymnasium Römerhof@X=8609428@Y=50106646@U=80@L=3001499@",
    // Volunteer-run site, opening days only — no concrete event listing.
    skipEvents: true,
  },
  "verkehrsmuseum-frankfurt": {
    name: "Verkehrsmuseum Frankfurt am Main",
    description: "Verkehrsgeschichte mit historischen Straßenbahnen, Bussen und Schienenfahrzeugen.",
    image: "https://hsf-ffm.com/wp-content/uploads/2025/10/LinusWambach_23.03.2025-scaled.webp",
    website: "https://hsf-ffm.com/de/",
    lat: 50.0822,
    lng: 8.5816,
    rmvStopLid: "A=1@O=Frankfurt (Main) Rheinlandstraße@X=8581112@Y=50082492@U=80@L=3001905@",
    exhibitionUrl: "https://hsf-ffm.com/de/termine/",
    eventApi: { type: "eventon", endpoint: "https://hsf-ffm.com/de/termine/" },
  },
  dialogmuseum: {
    name: "Dialogmuseum",
    description: "Ausstellung im Dunkeln — die Welt mit anderen Sinnen erleben.",
    image: "https://dialogmuseum.de/wp-content/uploads/2026/04/Wasserwesen-Banner-Web-Ready.webp",
    website: "https://www.dialogmuseum.de/",
    lat: 50.1131,
    lng: 8.6787,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hauptwache@X=8679292@Y=50113963@U=80@L=3000001@",
    // Only on-demand workshops/trainings, no dated public events.
    skipEvents: true,
    exhibitionUrl: "https://www.dialogmuseum.de/",
  },
  experiminta: {
    name: "EXPERIMINTA ScienceCenter",
    description: "Interaktive Experimentierstationen zu Naturwissenschaft, Technik und Mathematik.",
    image: "https://www.experiminta.de/wp-content/uploads/2025/08/Dauerausstellung-9-350x240.jpeg",
    website: "https://www.experiminta.de/",
    lat: 50.1154,
    lng: 8.6478,
    rmvStopLid: "A=1@O=Frankfurt (Main) Varrentrappstraße@X=8647443@Y=50115312@U=80@L=3001207@",
    exhibitionUrl: "https://www.experiminta.de/ausstellungen/sonderausstellungen/",
    eventApi: { type: "experiminta", endpoint: "https://www.experiminta.de/event-sitemap.xml" },
  },
  atelierfrankfurt: {
    name: "Atelierfrankfurt",
    description: "Offene Ateliers und Ausstellungsräume für zeitgenössische Kunst im Ostend.",
    image: "https://www.atelierfrankfurt.de/wp-content/uploads/2021/02/Willkommen-im-AF-Link-Preview-1.png",
    website: "https://www.atelierfrankfurt.de/",
    lat: 50.1132,
    lng: 8.7197,
    rmvStopLid: "A=1@O=Frankfurt (Main) Schwedlerstraße@X=8719447@Y=50113981@U=80@L=3001539@",
    // /programm is a portfolio of exhibition projects without concrete dated events.
    skipEvents: true,
    exhibitionUrl: "https://www.atelierfrankfurt.de/ausstellungen/",
  },
  "frankfurter-buergerstiftung": {
    name: "Frankfurter Bürgerstiftung im Holzhausenschlösschen",
    description: "Kulturelle Veranstaltungen und Ausstellungen im historischen Holzhausenschlösschen.",
    image:
      "https://www.frankfurter-buergerstiftung.de/db/image/text/1120x630/76_holzhausenschloesschen-c-barbara-staubach.jpg",
    website: "https://www.frankfurter-buergerstiftung.de/",
    lat: 50.1262,
    lng: 8.6792,
    rmvStopLid: "A=1@O=Frankfurt (Main) Holzhausen-Park@X=8676910@Y=50127141@U=80@L=3001945@",
    exhibitionUrl: "https://www.frankfurter-buergerstiftung.de/programm/ausstellungen",
    eventApi: { type: "buergerstiftung", endpoint: "https://www.frankfurter-buergerstiftung.de/programm/" },
  },
  "wollheim-memorial-frankfurt": {
    name: "Wollheim Memorial",
    description:
      "Mahnmal auf dem Campus Westend zur Erinnerung an die KZ-Häftlinge, die im IG Farben-Werk Buna/Monowitz Zwangsarbeit leisten mussten.",
    website: "http://www.wollheim-memorial.de/",
    lat: 50.1244,
    lng: 8.6671,
    rmvStopLid: "A=1@O=Frankfurt (Main) Bockenheimer Warte@X=8649789@Y=50125353@U=80@L=3000111@",
    eventApi: { type: "fritz-bauer-wollheim", endpoint: "https://www.fritz-bauer-institut.de/veranstaltungen" },
  },
};

export function getMuseumConfig(slug: string): MuseumConfig | undefined {
  return MUSEUMS[slug];
}

export function getMuseumLocations(): Record<string, { lat: number; lng: number; rmvStopLid?: string }> {
  const locations: Record<string, { lat: number; lng: number; rmvStopLid?: string }> = {};
  for (const [slug, config] of Object.entries(MUSEUMS)) {
    locations[slug] = { lat: config.lat, lng: config.lng, rmvStopLid: config.rmvStopLid };
  }
  return locations;
}

export function getManualMuseums(): Array<{
  slug: string;
  name: string;
  website: string | null;
  description: string | null;
  image: string | null;
}> {
  return Object.entries(MUSEUMS)
    .filter(([, c]) => c.name)
    .map(([slug, c]) => ({
      slug,
      name: c.name!,
      website: c.website ?? null,
      description: c.description ?? null,
      image: c.image ?? null,
    }));
}

// Override the Wikipedia article title used for image lookups when the museum's
// display name doesn't match the article. Keyed by museum slug. Verified to
// exist on de.wikipedia.org and to have an infobox image.
export const WIKIPEDIA_TITLE_OVERRIDES: Record<string, string> = {
  "deutsches-architekturmuseum": "Deutsches Architekturmuseum",
  "deutsches-ledermuseum-of": "Deutsches Ledermuseum",
  "frankfurter-goethe-haus": "Frankfurt-Goethehaus",
  "junges-museum-frankfurt": "Historisches Museum Frankfurt",
  "museum-giersch-der-goethe-universitaet": "Museum Giersch",
  "ikonenmuseum-frankfurt": "Ikonen-Museum (Frankfurt am Main)",
  "hindemith-kabinett": "Kuhhirtenturm",
  "caricatura-museum-frankfurt": "Caricatura Museum für Komische Kunst",
  experiminta: "Experiminta",
  // Sub-venues / parent-building stand-ins.
  "tower-mmk-museum-mmk-fuer-moderne-kunst": "Museum MMK für Moderne Kunst",
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst": "Museum MMK für Moderne Kunst",
  "frankfurter-buergerstiftung": "Holzhausenschlösschen",
  "dommuseum-frankfurt": "Frankfurter Dom",
  "kunststiftung-dz-bank": "City-Haus I",
  "museum-sinclair-haus-bad-homburg": "Sinclair-Haus",
  "wollheim-memorial-frankfurt": "Wollheim-Memorial",
};

// Direct Wikimedia Commons image URLs for museums without a relevant
// Wikipedia article but with a usable Commons file. Takes precedence over
// WIKIPEDIA_TITLE_OVERRIDES.
export const WIKIPEDIA_IMAGE_URL_OVERRIDES: Record<string, string> = {
  "porzellan-museum-frankfurt": "https://upload.wikimedia.org/wikipedia/commons/c/cf/Kronberger_Haus_H%C3%B6chst.JPG",
  "bibelhaus-erlebnismuseum":
    "https://upload.wikimedia.org/wikipedia/commons/f/f2/Frankfurt_am_Main%2C_Bibelhaus_ErlebnisMuseum_-_Au%C3%9Fenansicht.jpg",
  "stoltze-museum":
    "https://upload.wikimedia.org/wikipedia/commons/2/27/Frankfurt_am_Main_-_Stoltze-Museum_-_aussen.jpg",
};

export function getImageAllowedDomains(): Set<string> {
  const domains = new Set<string>([
    "museumsufer.de",
    "www.museumsufer.de",
    "images.cinetixx.com",
    "upload.wikimedia.org",
  ]);
  for (const config of Object.values(MUSEUMS)) {
    const urls = [config.website, config.image, config.exhibitionUrl, config.eventApi?.endpoint].filter(Boolean);
    for (const url of urls) {
      try {
        const hostname = new URL(url!).hostname;
        domains.add(hostname);
        if (hostname.startsWith("www.")) domains.add(hostname.slice(4));
        else domains.add(`www.${hostname}`);
      } catch {}
    }
  }
  return domains;
}

export function getProxyDomains(): Set<string> {
  const domains = new Set<string>();
  for (const config of Object.values(MUSEUMS)) {
    if (!config.proxy) continue;
    if (config.exhibitionUrl) {
      try {
        domains.add(new URL(config.exhibitionUrl).hostname);
      } catch {}
    }
    if (config.eventApi) {
      try {
        domains.add(new URL(config.eventApi.endpoint).hostname);
      } catch {}
    }
  }
  return domains;
}
