// Pure client-safe iCalendar (.ics) builder for a single event.
// No deps, no DB, no network — turns an EventDTO/RankedEvent into a VCALENDAR string.

import type { EventDTO } from "@/lib/types";

/** Escape per RFC 5545: backslash, comma, semicolon, and newlines. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Format a Date as UTC iCalendar timestamp: YYYYMMDDTHHMMSSZ. */
function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Build a single-VEVENT .ics string for one event.
 * Requires a startTime — callers must guard undated events (an .ics with no DTSTART is invalid).
 * If endTime is missing, DTEND defaults to start + 2h.
 */
export function buildICS(event: EventDTO): string {
  if (!event.startTime) {
    throw new Error("Cannot build .ics for an event without a start time");
  }

  const start = new Date(event.startTime);
  const end = event.endTime
    ? new Date(event.endTime)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const location = [event.venue, event.neighborhood].filter(Boolean).join(", ");
  const description = [event.description, event.url].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Afoot//SF Event Feed//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.id)}@afoot`,
    `DTSTAMP:${toICSDate(start)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/** Slugify a title into a safe filename stem. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}
