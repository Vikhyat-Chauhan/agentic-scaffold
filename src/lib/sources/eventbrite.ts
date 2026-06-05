import type { RawEvent } from "@/lib/types";

// Eventbrite source adapter — DOCUMENTED NO-OP.
//
// Eventbrite removed its public event *search* API (the `/v3/events/search/`
// endpoint) back in 2019/2020. The remaining v3 API endpoints only allow you
// to read events that belong to an organization you own/manage (via a private
// OAuth token) — there is no supported public endpoint to discover or search
// for arbitrary public events by city. As a result, there is no reliable way
// to ingest general San Francisco events from Eventbrite without scraping,
// which is out of scope and brittle.
//
// This adapter is therefore intentionally a no-op: it always resolves to an
// empty array. We keep it as a real module so the ingestion layer can list it
// alongside the other sources and so it can be wired up later if/when a usable
// token + endpoint becomes available. If `EVENTBRITE_TOKEN` is set we still
// short-circuit to [] because there is no public search endpoint to call.

export async function fetchFromEventbrite(): Promise<RawEvent[]> {
  // No token configured → nothing to do.
  if (!process.env.EVENTBRITE_TOKEN) return [];

  try {
    // Intentionally left blank: Eventbrite has no public event search API.
    // Even with a token, there is no supported endpoint to discover public
    // events by city, so we return nothing rather than throw.
    return [];
  } catch {
    return [];
  }
}
