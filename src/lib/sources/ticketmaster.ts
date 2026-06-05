import type { Category, RawEvent } from "@/lib/types";

// Ticketmaster Discovery API source adapter.
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
// Returns [] (never throws) when the API key is missing or any error occurs.

const MAX_EVENTS = 120;

interface TmImage {
  url?: string;
  width?: number;
  height?: number;
}

interface TmGenre {
  name?: string;
}

interface TmClassification {
  segment?: { name?: string };
  genre?: TmGenre;
  subGenre?: TmGenre;
}

interface TmVenue {
  name?: string;
}

interface TmPriceRange {
  min?: number;
  max?: number;
}

interface TmEvent {
  id?: string | number;
  name?: string;
  url?: string;
  images?: TmImage[];
  dates?: { start?: { dateTime?: string } };
  _embedded?: { venues?: TmVenue[] };
  priceRanges?: TmPriceRange[];
  classifications?: TmClassification[];
}

interface TmResponse {
  _embedded?: { events?: TmEvent[] };
}

function mapCategory(segmentName: string | undefined): Category {
  switch (segmentName) {
    case "Music":
      return "music";
    case "Arts & Theatre":
      return "arts";
    case "Film":
      return "arts";
    default:
      return "other";
  }
}

function pickImage(images: TmImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  let widest: TmImage | undefined;
  for (const img of images) {
    if (!img?.url) continue;
    if (!widest || (img.width ?? 0) > (widest.width ?? 0)) {
      widest = img;
    }
  }
  return widest?.url ?? images[0]?.url ?? null;
}

function buildTags(classification: TmClassification | undefined): string[] {
  if (!classification) return [];
  const tags: string[] = [];
  const genre = classification.genre?.name;
  const subGenre = classification.subGenre?.name;
  if (genre && genre !== "Undefined") tags.push(genre);
  if (subGenre && subGenre !== "Undefined") tags.push(subGenre);
  return tags;
}

export async function fetchFromTicketmaster(): Promise<RawEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  try {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    const params = new URLSearchParams({
      apikey: apiKey,
      city: "San Francisco",
      size: "100",
      sort: "date,asc",
      startDateTime: now,
    });

    const endpoint = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;

    const res = await fetch(endpoint, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as TmResponse;
    const events = data?._embedded?.events ?? [];

    const mapped: RawEvent[] = [];
    for (const ev of events) {
      if (!ev?.id || !ev?.name || !ev?.url) continue;

      const classification = ev.classifications?.[0];
      const segmentName = classification?.segment?.name;

      const priceRange = ev.priceRanges?.[0];
      let priceMin: number | null = null;
      let priceMax: number | null = null;
      let isFree: boolean | undefined;
      if (priceRange) {
        if (typeof priceRange.min === "number") {
          priceMin = Math.round(priceRange.min * 100);
          isFree = priceRange.min === 0;
        }
        if (typeof priceRange.max === "number") {
          priceMax = Math.round(priceRange.max * 100);
        }
      }

      const raw: RawEvent = {
        source: "ticketmaster",
        sourceId: String(ev.id),
        title: ev.name,
        url: ev.url,
        imageUrl: pickImage(ev.images),
        venue: ev._embedded?.venues?.[0]?.name ?? null,
        startTime: ev.dates?.start?.dateTime ?? null,
        priceMin,
        priceMax,
        category: mapCategory(segmentName),
        tags: buildTags(classification),
        raw: ev,
      };

      if (isFree !== undefined) raw.isFree = isFree;

      mapped.push(raw);
      if (mapped.length >= MAX_EVENTS) break;
    }

    return mapped;
  } catch {
    return [];
  }
}
