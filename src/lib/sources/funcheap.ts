// Funcheap source adapter: pulls recent posts from the SF Funcheap WP REST API
// and normalizes them into RawEvents. Never throws — returns [] on any failure.
import type { RawEvent } from "@/lib/types";
import { normalizeFuncheap, type FuncheapPostInput } from "./normalize";

const PAGES = [1, 2];
const PER_PAGE = 100;
const MAX_EVENTS = 120;

/** Decode the limited set of HTML entities WP commonly emits in titles. */
function decodeEntities(input: string): string {
  if (!input) return "";
  return input
    .replace(/&amp;/g, "&")
    .replace(/&#0?38;/g, "&")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&apos;/g, "'");
}

/** Strip HTML tags and collapse whitespace. */
function stripHtml(input: string): string {
  if (!input) return "";
  return decodeEntities(
    input
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

interface WpTerm {
  name?: string;
}

interface WpPost {
  id?: number | string;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
    "wp:term"?: WpTerm[][];
  };
}

function gatherTermNames(post: WpPost): string[] {
  const groups = post._embedded?.["wp:term"];
  if (!Array.isArray(groups)) return [];
  const names: string[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const term of group) {
      if (term && typeof term.name === "string") names.push(term.name);
    }
  }
  return names;
}

async function fetchPage(page: number): Promise<WpPost[]> {
  const url =
    `https://sf.funcheap.com/wp-json/wp/v2/posts` +
    `?per_page=${PER_PAGE}&_embed&page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as WpPost[]) : [];
}

export async function fetchFromFuncheap(): Promise<RawEvent[]> {
  try {
    const pages = await Promise.all(PAGES.map((p) => fetchPage(p)));
    const posts = pages.flat().slice(0, MAX_EVENTS);
    if (posts.length === 0) return [];

    // Build the funcheap-side fields plus term names for normalization.
    const inputs: FuncheapPostInput[] = posts.map((post) => {
      const title = decodeEntities(post.title?.rendered ?? "");
      const description = stripHtml(post.content?.rendered ?? "").slice(0, 600);
      return {
        title,
        description,
        termNames: gatherTermNames(post),
      };
    });

    const normalized = await normalizeFuncheap(inputs);

    const events: RawEvent[] = posts.map((post, i) => {
      const input = inputs[i];
      const norm = normalized[i] ?? {};
      const imageUrl =
        post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null;

      return {
        source: "funcheap",
        sourceId: String(post.id ?? ""),
        title: input.title ?? "",
        description: input.description ?? null,
        url: post.link ?? "",
        imageUrl,
        neighborhood: norm.neighborhood ?? null,
        startTime: norm.startTime ?? null,
        isFree: norm.isFree ?? false,
        priceMin: norm.priceMin ?? null,
        priceMax: norm.priceMax ?? null,
        category: norm.category ?? "other",
        tags: norm.tags ?? input.termNames ?? [],
        raw: post,
      };
    });

    return events;
  } catch {
    return [];
  }
}
