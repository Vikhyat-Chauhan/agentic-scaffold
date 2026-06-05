// GET /api/feed — the personalized, ranked feed.
// Returns { events: RankedEvent[], profile, stats }. Owned by Stream B.
import { NextResponse } from "next/server";
import { and, count, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db, events, interactions } from "@/db";
import { getOrCreateProfile, rankEvents } from "@/lib/match";
import {
  type Category,
  type EventDTO,
  CATEGORIES,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type EventRow = typeof events.$inferSelect;

function rowToDTO(row: EventRow): EventDTO {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description ?? null,
    url: row.url,
    imageUrl: row.imageUrl ?? null,
    venue: row.venue ?? null,
    neighborhood: row.neighborhood ?? null,
    startTime: row.startTime ? new Date(row.startTime).toISOString() : null,
    endTime: row.endTime ? new Date(row.endTime).toISOString() : null,
    isFree: row.isFree,
    priceMin: row.priceMin ?? null,
    priceMax: row.priceMax ?? null,
    category: (CATEGORIES.includes(row.category as Category)
      ? (row.category as Category)
      : "other") as Category,
    tags: (row.tags as string[]) ?? [],
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const categoryParam = url.searchParams.get("category");
    const freeParam = url.searchParams.get("free");
    const whenParam = url.searchParams.get("when");

    const profile = await getOrCreateProfile();

    // "Upcoming" — started within the last 12h or undated; undated rank lower later.
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const filters = [or(gte(events.startTime, cutoff), isNull(events.startTime))];

    if (categoryParam && CATEGORIES.includes(categoryParam as Category)) {
      filters.push(eq(events.category, categoryParam));
    }
    if (freeParam === "true" || freeParam === "1") {
      filters.push(eq(events.isFree, true));
    }
    // Time-window filters. The UI sends "today" / "weekend"; "week" kept as an
    // alias. Each adds an upper bound on start_time, which also drops undated
    // events from day-specific views (NULL comparisons are excluded by lte/gte).
    if (whenParam === "today") {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      filters.push(lte(events.startTime, end));
    } else if (whenParam === "weekend") {
      const now = new Date();
      const day = now.getDay(); // 0 Sun .. 6 Sat
      const sat = new Date(now);
      sat.setDate(now.getDate() + (day === 0 ? -1 : 6 - day));
      sat.setHours(0, 0, 0, 0);
      const sunEnd = new Date(sat);
      sunEnd.setDate(sat.getDate() + 1);
      sunEnd.setHours(23, 59, 59, 999);
      filters.push(gte(events.startTime, sat));
      filters.push(lte(events.startTime, sunEnd));
    } else if (whenParam === "week") {
      const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      filters.push(lte(events.startTime, weekEnd));
    }

    const rows = await db
      .select()
      .from(events)
      .where(and(...filters))
      .orderBy(sql`${events.startTime} asc nulls last`)
      .limit(250);

    // Saved / dismissed sets from interactions.
    const inter = await db
      .select({ eventId: interactions.eventId, action: interactions.action })
      .from(interactions);
    const saved = new Set<string>();
    const dismissed = new Set<string>();
    for (const i of inter) {
      if (i.action === "save" || i.action === "going") saved.add(i.eventId);
      if (i.action === "dismiss") dismissed.add(i.eventId);
    }

    const dtos = rows.map(rowToDTO).filter((e) => !dismissed.has(e.id));

    const ranked = await rankEvents(dtos, profile);
    for (const e of ranked) e.saved = saved.has(e.id);

    const [{ total }] = await db.select({ total: count() }).from(events);
    const [{ lastIngest }] = await db
      .select({ lastIngest: sql<string | null>`max(${events.updatedAt})` })
      .from(events);

    return NextResponse.json({
      events: ranked,
      profile,
      stats: {
        total: Number(total),
        shown: ranked.length,
        lastIngest: lastIngest ? new Date(lastIngest).toISOString() : null,
      },
    });
  } catch (err) {
    console.error("GET /api/feed failed:", err);
    return NextResponse.json({ error: "failed to load feed" }, { status: 500 });
  }
}
