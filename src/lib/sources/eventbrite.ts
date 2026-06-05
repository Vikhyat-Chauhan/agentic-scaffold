import type { RawEvent } from "@/lib/types";

// Eventbrite source adapter.
//
// Eventbrite removed its public event *search* endpoint years ago, so there is
// no supported way to discover arbitrary public events by city. The remaining
// v3 API lets an authenticated token read the live events belonging to the
// organizations that token owns/manages. That is the one real, supported path,
// so when EVENTBRITE_TOKEN is set we fetch those organizations' live events and
// map them to RawEvents.
//
// Never throws — returns [] when the token is missing or any error occurs, so
// the app works key-less exactly as before.

const API = "https://www.eventbriteapi.com/v3";
const MAX_EVENTS = 120;

interface EbOrganization {
  id?: string;
}

interface EbOrganizationsResponse {
  organizations?: EbOrganization[];
}

interface EbVenue {
  name?: string;
  address?: { city?: string };
}

interface EbTicketPrice {
  major_value?: string; // dollars, e.g. "12.50"
}

interface EbEvent {
  id?: string;
  name?: { text?: string };
  description?: { text?: string };
  url?: string;
  start?: { utc?: string };
  end?: { utc?: string };
  is_free?: boolean;
  logo?: { url?: string };
  venue?: EbVenue;
  ticket_availability?: {
    minimum_ticket_price?: EbTicketPrice;
    maximum_ticket_price?: EbTicketPrice;
  };
}

interface EbEventsResponse {
  events?: EbEvent[];
}

/** Dollars string ("12.50") → integer cents, or null if unparseable. */
function toCents(price: EbTicketPrice | undefined): number | null {
  if (!price || typeof price.major_value !== "string") return null;
  const dollars = Number(price.major_value);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

export async function fetchFromEventbrite(): Promise<RawEvent[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) return [];

  const headers = { Authorization: `Bearer ${token}` };

  try {
    // 1) Which organizations does this token manage?
    const orgRes = await fetch(`${API}/users/me/organizations/`, { headers });
    if (!orgRes.ok) return [];
    const orgData = (await orgRes.json()) as EbOrganizationsResponse;
    const orgIds = (orgData.organizations ?? [])
      .map((o) => o.id)
      .filter((id): id is string => Boolean(id));
    if (orgIds.length === 0) return [];

    // 2) Pull each org's live (upcoming) events with venue + price expanded.
    const mapped: RawEvent[] = [];
    for (const orgId of orgIds) {
      const params = new URLSearchParams({
        status: "live",
        order_by: "start_asc",
        expand: "venue,ticket_availability",
      });
      const evRes = await fetch(
        `${API}/organizations/${orgId}/events/?${params.toString()}`,
        { headers }
      );
      if (!evRes.ok) continue;
      const evData = (await evRes.json()) as EbEventsResponse;

      for (const ev of evData.events ?? []) {
        const title = ev.name?.text;
        if (!ev.id || !title || !ev.url) continue;

        const priceMin = toCents(ev.ticket_availability?.minimum_ticket_price);
        const priceMax = toCents(ev.ticket_availability?.maximum_ticket_price);

        const raw: RawEvent = {
          source: "eventbrite",
          sourceId: String(ev.id),
          title,
          description: ev.description?.text ?? null,
          url: ev.url,
          imageUrl: ev.logo?.url ?? null,
          venue: ev.venue?.name ?? null,
          startTime: ev.start?.utc ?? null,
          endTime: ev.end?.utc ?? null,
          priceMin,
          priceMax,
          tags: [],
          raw: ev,
        };

        if (typeof ev.is_free === "boolean") raw.isFree = ev.is_free;

        mapped.push(raw);
        if (mapped.length >= MAX_EVENTS) return mapped;
      }
    }

    return mapped;
  } catch {
    return [];
  }
}
