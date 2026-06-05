// /map — Neighborhood discovery view. Server component, read-only.
// Loads upcoming events the same way the feed does and groups them by
// neighborhood. No map library, no geocoding — just editorial sections.
import { and, gte, isNull, or, sql } from "drizzle-orm";
import { MapPin } from "lucide-react";
import { db, events } from "@/db";
import { Header } from "@/components/Header";
import { formatEventDate } from "@/components/format";

export const dynamic = "force-dynamic";

const AROUND_SF = "Around SF";

export default async function MapPage() {
  // "Upcoming" — started within the last 12h or undated. Mirrors /api/feed.
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(events)
    .where(or(gte(events.startTime, cutoff), isNull(events.startTime)))
    .orderBy(sql`${events.startTime} asc nulls last`)
    .limit(250);

  // Group by neighborhood; undated/none fall under "Around SF" (kept last).
  const groups = new Map<string, typeof rows>();
  for (const e of rows) {
    const key = e.neighborhood?.trim() || AROUND_SF;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  const sections = [...groups.entries()].sort(([a], [b]) => {
    if (a === AROUND_SF) return 1;
    if (b === AROUND_SF) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="mb-10 flex items-baseline gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            By neighborhood
          </h1>
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-text-tertiary">
            {rows.length} upcoming
          </span>
        </div>

        {sections.length === 0 ? (
          <p className="text-text-secondary">No upcoming events yet.</p>
        ) : (
          <div className="space-y-12">
            {sections.map(([name, list]) => (
              <section key={name}>
                <div className="mb-4 flex items-center gap-2 border-b border-border/70 pb-2">
                  <MapPin className="h-4 w-4 text-text-tertiary" aria-hidden />
                  <h2 className="font-display text-xl font-semibold text-text-primary">
                    {name}
                  </h2>
                  <span className="font-mono text-[11px] text-text-tertiary">
                    {list.length}
                  </span>
                </div>
                <ul className="divide-y divide-border/50">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-text-primary">{e.title}</p>
                        {e.venue && (
                          <p className="truncate text-sm text-text-secondary">{e.venue}</p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest2 text-text-tertiary">
                        {formatEventDate(e.startTime ? new Date(e.startTime).toISOString() : null)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
