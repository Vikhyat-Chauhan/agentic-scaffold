import { parse } from "date-fns";
import type { Category, RawEvent } from "@/lib/types";

const URL = "https://19hz.info/eventlisting_BayArea.php";
const MAX_EVENTS = 120;

const NIGHTLIFE_KEYWORDS = [
  "house",
  "techno",
  "club",
  "edm",
  "rave",
  "bass",
];

/** Decode the common HTML entities found in 19hz listings. */
function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_m, code: string) =>
      String.fromCharCode(parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    );
}

/** Strip all HTML tags, decode entities, and collapse whitespace. */
function stripHtml(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministic djb2 hash, returned as a base-36 string. */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Parse a "$25" / "$160-200" / "Free" price string into cents. */
function parsePrice(raw: string): {
  isFree?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
} {
  const text = raw.trim();
  if (!text) return {};

  if (/free/i.test(text)) {
    return { isFree: true, priceMin: 0 };
  }

  // Collect dollar amounts, ignoring age tokens like "21+"/"18+".
  const amounts: number[] = [];
  const matchRe = /\$\s*(\d+(?:\.\d{1,2})?)(?:\s*-\s*\$?\s*(\d+(?:\.\d{1,2})?))?/g;
  let m: RegExpExecArray | null;
  while ((m = matchRe.exec(text)) !== null) {
    amounts.push(Math.round(parseFloat(m[1]) * 100));
    if (m[2] !== undefined) {
      amounts.push(Math.round(parseFloat(m[2]) * 100));
    }
  }

  if (amounts.length === 0) return {};

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return { priceMin: min, priceMax: max, isFree: min === 0 ? true : undefined };
}

/** Classify category from the genre/tag list. */
function classify(tags: string[]): Category {
  const haystack = tags.join(" ").toLowerCase();
  for (const kw of NIGHTLIFE_KEYWORDS) {
    if (haystack.includes(kw)) return "nightlife";
  }
  return "music";
}

/**
 * Parse the leading date token from a date cell into an ISO string.
 * Assumes year 2026; if the parsed month is before June (today is 2026-06-05)
 * roll to 2027 so events stay in the future.
 */
function parseStart(dateText: string): string | null {
  const text = dateText.trim();
  if (!text) return null;

  // Date cells typically look like "Fri: Jun 6" or "Saturday: June 7 (8pm)".
  // Drop a leading weekday label and any parenthetical, keep the month/day.
  let cleaned = text
    .replace(/^[A-Za-z]+:\s*/, "") // leading "Fri: "
    .replace(/\(.*$/, "") // trailing "(8pm-...)"
    .trim();

  // Pull out the first "Month Day" pattern we can find.
  const md = cleaned.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})/);
  if (!md) return null;
  cleaned = `${md[1]} ${md[2]}`;

  const formats = ["MMMM d", "MMM d"];
  for (const fmt of formats) {
    const parsed = parse(cleaned, fmt, new Date(2026, 0, 1));
    if (!isNaN(parsed.getTime())) {
      // Month before June → push to 2027.
      const year = parsed.getMonth() < 5 ? 2027 : 2026;
      const final = new Date(
        year,
        parsed.getMonth(),
        parsed.getDate(),
        0,
        0,
        0,
        0,
      );
      if (!isNaN(final.getTime())) return final.toISOString();
    }
  }
  return null;
}

/**
 * Split a row's HTML into <td> cell strings.
 *
 * 19hz emits malformed markup: cells are opened with <td ...> but frequently
 * NOT closed with </td> before the next cell opens (e.g.
 * `<td>Title @ Venue<td>genres<td>price`). A naive `<td>...</td>` regex
 * therefore lumps several logical columns into one capture and shifts every
 * downstream column. Instead, split on each <td> opening tag and treat the
 * text up to the next <td>/</td>/<tr> boundary as that cell's contents.
 */
function splitCells(rowHtml: string): string[] {
  const cells: string[] = [];
  // Match each opening <td ...> and capture everything until the next cell
  // boundary: another <td>, a </td>, or the end of the row (</tr> / string end).
  const cellRe = /<td\b[^>]*>([\s\S]*?)(?=<td\b|<\/td>|<\/tr>|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(rowHtml)) !== null) {
    cells.push(m[1]);
  }
  return cells;
}

function buildEvent(cells: string[]): RawEvent | null {
  if (cells.length < 2) return null;

  const dateCell = cells[0];
  const eventCell = cells[1];

  // Title + url come from the first anchor in the event cell.
  const anchor = eventCell.match(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
  );
  if (!anchor) return null;
  const title = stripHtml(anchor[2]);
  if (!title) return null;
  const url = decodeEntities(anchor[1].trim());

  // Venue = text after the first "@" in the event cell.
  let venue: string | null = null;
  const eventText = stripHtml(eventCell);
  const atIdx = eventText.indexOf("@");
  if (atIdx !== -1) {
    const after = eventText.slice(atIdx + 1).trim();
    if (after) venue = after;
  }

  // Column order (per <th> headers, after handling 19hz's unclosed <td> tags):
  //   0 Date/Time | 1 Event Title @ Venue | 2 Tags | 3 Price | Age
  //   4 Organizers | 5 Links | 6 date div
  // Genres/tags live in column 2.
  const tags = cells[2]
    ? stripHtml(cells[2])
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
    : [];

  // Price | Age lives in column 3 (parsePrice ignores age tokens like "21+").
  const price = cells[3] ? parsePrice(stripHtml(cells[3])) : {};

  const dateText = stripHtml(dateCell);
  const startTime = parseStart(dateText);

  const sourceId = djb2(title + dateText);

  const event: RawEvent = {
    source: "19hz",
    sourceId,
    title,
    url,
    venue,
    startTime,
    tags,
    category: classify(tags),
    ...price,
  };

  return event;
}

export async function fetchFrom19hz(): Promise<RawEvent[]> {
  try {
    const res = await fetch(URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];

    const html = await res.text();

    // Grab table rows. Match every <tr>...</tr> and process those that
    // contain at least one <td> (skips header <th> rows).
    const events: RawEvent[] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html)) !== null && events.length < MAX_EVENTS) {
      const rowHtml = m[1];
      if (!/<td\b/i.test(rowHtml)) continue;
      const cells = splitCells(rowHtml);
      const event = buildEvent(cells);
      if (event) events.push(event);
    }

    return events;
  } catch {
    return [];
  }
}
