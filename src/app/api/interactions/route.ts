// POST /api/interactions { eventId, action } → { ok: true }. Owned by Stream B.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, interactions } from "@/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  action: z.enum(["save", "dismiss", "going"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid interaction", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    await db.insert(interactions).values({
      eventId: parsed.data.eventId,
      action: parsed.data.action,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/interactions failed:", err);
    return NextResponse.json({ error: "failed to record interaction" }, { status: 500 });
  }
}
