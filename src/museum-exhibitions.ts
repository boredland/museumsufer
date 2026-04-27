export interface ExhibitionPageConfig {
  url: string;
  js?: true;
}

export const MUSEUM_EXHIBITION_URLS: Record<string, ExhibitionPageConfig> = {
  "archaeologisches-museum-frankfurt": {
    url: "https://archaeologisches-museum-frankfurt.de/index.php/de/ausstellungen/",
  },
  "bibelhaus-erlebnismuseum": {
    url: "https://www.bibelhaus-frankfurt.de/de/ausstellungen",
    js: true,
  },
  "caricatura-museum-frankfurt": {
    url: "https://caricatura-museum.de/ausstellungen/sonderausstellung/",
  },
  "deutsches-architekturmuseum": {
    url: "https://www.dam-online.de/programm/ausstellungen/",
  },
  "deutsches-ledermuseum-of": {
    url: "https://www.ledermuseum.de/ausstellungen",
  },
  "deutsches-romantik-museum": {
    url: "https://deutsches-romantik-museum.de/ausstellungen/",
  },
  "dff-deutsches-filminstitut-filmmuseum": {
    url: "https://www.dff.film/besuch/ausstellungen/",
  },
  "dommuseum-frankfurt": {
    url: "https://dommuseum-frankfurt.de/",
    js: true,
  },
  "fotografie-forum-frankfurt": {
    url: "https://www.fffrankfurt.org/aktuell/",
  },
  "frankfurter-goethe-haus": {
    url: "https://frankfurter-goethe-haus.de/ausstellungen/",
  },
  "frankfurter-kunstverein": {
    url: "https://www.fkv.de/exhibitions-current-preview/",
  },
  "geldmuseum-der-deutschen-bundesbank": {
    url: "https://www.bundesbank.de/de/bundesbank/geldmuseum/ausstellungen/",
  },
  "haus-der-stadtgeschichte-of": {
    url: "https://www.offenbach.de/microsite/haus_der_stadtgeschichte/ausstellungen/index.php",
  },
  "historisches-museum-frankfurt": {
    url: "https://www.historisches-museum-frankfurt.de/de/ausstellungen/",
  },
  "ikonenmuseum-frankfurt": {
    url: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/ausstellungen-im-ikonenmuseum/",
  },
  "institut-fuer-stadtgeschichte": {
    url: "https://www.stadtgeschichte-ffm.de/de/veranstaltungen/ausstellungen",
  },
  "juedisches-museum-frankfurt": {
    url: "https://www.juedischesmuseum.de/besuch/ausstellungen",
  },
  "juedisches-museum-museum-judengasse-frankfurt": {
    url: "https://www.juedischesmuseum.de/besuch/museum-judengasse/",
  },
  "junges-museum-frankfurt": {
    url: "https://junges-museum-frankfurt.de/ausstellung",
  },
  "klingspor-museum-of": {
    url: "https://www.offenbach.de/microsite/klingspor_museum/ausstellungen/index.php",
  },
  "liebieghaus-skulpturensammlung": {
    url: "https://www.liebieghaus.de/de/ausstellungen/",
  },
  "momem-museum-of-modern-electronic-music": {
    url: "https://momem.org/ausstellungen/",
  },
  "museum-angewandte-kunst": {
    url: "https://www.museumangewandtekunst.de/de/besuch/ausstellungen/",
  },
  "museum-fuer-kommunikation-frankfurt": {
    url: "https://www.mfk-frankfurt.de/ausstellungen/",
  },
  "museum-giersch-der-goethe-universitaet": {
    url: "https://www.mggu.de/ausstellungen/",
  },
  "museum-mmk-museum-mmk-fuer-moderne-kunst": {
    url: "https://www.mmk.art/de/whats-on",
    js: true,
  },
  "museum-sinclair-haus-bad-homburg": {
    url: "https://kunst-und-natur.de/museum-sinclair-haus/ausstellungen/",
  },
  portikus: {
    url: "https://www.portikus.de/de/exhibitions/",
  },
  "schirn-kunsthalle-frankfurt": {
    url: "https://www.schirn.de/ausstellung/",
  },
  "schirn-in-bockenheim": {
    url: "https://www.schirn.de/ausstellung/",
  },
  "senckenberg-naturmuseum": {
    url: "https://museumfrankfurt.senckenberg.de/de/ausstellungen/sonderausstellungen/",
  },
  "staedel-museum": {
    url: "https://www.staedelmuseum.de/de/ausstellungen-programm",
  },
  "struwwelpeter-museum": {
    url: "https://www.struwwelpeter-museum.de/sonderausstellungen/",
  },
  "tower-mmk-museum-mmk-fuer-moderne-kunst": {
    url: "https://www.mmk.art/de/whats-on",
    js: true,
  },
  "weltkulturen-museum": {
    url: "https://weltkulturenmuseum.de/de/ausstellungen/",
  },
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst": {
    url: "https://www.mmk.art/de/whats-on",
    js: true,
  },
};
