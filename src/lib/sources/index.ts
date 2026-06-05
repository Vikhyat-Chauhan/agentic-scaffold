// Ingestion orchestrator — runs all source adapters and upserts results.
// All DB access goes through "@/db" only.
import { sql } from "drizzle-orm";

import { db, events } from "@/db";
import type { RawEvent } from "@/lib/types";

import { fetchFromFuncheap } from "./funcheap";
import { fetchFrom19hz } from "./nineteenhz";
import { fetchFromTicketmaster } from "./ticketmaster";
import { fetchFromEventbrite } from "./eventbrite";

type SourceKey = "funcheap" | "19hz" | "ticketmaster" | "eventbrite";

const SOURCES: { key: SourceKey; fetch: () => Promise<RawEvent[]> }[] = [
  { key: "funcheap", fetch: fetchFromFuncheap },
  { key: "19hz", fetch: fetchFrom19hz },
  { key: "ticketmaster", fetch: fetchFromTicketmaster },
  { key: "eventbrite", fetch: fetchFromEventbrite },
];

export async function runAllSources(): Promise<{
  counts: Record<string, number>;
  events: RawEvent[];
}> {
  const counts: Record<string, number> = {};
  const combined: RawEvent[] = [];

  const results = await Promise.allSettled(SOURCES.map((s) => s.fetch()));

  results.forEach((result, i) => {
    const key = SOURCES[i].key;
    if (result.status === "fulfilled") {
      const list = result.value ?? [];
      counts[key] = list.length;
      combined.push(...list);
    } else {
      counts[key] = 0;
    }
  });

  return { counts, events: combined };
}

const CHUNK_SIZE = 100;

export async function upsertEvents(list: RawEvent[]): Promise<number> {
  const valid = list.filter((e) => e.title && e.url);

  const rows = valid.map((e) => ({
    source: e.source,
    sourceId: e.sourceId,
    title: e.title,
    description: e.description ?? null,
    url: e.url,
    imageUrl: e.imageUrl ?? null,
    venue: e.venue ?? null,
    neighborhood: e.neighborhood ?? null,
    startTime: e.startTime ? new Date(e.startTime) : null,
    endTime: e.endTime ? new Date(e.endTime) : null,
    isFree: e.isFree ?? false,
    priceMin: e.priceMin ?? null,
    priceMax: e.priceMax ?? null,
    category: e.category ?? "other",
    tags: e.tags ?? [],
    raw: e,
  }));

  let total = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db
      .insert(events)
      .values(chunk)
      .onConflictDoUpdate({
        target: [events.source, events.sourceId],
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          url: sql`excluded.url`,
          imageUrl: sql`excluded.image_url`,
          venue: sql`excluded.venue`,
          neighborhood: sql`excluded.neighborhood`,
          startTime: sql`excluded.start_time`,
          endTime: sql`excluded.end_time`,
          isFree: sql`excluded.is_free`,
          priceMin: sql`excluded.price_min`,
          priceMax: sql`excluded.price_max`,
          category: sql`excluded.category`,
          tags: sql`excluded.tags`,
          raw: sql`excluded.raw`,
          updatedAt: new Date(),
        },
      });

    total += chunk.length;
  }

  return total;
}

export async function ingestAll(): Promise<{
  ok: boolean;
  counts: Record<string, number>;
  total: number;
}> {
  try {
    const result = await runAllSources();
    const total = await upsertEvents(result.events);
    return { ok: true, counts: result.counts, total };
  } catch {
    return { ok: false, counts: {}, total: 0 };
  }
}
