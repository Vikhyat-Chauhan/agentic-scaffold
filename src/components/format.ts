// Presentation helpers for the feed UI — dates and prices.
// Kept in the components dir so Stream C owns it end-to-end.

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** "Thu, Jun 12 · 7:00 PM" — or "Date TBD" when the event is undated. */
export function formatEventDate(iso: string | null): string {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return `${DATE_FMT.format(d)} · ${TIME_FMT.format(d)}`;
}

/** Compact relative day label for the hero / badges, e.g. "Tonight", "Tomorrow". */
export function relativeDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return DATE_FMT.format(d).split(",")[0]; // weekday only
  return null;
}

const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });

/**
 * Price label from cents.
 *  - free        → "Free"
 *  - min===max   → "$25"
 *  - min<max     → "$25–$75"
 *  - min only    → "From $25"
 *  - nothing     → "Price varies"
 */
export function formatPrice(opts: {
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
}): string {
  const { isFree, priceMin, priceMax } = opts;
  if (isFree) return "Free";
  if (priceMin != null && priceMin === 0 && (priceMax == null || priceMax === 0)) return "Free";
  if (priceMin != null && priceMax != null) {
    return priceMin === priceMax ? dollars(priceMin) : `${dollars(priceMin)}–${dollars(priceMax)}`;
  }
  if (priceMin != null) return `From ${dollars(priceMin)}`;
  if (priceMax != null) return `Up to ${dollars(priceMax)}`;
  return "Price varies";
}
