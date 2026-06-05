// GET /api/digest — emails the top-ranked upcoming events.
// Sends via Resend when RESEND_API_KEY is set; graceful no-op otherwise.
// Mirrors the LLM-optional pattern: { ok, sent, count } either way.
import { NextResponse } from "next/server";
import { gte, isNull, or, sql } from "drizzle-orm";
import { db, events } from "@/db";
import { getOrCreateProfile, rankEvents } from "@/lib/match";
import { resend, hasEmail, DIGEST_TO, DIGEST_FROM } from "@/lib/email";
import { type Category, type EventDTO, CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOP_N = 10;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderDigest(events: { title: string; score: number; reason: string; url: string }[]): string {
  const items = events
    .map(
      (e) => `
      <li style="margin:0 0 16px;">
        <a href="${escapeHtml(e.url)}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none;">${escapeHtml(e.title)}</a>
        <span style="color:#888;font-size:13px;"> · ${e.score}/100</span>
        <div style="color:#555;font-size:14px;margin-top:2px;">${escapeHtml(e.reason)}</div>
      </li>`
    )
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;">
    <h1 style="font-size:20px;">Your Afoot digest — top SF events</h1>
    <ul style="list-style:none;padding:0;">${items}</ul>
  </div>`;
}

export async function GET() {
  // Same "upcoming" window the feed uses: started within the last 12h or undated.
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(events)
    .where(or(gte(events.startTime, cutoff), isNull(events.startTime)))
    .orderBy(sql`${events.startTime} asc nulls last`)
    .limit(250);

  const profile = await getOrCreateProfile();
  const ranked = await rankEvents(rows.map(rowToDTO), profile);
  const top = ranked.slice(0, TOP_N);
  const count = top.length;

  if (!hasEmail || count === 0) {
    return NextResponse.json({ ok: true, sent: false, count });
  }

  const html = renderDigest(top);
  await resend!.emails.send({
    from: DIGEST_FROM,
    to: DIGEST_TO,
    subject: `Afoot — ${count} SF events picked for you`,
    html,
  });

  return NextResponse.json({ ok: true, sent: true, count });
}
