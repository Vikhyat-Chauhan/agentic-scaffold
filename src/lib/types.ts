// Shared types — FROZEN CONTRACT for all streams.
// Streams A (ingestion), B (matching/API), C (UI) all depend on these. Do not change
// without coordinating across streams.

export type Category =
  | "tech"
  | "music"
  | "nightlife"
  | "food"
  | "arts"
  | "outdoors"
  | "wellness"
  | "community"
  | "family"
  | "learning"
  | "business"
  | "other";

export const CATEGORIES: Category[] = [
  "tech",
  "music",
  "nightlife",
  "food",
  "arts",
  "outdoors",
  "wellness",
  "community",
  "family",
  "learning",
  "business",
  "other",
];

/** A normalized event ready to upsert into the DB (produced by source adapters). */
export interface RawEvent {
  source: string; // 'funcheap' | '19hz' | 'ticketmaster' | 'eventbrite'
  sourceId: string; // stable natural key within the source
  title: string;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  venue?: string | null;
  neighborhood?: string | null;
  startTime?: string | null; // ISO 8601
  endTime?: string | null; // ISO 8601
  isFree?: boolean;
  priceMin?: number | null; // cents
  priceMax?: number | null; // cents
  category?: Category;
  tags?: string[];
  raw?: unknown;
}

/** An event as returned by the API to the client. */
export interface EventDTO {
  id: string;
  source: string;
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  venue: string | null;
  neighborhood: string | null;
  startTime: string | null; // ISO
  endTime: string | null; // ISO
  isFree: boolean;
  priceMin: number | null; // cents
  priceMax: number | null; // cents
  category: Category;
  tags: string[];
}

/** An event plus its personalized match data. Returned by GET /api/feed. */
export interface RankedEvent extends EventDTO {
  score: number; // 0-100
  reason: string; // short "why this fits you"
  saved: boolean;
}

/** The single-user taste profile. */
export interface Profile {
  id: string; // always 'me'
  interests: Category[];
  vibe: string; // free-text description of what they're into
  neighborhoods: string[];
  priceMaxCents: number | null; // null = no limit
  updatedAt: string;
}

export const DEFAULT_PROFILE: Omit<Profile, "updatedAt"> = {
  id: "me",
  interests: ["tech", "music", "food", "arts"],
  vibe:
    "I love discovering things to do in San Francisco — startup and AI meetups, live music and DJ nights, food pop-ups and tastings, and gallery openings or film screenings. Bonus for free or cheap events I can bring friends to.",
  neighborhoods: [],
  priceMaxCents: null,
};

export type InteractionAction = "save" | "dismiss" | "going";
