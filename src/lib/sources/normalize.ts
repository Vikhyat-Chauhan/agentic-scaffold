// Normalization for funcheap posts: derive structured event fields
// (date, price, category, tags, etc.) from loose WP post shapes.
// Uses Claude when available, with a deterministic rule-based fallback.
import { anthropic, hasLLM, MODEL, textOf, parseJsonLoose } from "@/lib/anthropic";
import { CATEGORIES, type Category, type RawEvent } from "@/lib/types";

const TODAY = "2026-06-05";

/** Loose shape of a funcheap WP post as handed to the normalizer. */
export interface FuncheapPostInput {
  title?: string | null;
  description?: string | null;
  termNames?: string[] | null;
  [key: string]: unknown;
}

/** Subset of RawEvent fields the normalizer is responsible for. */
type NormalizedFields = Pick<
  Partial<RawEvent>,
  | "startTime"
  | "isFree"
  | "priceMin"
  | "priceMax"
  | "category"
  | "neighborhood"
  | "tags"
>;

const CATEGORY_SET = new Set<string>(CATEGORIES);

function coerceCategory(value: unknown): Category {
  if (typeof value === "string" && CATEGORY_SET.has(value)) {
    return value as Category;
  }
  return "other";
}

// Keyword -> category map for the rule-based fallback. First match wins.
const KEYWORD_CATEGORY: Array<[RegExp, Category]> = [
  [/\b(dj|club|nightlife|party|bar crawl)\b/i, "nightlife"],
  [/\b(music|concert|live band|gig|orchestra|jazz|symphony)\b/i, "music"],
  [/\b(food|dining|tasting|restaurant|brunch|wine|beer|cocktail|culinary)\b/i, "food"],
  [/\b(art|gallery|film|movie|screening|exhibit|theater|theatre|museum|dance)\b/i, "arts"],
  [/\b(tech|startup|ai|developer|coding|hackathon|crypto)\b/i, "tech"],
  [/\b(outdoor|hike|hiking|trail|park|nature|cycling|run|kayak)\b/i, "outdoors"],
  [/\b(wellness|yoga|meditation|fitness|health|mindfulness)\b/i, "wellness"],
  [/\b(family|kids|children|toddler)\b/i, "family"],
  [/\b(class|workshop|learning|lecture|seminar|course)\b/i, "learning"],
  [/\b(business|networking|career|entrepreneur)\b/i, "business"],
  [/\b(community|volunteer|fundraiser|neighborhood|civic)\b/i, "community"],
];

function ruleBasedCategory(termNames: string[]): Category {
  const haystack = termNames.join(" ");
  for (const [re, cat] of KEYWORD_CATEGORY) {
    if (re.test(haystack)) return cat;
  }
  return "other";
}

function ruleBasedNormalize(post: FuncheapPostInput): NormalizedFields {
  const termNames = (post.termNames ?? []).filter(
    (t): t is string => typeof t === "string"
  );
  const text = `${post.title ?? ""} ${post.description ?? ""}`.toLowerCase();
  return {
    category: ruleBasedCategory(termNames),
    isFree: text.includes("free"),
    startTime: null,
    priceMin: null,
    priceMax: null,
    neighborhood: null,
    tags: termNames,
  };
}

interface LLMResult {
  i?: number;
  startTime?: string | null;
  isFree?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
  category?: string;
  neighborhood?: string | null;
  tags?: string[];
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  return null;
}

function buildPrompt(batch: FuncheapPostInput[]): string {
  const items = batch.map((post, idx) => ({
    i: idx,
    title: post.title ?? "",
    description: (post.description ?? "").slice(0, 600),
    terms: (post.termNames ?? []).filter((t) => typeof t === "string"),
  }));

  return [
    `Today is ${TODAY}. You are normalizing San Francisco event listings.`,
    `For each event below, infer the EVENT date (NOT the publish date). For recurring`,
    `events, pick the NEXT occurrence on or after today. Express all prices in CENTS.`,
    ``,
    `Return ONLY a JSON array, one object per input item, of the form:`,
    `[{"i":0,"startTime":<ISO 8601 string or null>,"isFree":<bool>,`,
    `"priceMin":<cents or null>,"priceMax":<cents or null>,`,
    `"category":<one of: ${CATEGORIES.join(", ")}>,`,
    `"neighborhood":<string or null>,"tags":<string[]>}]`,
    ``,
    `Rules: "i" must match the input index. If a date cannot be determined, use null.`,
    `Choose the single best category from the taxonomy. Do not add prose or code fences.`,
    ``,
    `Events:`,
    JSON.stringify(items),
  ].join("\n");
}

async function llmNormalizeBatch(
  batch: FuncheapPostInput[]
): Promise<NormalizedFields[]> {
  if (!anthropic) throw new Error("no anthropic client");

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: buildPrompt(batch) }],
  });

  const parsed = parseJsonLoose<LLMResult[]>(textOf(msg));
  if (!Array.isArray(parsed)) throw new Error("expected JSON array");

  // Seed with rule-based defaults so any missing index is still well-formed.
  const out: NormalizedFields[] = batch.map((post) => ruleBasedNormalize(post));

  for (const r of parsed) {
    if (!r || typeof r !== "object") continue;
    const i = typeof r.i === "number" ? r.i : -1;
    if (i < 0 || i >= batch.length) continue;
    const termNames = (batch[i].termNames ?? []).filter(
      (t): t is string => typeof t === "string"
    );
    out[i] = {
      startTime: typeof r.startTime === "string" ? r.startTime : null,
      isFree: typeof r.isFree === "boolean" ? r.isFree : false,
      priceMin: toNumberOrNull(r.priceMin),
      priceMax: toNumberOrNull(r.priceMax),
      category: coerceCategory(r.category),
      neighborhood:
        typeof r.neighborhood === "string" && r.neighborhood.trim()
          ? r.neighborhood
          : null,
      tags:
        Array.isArray(r.tags) && r.tags.every((t) => typeof t === "string")
          ? r.tags
          : termNames,
    };
  }

  return out;
}

const BATCH_SIZE = 12;

/**
 * Normalize a list of funcheap posts into partial RawEvents.
 * The returned array is index-aligned with `posts` (one entry per input).
 */
export async function normalizeFuncheap(
  posts: FuncheapPostInput[]
): Promise<Partial<RawEvent>[]> {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  if (!hasLLM) {
    return posts.map((post) => ruleBasedNormalize(post));
  }

  const results: NormalizedFields[] = new Array(posts.length);

  for (let start = 0; start < posts.length; start += BATCH_SIZE) {
    const batch = posts.slice(start, start + BATCH_SIZE);
    let normalized: NormalizedFields[];
    try {
      normalized = await llmNormalizeBatch(batch);
    } catch {
      // Fall back to rule-based for just this batch — never throw.
      normalized = batch.map((post) => ruleBasedNormalize(post));
    }
    for (let j = 0; j < batch.length; j++) {
      results[start + j] = normalized[j] ?? ruleBasedNormalize(batch[j]);
    }
  }

  return results;
}
