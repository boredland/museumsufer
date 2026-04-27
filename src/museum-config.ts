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
  | "junges-museum"
  | "ledermuseum"
  | "bibelhaus"
  | "fkv"
  | "fdh";

export interface ProxyConfig {
  url: string;
  token?: string;
}

export interface MuseumConfig {
  name?: string;
  description?: string;
  image?: string;
  website?: string;
  lat: number;
  lng: number;
  spa?: true;
  proxy?: true;
  hidden?: true;
  exhibitionUrl?: string;
  eventApi?: {
    type: EventApiType;
    endpoint: string;
  };
}

export const MUSEUMS: Record<string, MuseumConfig> = {
  "archaeologisches-museum-frankfurt": {
    lat: 50.1073,
    lng: 8.6832,
    exhibitionUrl: "https://archaeologisches-museum-frankfurt.de/index.php/de/ausstellungen/",
  },
  "bibelhaus-erlebnismuseum": {
    lat: 50.1044,
    lng: 8.6926,
    proxy: true,
    exhibitionUrl: "https://www.bibelhaus-frankfurt.de/de/ausstellungen",
    eventApi: { type: "bibelhaus", endpoint: "https://www.bibelhaus-frankfurt.de/de/programm" },
  },
  "caricatura-museum-frankfurt": {
    lat: 50.1109,
    lng: 8.6845,
    exhibitionUrl: "https://caricatura-museum.de/ausstellungen/sonderausstellung/",
  },
  "deutsches-architekturmuseum": {
    lat: 50.1049,
    lng: 8.6715,
    exhibitionUrl: "https://www.dam-online.de/programm/ausstellungen/",
    eventApi: { type: "tribe-events", endpoint: "https://dam-online.de/wp-json/tribe/events/v1/events" },
  },
  "deutsches-ledermuseum-of": {
    lat: 50.0984,
    lng: 8.7587,
    exhibitionUrl: "https://www.ledermuseum.de/ausstellungen",
    eventApi: { type: "ledermuseum", endpoint: "https://www.ledermuseum.de/programm" },
  },
  "deutsches-romantik-museum": {
    lat: 50.1118,
    lng: 8.6776,
    exhibitionUrl: "https://deutsches-romantik-museum.de/ausstellungen/",
    eventApi: { type: "fdh", endpoint: "https://deutsches-romantik-museum.de/programm/" },
  },
  "dff-deutsches-filminstitut-filmmuseum": {
    lat: 50.1052,
    lng: 8.6728,
    exhibitionUrl: "https://www.dff.film/besuch/ausstellungen/",
    eventApi: { type: "tribe-events", endpoint: "https://www.dff.film/wp-json/tribe/events/v1/events" },
  },
  "dommuseum-frankfurt": {
    lat: 50.1114,
    lng: 8.6855,
    exhibitionUrl: "https://dommuseum-frankfurt.de/",
    eventApi: { type: "dommuseum", endpoint: "https://dommuseum-frankfurt.de/besuchen/kalender" },
  },
  "eintracht-frankfurt-museum": {
    lat: 50.0685,
    lng: 8.6455,
  },
  "fotografie-forum-frankfurt": {
    lat: 50.1118,
    lng: 8.6907,
    exhibitionUrl: "https://www.fffrankfurt.org/aktuell/",
  },
  "frankfurter-goethe-haus": {
    lat: 50.1113,
    lng: 8.6776,
    hidden: true,
    exhibitionUrl: "https://frankfurter-goethe-haus.de/ausstellungen/",
    eventApi: { type: "fdh", endpoint: "https://www.goethehaus-frankfurt.de/programm/" },
  },
  "frankfurter-kunstverein": {
    lat: 50.1108,
    lng: 8.6907,
    exhibitionUrl: "https://www.fkv.de/exhibitions-current-preview/",
    eventApi: { type: "fkv", endpoint: "https://www.fkv.de/current-events/" },
  },
  "geldmuseum-der-deutschen-bundesbank": {
    lat: 50.1283,
    lng: 8.6208,
    exhibitionUrl: "https://www.bundesbank.de/de/bundesbank/geldmuseum/ausstellungen/",
  },
  "haus-der-stadtgeschichte-of": {
    lat: 50.0984,
    lng: 8.7643,
    exhibitionUrl: "https://www.offenbach.de/microsite/haus_der_stadtgeschichte/ausstellungen/index.php",
  },
  "hindemith-kabinett": {
    lat: 50.1059,
    lng: 8.6969,
  },
  "historisches-museum-frankfurt": {
    lat: 50.1092,
    lng: 8.6819,
    exhibitionUrl: "https://www.historisches-museum-frankfurt.de/de/ausstellungen/",
    eventApi: { type: "historisches", endpoint: "https://historisches-museum-frankfurt.de/api/calendar" },
  },
  "ikonenmuseum-frankfurt": {
    lat: 50.1058,
    lng: 8.6961,
    exhibitionUrl: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/ausstellungen-im-ikonenmuseum/",
  },
  "institut-fuer-stadtgeschichte": {
    lat: 50.1088,
    lng: 8.673,
    exhibitionUrl: "https://www.stadtgeschichte-ffm.de/de/veranstaltungen/ausstellungen",
    eventApi: {
      type: "stadtgeschichte-rss",
      endpoint: "https://www.stadtgeschichte-ffm.de/rss/isg_rss.php?L=de",
    },
  },
  "juedisches-museum-frankfurt": {
    lat: 50.104,
    lng: 8.6649,
    exhibitionUrl: "https://www.juedischesmuseum.de/besuch/ausstellungen",
    eventApi: {
      type: "juedisches",
      endpoint: "https://www.juedischesmuseum.de/besuch/feed.json?records%5BL%5D=0&records%5Buid%5D=329",
    },
  },
  "juedisches-museum-museum-judengasse-frankfurt": {
    lat: 50.1143,
    lng: 8.6922,
    exhibitionUrl: "https://www.juedischesmuseum.de/besuch/museum-judengasse/",
  },
  "junges-museum-frankfurt": {
    lat: 50.109,
    lng: 8.683,
    exhibitionUrl: "https://junges-museum-frankfurt.de/ausstellung",
    eventApi: { type: "junges-museum", endpoint: "https://junges-museum-frankfurt.de/kalender" },
  },
  "klingspor-museum-of": {
    lat: 50.0988,
    lng: 8.77,
    exhibitionUrl: "https://www.offenbach.de/microsite/klingspor_museum/ausstellungen/index.php",
  },
  "liebieghaus-skulpturensammlung": {
    lat: 50.0996,
    lng: 8.66,
    exhibitionUrl: "https://www.liebieghaus.de/de/ausstellungen/",
    eventApi: { type: "liebieghaus", endpoint: "https://www.liebieghaus.de/de/kalender" },
  },
  "momem-museum-of-modern-electronic-music": {
    lat: 50.114,
    lng: 8.6727,
    exhibitionUrl: "https://momem.org/ausstellungen/",
  },
  "museum-angewandte-kunst": {
    lat: 50.1056,
    lng: 8.68,
    exhibitionUrl: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/",
    eventApi: { type: "mak", endpoint: "https://www.museumangewandtekunst.de/de/kalender/" },
  },
  "museum-fuer-kommunikation-frankfurt": {
    lat: 50.1038,
    lng: 8.6702,
    exhibitionUrl: "https://www.mfk-frankfurt.de/ausstellungen/",
    eventApi: { type: "my-calendar", endpoint: "https://www.mfk-frankfurt.de/wp-json/my-calendar/v1/events" },
  },
  "museum-giersch-der-goethe-universitaet": {
    lat: 50.0986,
    lng: 8.6545,
    exhibitionUrl: "https://www.mggu.de/ausstellungen/",
  },
  "museum-mmk-museum-mmk-fuer-moderne-kunst": {
    lat: 50.1126,
    lng: 8.6878,
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
  },
  "museum-sinclair-haus-bad-homburg": {
    lat: 50.2267,
    lng: 8.6124,
    exhibitionUrl: "https://kunst-und-natur.de/museum-sinclair-haus/ausstellungen/",
  },
  portikus: {
    lat: 50.1077,
    lng: 8.6891,
    exhibitionUrl: "https://www.portikus.de/de/exhibitions/",
  },
  "porzellan-museum-frankfurt": {
    lat: 50.0999,
    lng: 8.5476,
  },
  "schirn-kunsthalle-frankfurt": {
    lat: 50.1102,
    lng: 8.659,
    exhibitionUrl: "https://www.schirn.de/ausstellung/",
  },
  "schirn-in-bockenheim": {
    lat: 50.1102,
    lng: 8.659,
    exhibitionUrl: "https://www.schirn.de/ausstellung/",
  },
  "senckenberg-naturmuseum": {
    lat: 50.1175,
    lng: 8.6522,
    exhibitionUrl: "https://museumfrankfurt.senckenberg.de/de/ausstellungen/sonderausstellungen/",
    eventApi: {
      type: "senckenberg",
      endpoint: "https://museumfrankfurt.senckenberg.de/wp-json/wp/v2/events?per_page=100",
    },
  },
  "staedel-museum": {
    lat: 50.1016,
    lng: 8.6721,
    exhibitionUrl: "https://www.staedelmuseum.de/de/ausstellungen-programm",
    eventApi: { type: "staedel", endpoint: "https://www.staedelmuseum.de/de/api/finder" },
  },
  "stoltze-museum": {
    lat: 50.111,
    lng: 8.6846,
  },
  "struwwelpeter-museum": {
    lat: 50.1112,
    lng: 8.684,
    exhibitionUrl: "https://www.struwwelpeter-museum.de/sonderausstellungen/",
  },
  "tower-mmk-museum-mmk-fuer-moderne-kunst": {
    lat: 50.1105,
    lng: 8.6698,
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
  },
  "weltkulturen-museum": {
    lat: 50.1042,
    lng: 8.6779,
    exhibitionUrl: "https://weltkulturenmuseum.de/de/ausstellungen/",
  },
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst": {
    lat: 50.1122,
    lng: 8.6855,
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
  },

  // --- Manual additions (not on museumsufer.de) ---

  "kunststiftung-dz-bank": {
    name: "Kunststiftung DZ BANK",
    description: "Zeitgenössische Fotokunst und Medienkunst im Herzen Frankfurts.",
    image: "https://kunststiftungdzbank.de/wp-content/uploads/2026/02/Cwynar_Scroll-1-Still_akt.jpg",
    website: "https://kunststiftungdzbank.de/",
    lat: 50.1134,
    lng: 8.6696,
    exhibitionUrl: "https://kunststiftungdzbank.de/ausstellen/",
  },
  "feuerwehrmuseum-frankfurt": {
    name: "Feuerwehrmuseum Frankfurt am Main",
    description: "Geschichte der Brandbekämpfung und des Rettungswesens in Frankfurt.",
    image: "https://www.feuerwehrmuseum-frankfurt.de/bilder/01-hintergrund-startseite.jpg",
    website: "https://www.feuerwehrmuseum-frankfurt.de/",
    lat: 50.178,
    lng: 8.6608,
  },
  "frankfurter-feldbahnmuseum": {
    name: "Frankfurter Feldbahnmuseum",
    description: "Historische Feldbahnen und Schmalspurlokomotiven zum Anfassen und Mitfahren.",
    image: "https://www.feldbahn-ffm.de/wp-content/uploads/2021/11/ffm_aktuelles_21-10_20.jpg",
    website: "https://www.feldbahnmuseum.de/",
    lat: 50.1069,
    lng: 8.6119,
  },
  "verkehrsmuseum-frankfurt": {
    name: "Verkehrsmuseum Frankfurt am Main",
    description: "Verkehrsgeschichte mit historischen Straßenbahnen, Bussen und Schienenfahrzeugen.",
    image: "https://hsf-ffm.com/wp-content/uploads/2025/10/LinusWambach_23.03.2025-scaled.webp",
    website: "https://hsf-ffm.com/de/",
    lat: 50.0822,
    lng: 8.5816,
    exhibitionUrl: "https://hsf-ffm.com/de/termine/",
  },
  dialogmuseum: {
    name: "Dialogmuseum",
    description: "Ausstellung im Dunkeln — die Welt mit anderen Sinnen erleben.",
    image: "https://dialogmuseum.de/wp-content/uploads/2026/04/Wasserwesen-Banner-Web-Ready.webp",
    website: "https://www.dialogmuseum.de/",
    lat: 50.1131,
    lng: 8.6787,
    exhibitionUrl: "https://www.dialogmuseum.de/",
  },
  experiminta: {
    name: "EXPERIMINTA ScienceCenter",
    description: "Interaktive Experimentierstationen zu Naturwissenschaft, Technik und Mathematik.",
    image: "https://www.experiminta.de/wp-content/uploads/2025/08/Dauerausstellung-9-350x240.jpeg",
    website: "https://www.experiminta.de/",
    lat: 50.1154,
    lng: 8.6478,
    exhibitionUrl: "https://www.experiminta.de/ausstellungen/sonderausstellungen/",
  },
  atelierfrankfurt: {
    name: "Atelierfrankfurt",
    description: "Offene Ateliers und Ausstellungsräume für zeitgenössische Kunst im Ostend.",
    image: "https://www.atelierfrankfurt.de/wp-content/uploads/2021/02/Willkommen-im-AF-Link-Preview-1.png",
    website: "https://www.atelierfrankfurt.de/",
    lat: 50.1132,
    lng: 8.7197,
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
    exhibitionUrl: "https://www.frankfurter-buergerstiftung.de/programm/ausstellungen",
  },
  palmengarten: {
    name: "Palmengarten",
    description: "Botanischer Garten mit tropischen Gewächshäusern und Freilandanlagen.",
    image: "https://www.palmengarten.de/fileadmin/user_upload/Bilder/Kalender/fuehrungen_2023/imGartenSummts.jpg",
    website: "https://www.palmengarten.de/",
    lat: 50.1237,
    lng: 8.656,
    exhibitionUrl: "https://www.palmengarten.de/de/aktuelles.html",
  },
};

export function getMuseumConfig(slug: string): MuseumConfig | undefined {
  return MUSEUMS[slug];
}

export function getMuseumLocations(): Record<string, { lat: number; lng: number }> {
  const locations: Record<string, { lat: number; lng: number }> = {};
  for (const [slug, config] of Object.entries(MUSEUMS)) {
    locations[slug] = { lat: config.lat, lng: config.lng };
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
