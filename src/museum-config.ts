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
}

export const MUSEUMS: Record<string, MuseumConfig> = {
  "archaeologisches-museum-frankfurt": {
    lat: 50.1073,
    lng: 8.6832,
    rmvStopLid: "A=1@O=Frankfurt (Main) Elisabethenstraße@X=8688119@Y=50105882@U=80@L=3000905@",
    exhibitionUrl: "https://archaeologisches-museum-frankfurt.de/index.php/de/ausstellungen/",
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
    lat: 50.1109,
    lng: 8.6845,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    exhibitionUrl: "https://caricatura-museum.de/ausstellungen/sonderausstellung/",
  },
  "deutsches-architekturmuseum": {
    lat: 50.1049,
    lng: 8.6715,
    rmvStopLid: "A=1@O=Frankfurt (Main) Weser-/Münchener Straße@X=8670285@Y=50107958@U=80@L=3000007@",
    exhibitionUrl: "https://www.dam-online.de/programm/ausstellungen/",
    eventApi: { type: "tribe-events", endpoint: "https://dam-online.de/wp-json/tribe/events/v1/events" },
  },
  "deutsches-ledermuseum-of": {
    lat: 50.0984,
    lng: 8.7587,
    rmvStopLid: "A=1@O=Offenbach (Main)-Zentrum Hauptbahnhof@X=8760662@Y=50099643@U=80@L=3002501@",
    exhibitionUrl: "https://www.ledermuseum.de/ausstellungen",
    eventApi: { type: "ledermuseum", endpoint: "https://www.ledermuseum.de/programm" },
  },
  "deutsches-romantik-museum": {
    lat: 50.1118,
    lng: 8.6776,
    rmvStopLid: "A=1@O=Frankfurt (Main) Roßmarkt@X=8676029@Y=50112525@U=80@L=3000013@",
    exhibitionUrl: "https://deutsches-romantik-museum.de/ausstellungen/",
    eventApi: { type: "fdh", endpoint: "https://deutsches-romantik-museum.de/programm/" },
  },
  "dff-deutsches-filminstitut-filmmuseum": {
    lat: 50.1052,
    lng: 8.6728,
    rmvStopLid: "A=1@O=Frankfurt (Main) Weser-/Münchener Straße@X=8670285@Y=50107958@U=80@L=3000007@",
    exhibitionUrl: "https://www.dff.film/besuch/ausstellungen/",
    eventApi: { type: "tribe-events", endpoint: "https://www.dff.film/wp-json/tribe/events/v1/events" },
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
  },
  "fotografie-forum-frankfurt": {
    lat: 50.1118,
    lng: 8.6907,
    rmvStopLid: "A=1@O=Frankfurt (Main) Börneplatz/Stoltzestraße@X=8688874@Y=50112606@U=80@L=3060775@",
    exhibitionUrl: "https://www.fffrankfurt.org/aktuell/",
  },
  "frankfurter-goethe-haus": {
    lat: 50.1113,
    lng: 8.6776,
    rmvStopLid: "A=1@O=Frankfurt (Main) Karmeliterkloster@X=8678186@Y=50110125@U=80@L=3060835@",
    hidden: true,
    exhibitionUrl: "https://frankfurter-goethe-haus.de/ausstellungen/",
    eventApi: { type: "fdh", endpoint: "https://www.goethehaus-frankfurt.de/programm/" },
  },
  "frankfurter-kunstverein": {
    lat: 50.1108,
    lng: 8.6907,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hospital Zum Heiligen Geist@X=8692722@Y=50110637@U=80@L=3000524@",
    exhibitionUrl: "https://www.fkv.de/exhibitions-current-preview/",
    eventApi: { type: "fkv", endpoint: "https://www.fkv.de/current-events/" },
  },
  "geldmuseum-der-deutschen-bundesbank": {
    lat: 50.1283,
    lng: 8.6208,
    rmvStopLid: "A=1@O=Frankfurt (Main) Fischstein@X=8624952@Y=50129344@U=80@L=3001223@",
    exhibitionUrl: "https://www.bundesbank.de/de/bundesbank/geldmuseum/ausstellungen/",
  },
  "haus-der-stadtgeschichte-of": {
    lat: 50.0984,
    lng: 8.7643,
    rmvStopLid: "A=1@O=Offenbach (Main)-Senefelderquartier Friedensstraße@X=8766622@Y=50097864@U=80@L=3008612@",
    exhibitionUrl: "https://www.offenbach.de/microsite/haus_der_stadtgeschichte/ausstellungen/index.php",
  },
  "hindemith-kabinett": {
    lat: 50.1059,
    lng: 8.6969,
    rmvStopLid: "A=1@O=Frankfurt (Main) Zum Apothekerhof@X=8697953@Y=50105271@U=80@L=3001994@",
  },
  "historisches-museum-frankfurt": {
    lat: 50.1092,
    lng: 8.6819,
    rmvStopLid: "A=1@O=Frankfurt (Main) Römer/Paulskirche@X=8682007@Y=50110934@U=80@L=3000002@",
    exhibitionUrl: "https://www.historisches-museum-frankfurt.de/de/ausstellungen/",
    eventApi: { type: "historisches", endpoint: "https://historisches-museum-frankfurt.de/api/calendar" },
  },
  "ikonenmuseum-frankfurt": {
    lat: 50.1058,
    lng: 8.6961,
    rmvStopLid: "A=1@O=Frankfurt (Main) Wasserweg@X=8694798@Y=50105432@U=80@L=3000028@",
    skipEvents: true,
    exhibitionUrl: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/ausstellungen-im-ikonenmuseum/",
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
    lat: 50.104,
    lng: 8.6649,
    rmvStopLid: "A=1@O=Frankfurt (Main) Baseler Platz@X=8664792@Y=50104507@U=80@L=3000025@",
    exhibitionUrl: "https://www.juedischesmuseum.de/besuch/ausstellungen",
    eventApi: {
      type: "juedisches",
      endpoint: "https://www.juedischesmuseum.de/besuch/feed.json?records%5BL%5D=0&records%5Buid%5D=329",
    },
  },
  "juedisches-museum-museum-judengasse-frankfurt": {
    lat: 50.1143,
    lng: 8.6922,
    rmvStopLid: "A=1@O=Frankfurt (Main) Allerheiligentor@X=8693666@Y=50113316@U=80@L=3000523@",
    exhibitionUrl: "https://www.juedischesmuseum.de/besuch/museum-judengasse/",
  },
  "junges-museum-frankfurt": {
    lat: 50.109,
    lng: 8.683,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    exhibitionUrl: "https://junges-museum-frankfurt.de/ausstellung",
    eventApi: { type: "junges-museum", endpoint: "https://junges-museum-frankfurt.de/kalender" },
  },
  "klingspor-museum-of": {
    lat: 50.0988,
    lng: 8.77,
    rmvStopLid: "A=1@O=Offenbach (Main)-Mathildenviertel Tempelseestraße@X=8771234@Y=50101019@U=80@L=3002661@",
    exhibitionUrl: "https://www.offenbach.de/microsite/klingspor_museum/ausstellungen/index.php",
  },
  "liebieghaus-skulpturensammlung": {
    lat: 50.0996,
    lng: 8.66,
    rmvStopLid: "A=1@O=Frankfurt (Main) Zanderstraße@X=8658976@Y=50099922@U=80@L=3001978@",
    exhibitionUrl: "https://www.liebieghaus.de/de/ausstellungen/",
    eventApi: { type: "liebieghaus", endpoint: "https://www.liebieghaus.de/de/kalender" },
  },
  "momem-museum-of-modern-electronic-music": {
    lat: 50.114,
    lng: 8.6727,
    rmvStopLid: "A=1@O=Frankfurt (Main) Freßgass@X=8672406@Y=50114377@U=80@L=3065052@",
    exhibitionUrl: "https://momem.org/ausstellungen/",
  },
  "museum-angewandte-kunst": {
    lat: 50.1056,
    lng: 8.68,
    rmvStopLid: "A=1@O=Frankfurt (Main) Schweizer-/Gartenstraße@X=8679553@Y=50103338@U=80@L=3000914@",
    exhibitionUrl: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/",
    eventApi: { type: "mak", endpoint: "https://www.museumangewandtekunst.de/de/kalender/" },
  },
  "museum-fuer-kommunikation-frankfurt": {
    lat: 50.1038,
    lng: 8.6702,
    rmvStopLid: "A=1@O=Frankfurt (Main) Baseler Platz@X=8664792@Y=50104507@U=80@L=3000025@",
    exhibitionUrl: "https://www.mfk-frankfurt.de/ausstellungen/",
    eventApi: { type: "my-calendar", endpoint: "https://www.mfk-frankfurt.de/wp-json/my-calendar/v1/events" },
  },
  "museum-giersch-der-goethe-universitaet": {
    lat: 50.0986,
    lng: 8.6545,
    rmvStopLid: "A=1@O=Frankfurt (Main) Gutleut-/Heilbronner Straße@X=8654212@Y=50099751@U=80@L=3000016@",
    exhibitionUrl: "https://www.mggu.de/ausstellungen/",
  },
  "museum-mmk-museum-mmk-fuer-moderne-kunst": {
    lat: 50.1126,
    lng: 8.6878,
    rmvStopLid: "A=1@O=Frankfurt (Main) Börneplatz@X=8687993@Y=50112552@U=80@L=3000522@",
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
  },
  "museum-sinclair-haus-bad-homburg": {
    lat: 50.2267,
    lng: 8.6124,
    rmvStopLid: "A=1@O=Bad Homburg v.d.H. Markt@X=8612097@Y=50228890@U=80@L=3002349@",
    exhibitionUrl: "https://kunst-und-natur.de/museum-sinclair-haus/ausstellungen/",
  },
  portikus: {
    lat: 50.1077,
    lng: 8.6891,
    rmvStopLid: "A=1@O=Frankfurt (Main) Elisabethenstraße@X=8688119@Y=50105882@U=80@L=3000905@",
    exhibitionUrl: "https://www.portikus.de/de/exhibitions/",
  },
  "porzellan-museum-frankfurt": {
    lat: 50.0999,
    lng: 8.5476,
    rmvStopLid: "A=1@O=Frankfurt (Main) Mainberg@X=8549524@Y=50100012@U=80@L=3001005@",
  },
  "schirn-kunsthalle-frankfurt": {
    lat: 50.1102,
    lng: 8.659,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hohenstaufenstraße@X=8657655@Y=50110826@U=80@L=3001938@",
    exhibitionUrl: "https://www.schirn.de/ausstellung/",
  },
  "schirn-in-bockenheim": {
    lat: 50.1102,
    lng: 8.659,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hohenstaufenstraße@X=8657655@Y=50110826@U=80@L=3001938@",
    exhibitionUrl: "https://www.schirn.de/ausstellung/",
  },
  "senckenberg-naturmuseum": {
    lat: 50.1175,
    lng: 8.6522,
    rmvStopLid: "A=1@O=Frankfurt (Main) Senckenbergmuseum@X=8652720@Y=50117047@U=80@L=3000211@",
    exhibitionUrl: "https://museumfrankfurt.senckenberg.de/de/ausstellungen/sonderausstellungen/",
    eventApi: {
      type: "senckenberg",
      endpoint: "https://museumfrankfurt.senckenberg.de/wp-json/wp/v2/events?per_page=100",
    },
  },
  "staedel-museum": {
    lat: 50.1016,
    lng: 8.6721,
    rmvStopLid: "A=1@O=Frankfurt (Main) Otto-Hahn-Platz@X=8675678@Y=50101864@U=80@L=3000922@",
    exhibitionUrl: "https://www.staedelmuseum.de/de/ausstellungen-programm",
    eventApi: { type: "staedel", endpoint: "https://www.staedelmuseum.de/de/api/finder" },
  },
  "stoltze-museum": {
    lat: 50.111,
    lng: 8.6846,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
  },
  "struwwelpeter-museum": {
    lat: 50.1112,
    lng: 8.684,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
    exhibitionUrl: "https://www.struwwelpeter-museum.de/sonderausstellungen/",
  },
  "tower-mmk-museum-mmk-fuer-moderne-kunst": {
    lat: 50.1105,
    lng: 8.6698,
    rmvStopLid: "A=1@O=Frankfurt (Main) Weserstraße@X=8668837@Y=50109918@U=80@L=3060766@",
    spa: true,
    exhibitionUrl: "https://www.mmk.art/de/whats-on",
  },
  "weltkulturen-museum": {
    lat: 50.1042,
    lng: 8.6779,
    rmvStopLid: "A=1@O=Frankfurt (Main) Schweizer-/Gartenstraße@X=8679553@Y=50103338@U=80@L=3000914@",
    exhibitionUrl: "https://weltkulturenmuseum.de/de/ausstellungen/",
  },
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst": {
    lat: 50.1122,
    lng: 8.6855,
    rmvStopLid: "A=1@O=Frankfurt (Main) Dom/Römer@X=8684092@Y=50110862@U=80@L=3000003@",
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
    rmvStopLid: "A=1@O=Frankfurt (Main) Taunusanlage@X=8668765@Y=50113487@U=80@L=3000011@",
    exhibitionUrl: "https://kunststiftungdzbank.de/ausstellen/",
  },
  "feuerwehrmuseum-frankfurt": {
    name: "Feuerwehrmuseum Frankfurt am Main",
    description: "Geschichte der Brandbekämpfung und des Rettungswesens in Frankfurt.",
    image: "https://www.feuerwehrmuseum-frankfurt.de/bilder/01-hintergrund-startseite.jpg",
    website: "https://www.feuerwehrmuseum-frankfurt.de/",
    lat: 50.178,
    lng: 8.6608,
    rmvStopLid: "A=1@O=Frankfurt (Main) Alt-Bonames@X=8664037@Y=50180636@U=80@L=3001390@",
  },
  "frankfurter-feldbahnmuseum": {
    name: "Frankfurter Feldbahnmuseum",
    description: "Historische Feldbahnen und Schmalspurlokomotiven zum Anfassen und Mitfahren.",
    image: "https://www.feldbahn-ffm.de/wp-content/uploads/2021/11/ffm_aktuelles_21-10_20.jpg",
    website: "https://www.feldbahnmuseum.de/",
    lat: 50.1069,
    lng: 8.6119,
    rmvStopLid: "A=1@O=Frankfurt (Main) Gymnasium Römerhof@X=8609428@Y=50106646@U=80@L=3001499@",
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
  },
  dialogmuseum: {
    name: "Dialogmuseum",
    description: "Ausstellung im Dunkeln — die Welt mit anderen Sinnen erleben.",
    image: "https://dialogmuseum.de/wp-content/uploads/2026/04/Wasserwesen-Banner-Web-Ready.webp",
    website: "https://www.dialogmuseum.de/",
    lat: 50.1131,
    lng: 8.6787,
    rmvStopLid: "A=1@O=Frankfurt (Main) Hauptwache@X=8679292@Y=50113963@U=80@L=3000001@",
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
  },
  atelierfrankfurt: {
    name: "Atelierfrankfurt",
    description: "Offene Ateliers und Ausstellungsräume für zeitgenössische Kunst im Ostend.",
    image: "https://www.atelierfrankfurt.de/wp-content/uploads/2021/02/Willkommen-im-AF-Link-Preview-1.png",
    website: "https://www.atelierfrankfurt.de/",
    lat: 50.1132,
    lng: 8.7197,
    rmvStopLid: "A=1@O=Frankfurt (Main) Schwedlerstraße@X=8719447@Y=50113981@U=80@L=3001539@",
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
  },
  palmengarten: {
    name: "Palmengarten",
    description: "Botanischer Garten mit tropischen Gewächshäusern und Freilandanlagen.",
    image: "https://www.palmengarten.de/fileadmin/user_upload/Bilder/Kalender/fuehrungen_2023/imGartenSummts.jpg",
    website: "https://www.palmengarten.de/",
    lat: 50.1237,
    lng: 8.656,
    rmvStopLid: "A=1@O=Frankfurt (Main) Botanischer Garten@X=8654383@Y=50126171@U=80@L=3000215@",
    exhibitionUrl: "https://www.palmengarten.de/de/aktuelles.html",
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

export function getImageAllowedDomains(): Set<string> {
  const domains = new Set<string>(["museumsufer.de", "www.museumsufer.de"]);
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
