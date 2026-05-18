import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_BASE = "https://pupille.org/api";
const SITE_BASE = "https://pupille.org";
const IMAGE_BASE = "https://pupille.org/static-files/bilder/filmbilder";

interface PupilleFilm {
  fnr: number;
  titel: string;
  regie?: string | null;
  jahr?: number | null;
  laufzeit?: number | null;
  besonderheit?: string | null;
}

interface PupilleReihe {
  rnr: number;
  titel: string;
}

interface PupilleTermin {
  tnr: number;
  vorstellungsbeginn: string;
  titel: string | null;
  terminBesonderheit?: string | null;
  mainfilms: PupilleFilm[];
  reihen: PupilleReihe[];
  isCanceled: number | boolean | null;
}

interface PupilleSemester {
  termineSemester: PupilleTermin[];
}

interface PupilleDetail {
  termin: { bild?: string | null };
  mainfilms?: Array<{ film?: { bild?: string | null; kurztext?: string | null } }>;
}

export async function scrapePupille(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(`${API_BASE}/screenings/semester`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`pupille fetch failed: ${res.status}`);
  const data = (await res.json()) as PupilleSemester;

  const upcoming = data.termineSemester.filter((t) => t.vorstellungsbeginn.slice(0, 10) >= today && !t.isCanceled);
  // Enrich each upcoming screening with image + short description from the detail endpoint.
  // Limited to upcoming so we don't pay for the whole semester archive.
  const details = await Promise.all(
    upcoming.map(async (t): Promise<PupilleDetail | null> => {
      try {
        const r = await fetch(`${API_BASE}/screenings/${t.tnr}`, { headers: { Accept: "application/json" } });
        return r.ok ? ((await r.json()) as PupilleDetail) : null;
      } catch {
        return null;
      }
    }),
  );

  const events: CanonicalScrapedEvent[] = upcoming.map((t, i) => {
    const detail = details[i];
    const firstFilm = t.mainfilms[0];
    const filmDetail = detail?.mainfilms?.[0]?.film;
    const filmTitle = firstFilm?.titel ?? "";
    const title = t.titel?.trim() || filmTitle || `Termin ${t.tnr}`;
    const [dateIso, timeIso] = t.vorstellungsbeginn.split("T");
    const time = timeIso ? timeIso.slice(0, 5) : null;

    const subtitleParts = [
      firstFilm?.regie ? `R: ${firstFilm.regie}` : null,
      firstFilm?.jahr ? String(firstFilm.jahr) : null,
      firstFilm?.laufzeit ? `${firstFilm.laufzeit} min` : null,
    ].filter(Boolean);
    const subtitle = subtitleParts.length ? subtitleParts.join(" · ") : null;

    const reihe = t.reihen[0]?.titel ?? null;
    const description = filmDetail?.kurztext ? stripHtml(filmDetail.kurztext).trim() || null : null;

    const imageFile = filmDetail?.bild ?? detail?.termin.bild ?? null;
    const image_url = imageFile ? `${IMAGE_BASE}/${imageFile}` : null;

    return {
      source_event_id: String(t.tnr),
      title: filmTitle && t.titel ? `${t.titel}: ${filmTitle}` : title,
      subtitle,
      description,
      date: dateIso,
      time,
      detail_url: `${SITE_BASE}/screenings/${t.tnr}`,
      image_url,
      raw_category: reihe,
      labels: [
        { label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" },
        ...(reihe
          ? [{ label: `film:reihe:${reihe.toLowerCase()}`, confidence: 0.8, classifier: "scraper-hardcoded" as const }]
          : []),
      ],
    };
  });

  return { source_slug: "pupille", display_name: "Pupille — Kino an der Uni Frankfurt", events };
}
