// GET /api/profile → { profile }.  PUT /api/profile (Partial<Profile>) → { profile }.
// PUT invalidates the match cache. Owned by Stream B.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateProfile, updateProfile } from "@/lib/match";
import { CATEGORIES, type Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getOrCreateProfile();
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("GET /api/profile failed:", err);
    return NextResponse.json({ error: "failed to load profile" }, { status: 500 });
  }
}

const patchSchema = z
  .object({
    interests: z.array(z.enum(CATEGORIES as [Category, ...Category[]])).optional(),
    vibe: z.string().max(2000).optional(),
    neighborhoods: z.array(z.string()).optional(),
    priceMaxCents: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid profile patch", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const profile = await updateProfile(parsed.data);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("PUT /api/profile failed:", err);
    return NextResponse.json({ error: "failed to update profile" }, { status: 500 });
  }
}
