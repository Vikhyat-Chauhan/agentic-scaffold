// Matching engine — turns raw events into a personalized, ranked feed.
// Heuristic scoring works with zero LLM; when a key is present, top candidates
// are re-scored in batches and cached in match_cache keyed by (eventId, profileHash).
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, profiles, matchCache } from "@/db";
import { anthropic, hasLLM, MODEL, textOf, parseJsonLoose } from "@/lib/anthropic";
import { categoryLabel } from "@/lib/categories";
import {
  type Category,
  type EventDTO,
  type Profile,
  type RankedEvent,
  CATEGORIES,
  DEFAULT_PROFILE,
} from "@/lib/types";

const PROFILE_ID = "me";

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

type ProfileRow = typeof profiles.$inferSelect;

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    interests: (row.interests as Category[]) ?? [],
    vibe: row.vibe ?? "",
    neighborhoods: (row.neighborhoods as string[]) ?? [],
    priceMaxCents: row.priceMaxCents ?? null,
    updatedAt: (row.updatedAt instanceof Date
      ? row.updatedAt
      : new Date(row.updatedAt)
    ).toISOString(),
  };
}

export async function getOrCreateProfile(): Promise<Profile> {
  const found = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, PROFILE_ID))
    .limit(1);
  if (found.length) return rowToProfile(found[0]);

  const inserted = await db
    .insert(profiles)
    .values({
      id: DEFAULT_PROFILE.id,
      interests: DEFAULT_PROFILE.interests,
      vibe: DEFAULT_PROFILE.vibe,
      neighborhoods: DEFAULT_PROFILE.neighborhoods,
      priceMaxCents: DEFAULT_PROFILE.priceMaxCents,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length) return rowToProfile(inserted[0]);
  // Lost a race — read the row that the other writer created.
  const again = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, PROFILE_ID))
    .limit(1);
  return rowToProfile(again[0]);
}

export type ProfilePatch = Partial<
  Pick<Profile, "interests" | "vibe" | "neighborhoods" | "priceMaxCents">
>;

export async function updateProfile(patch: ProfilePatch): Promise<Profile> {
  const current = await getOrCreateProfile();
  const next: Profile = {
    ...current,
    ...("interests" in patch && patch.interests ? { interests: patch.interests } : {}),
    ...("vibe" in patch && patch.vibe !== undefined ? { vibe: patch.vibe } : {}),
    ...("neighborhoods" in patch && patch.neighborhoods
      ? { neighborhoods: patch.neighborhoods }
      : {}),
    ...("priceMaxCents" in patch ? { priceMaxCents: patch.priceMaxCents ?? null } : {}),
  };

  const updated = await db
    .update(profiles)
    .set({
      interests: next.interests,
      vibe: next.vibe,
      neighborhoods: next.neighborhoods,
      priceMaxCents: next.priceMaxCents,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, PROFILE_ID))
    .returning();

  // Taste changed → existing cached scores are stale. Drop them all.
  await db.delete(matchCache);

  return rowToProfile(updated[0]);
}

// ---------------------------------------------------------------------------
// Stable profile hash (djb2 over a canonical JSON shape)
// ---------------------------------------------------------------------------

export function profileHash(p: Profile): string {
  const canonical = JSON.stringify({
    interests: [...p.interests].sort(),
    vibe: p.vibe.trim(),
    priceMaxCents: p.priceMaxCents ?? null,
  });
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) {
    h = ((h << 5) + h + canonical.charCodeAt(i)) | 0; // h * 33 + c
  }
  return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// Heuristic scoring (no LLM required)
// ---------------------------------------------------------------------------

const STOP = new Set([
  "the", "and", "for", "with", "you", "your", "are", "but", "out", "all",
  "can", "into", "love", "like", "into", "that", "this", "from", "have",
  "things", "i", "to", "a", "of", "in", "or", "do", "it", "an", "on",
  "san", "francisco", "sf", "bay", "area", "events", "event",
]);

function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

function likesCheap(profile: Profile): boolean {
  return profile.priceMaxCents !== null || /\bfree\b|\bcheap\b/i.test(profile.vibe);
}

export function heuristicScore(event: EventDTO, profile: Profile): number {
  let score = 30; // baseline

  if (profile.interests.includes(event.category)) score += 45;

  // Keyword overlap: profile taste vocab vs event vocab, 6 pts each up to 30.
  const tasteVocab = tokenize(profile.vibe + " " + profile.interests.join(" "));
  const eventVocab = tokenize(
    event.title + " " + event.tags.join(" ") + " " + event.category
  );
  let overlaps = 0;
  for (const w of eventVocab) if (tasteVocab.has(w)) overlaps++;
  score += Math.min(overlaps * 6, 30);

  if (event.isFree && likesCheap(profile)) score += 10;

  if (
    profile.priceMaxCents !== null &&
    event.priceMin !== null &&
    event.priceMin > profile.priceMaxCents
  ) {
    score -= 25;
  }

  if (event.startTime) {
    const days = (new Date(event.startTime).getTime() - Date.now()) / 86_400_000;
    if (days >= 0 && days <= 7) score += 8;
    else if (days > 7 && days <= 14) score += 4;
  }

  return Math.max(5, Math.min(98, Math.round(score)));
}

export function templatedReason(event: EventDTO, profile: Profile): string {
  if (profile.interests.includes(event.category)) {
    return `Right up your alley — ${categoryLabel(event.category).toLowerCase()} you follow`;
  }
  const tasteVocab = tokenize(profile.vibe + " " + profile.interests.join(" "));
  const eventVocab = tokenize(event.title + " " + event.tags.join(" "));
  const hit = [...eventVocab].find((w) => tasteVocab.has(w));
  if (hit) return `Matches your taste for ${hit}`;
  if (event.isFree && likesCheap(profile)) return "Free pick worth a look";
  return `A ${categoryLabel(event.category).toLowerCase()} option near you`;
}

// ---------------------------------------------------------------------------
// LLM batch re-scoring
// ---------------------------------------------------------------------------

const TOP_LLM = 45;
const BATCH = 22;

function priceLabel(e: EventDTO): string {
  if (e.isFree) return "Free";
  if (e.priceMin === null && e.priceMax === null) return "Price unknown";
  const fmt = (c: number) => `$${(c / 100).toFixed(0)}`;
  if (e.priceMin !== null && e.priceMax !== null && e.priceMin !== e.priceMax)
    return `${fmt(e.priceMin)}–${fmt(e.priceMax)}`;
  return fmt((e.priceMin ?? e.priceMax) as number);
}

function whenLabel(e: EventDTO): string {
  if (!e.startTime) return "Date TBD";
  return new Date(e.startTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

interface LlmScore {
  id: string;
  score: number;
  reason: string;
}

function buildSystem(profile: Profile): string {
  return [
    "You score San Francisco events for one person by how well each fits their taste.",
    "Their taste:",
    `- Interests: ${profile.interests.join(", ") || "(none stated)"}`,
    `- In their words: ${profile.vibe || "(none)"}`,
    profile.priceMaxCents !== null
      ? `- Budget ceiling: $${(profile.priceMaxCents / 100).toFixed(0)}`
      : "- No budget limit",
    "",
    "Return ONLY a JSON array, no prose. One object per event you were given:",
    '[{"id": "<id>", "score": <0-100 integer>, "reason": "<why it fits, second person, specific, <=12 words>"}]',
    "Score honestly: high for strong taste matches, low for poor fits.",
    'Reasons must address the person directly (e.g. "Right up your alley — AI + live music").',
  ].join("\n");
}

async function scoreBatchWithLlm(
  batch: EventDTO[],
  profile: Profile
): Promise<Map<string, LlmScore>> {
  const payload = batch.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    tags: e.tags.slice(0, 6),
    price: priceLabel(e),
    when: whenLabel(e),
    desc: (e.description ?? "").slice(0, 160),
  }));

  const msg = await anthropic!.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: buildSystem(profile),
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  const parsed = parseJsonLoose<unknown>(textOf(msg));
  if (!Array.isArray(parsed)) throw new Error("LLM did not return an array");

  const valid = new Set(batch.map((e) => e.id));
  const out = new Map<string, LlmScore>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    const score = Number(o.score);
    const reason = String(o.reason ?? "").trim();
    if (!valid.has(id) || !Number.isFinite(score) || !reason) continue;
    out.set(id, {
      id,
      score: Math.max(0, Math.min(100, Math.round(score))),
      reason: reason.slice(0, 120),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// rankEvents — the public entry point
// ---------------------------------------------------------------------------

export async function rankEvents(
  evts: EventDTO[],
  profile: Profile
): Promise<RankedEvent[]> {
  if (evts.length === 0) return [];

  const hash = profileHash(profile);
  const heur = new Map<string, number>();
  for (const e of evts) heur.set(e.id, heuristicScore(e, profile));

  // Top heuristic scorers are the LLM candidates.
  const byHeur = [...evts].sort(
    (a, b) => (heur.get(b.id) ?? 0) - (heur.get(a.id) ?? 0)
  );
  const candidates = byHeur.slice(0, Math.min(TOP_LLM, byHeur.length));
  const candidateIds = candidates.map((e) => e.id);

  // Final score/reason per event id.
  const scored = new Map<string, { score: number; reason: string }>();

  if (hasLLM && candidateIds.length) {
    // (c) Read any cached scores for these candidates at this profile hash.
    const cached = await db
      .select()
      .from(matchCache)
      .where(
        and(
          eq(matchCache.profileHash, hash),
          inArray(matchCache.eventId, candidateIds)
        )
      );
    const cacheMap = new Map(cached.map((r) => [r.eventId, r]));

    const misses: EventDTO[] = [];
    for (const e of candidates) {
      const hit = cacheMap.get(e.id);
      if (hit) scored.set(e.id, { score: hit.score, reason: hit.reason });
      else misses.push(e);
    }

    // (d) Score misses in batches; cache successes; fall back per-batch on error.
    for (let i = 0; i < misses.length; i += BATCH) {
      const batch = misses.slice(i, i + BATCH);
      try {
        const llm = await scoreBatchWithLlm(batch, profile);
        const toCache: {
          eventId: string;
          profileHash: string;
          score: number;
          reason: string;
        }[] = [];
        for (const e of batch) {
          const r = llm.get(e.id);
          if (r) {
            scored.set(e.id, { score: r.score, reason: r.reason });
            toCache.push({
              eventId: e.id,
              profileHash: hash,
              score: r.score,
              reason: r.reason,
            });
          } else {
            // Missing from LLM output — heuristic fallback for this one.
            scored.set(e.id, {
              score: heur.get(e.id) ?? 0,
              reason: templatedReason(e, profile),
            });
          }
        }
        if (toCache.length) {
          await db
            .insert(matchCache)
            .values(toCache)
            .onConflictDoUpdate({
              target: [matchCache.eventId, matchCache.profileHash],
              set: {
                score: sql`excluded.score`,
                reason: sql`excluded.reason`,
                updatedAt: new Date(),
              },
            });
        }
      } catch {
        for (const e of batch) {
          scored.set(e.id, {
            score: heur.get(e.id) ?? 0,
            reason: templatedReason(e, profile),
          });
        }
      }
    }
  }

  // (e) Everything not LLM-scored (beyond top 45, or no LLM) → heuristic.
  for (const e of evts) {
    if (!scored.has(e.id)) {
      scored.set(e.id, {
        score: heur.get(e.id) ?? 0,
        reason: templatedReason(e, profile),
      });
    }
  }

  // (f) Assemble + sort: score desc, then startTime asc with nulls last.
  const ranked: RankedEvent[] = evts.map((e) => {
    const s = scored.get(e.id)!;
    return { ...e, score: s.score, reason: s.reason, saved: false };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = a.startTime ? new Date(a.startTime).getTime() : Infinity;
    const tb = b.startTime ? new Date(b.startTime).getTime() : Infinity;
    return ta - tb;
  });

  return ranked;
}

// Re-export the canonical category list so route validation can share it.
export { CATEGORIES };
