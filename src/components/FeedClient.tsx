"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category, Profile, RankedEvent } from "@/lib/types";
import { Header } from "./Header";
import { CategoryFilter, type WhenFilter } from "./CategoryFilter";
import { EventCard } from "./EventCard";
import { FeedSkeleton } from "./Skeleton";
import { EmptyState, ErrorState } from "./EmptyState";

interface FeedStats {
  total: number;
  shown: number;
  lastIngest: string | null;
}

interface FeedResponse {
  events: RankedEvent[];
  profile: Profile;
  stats: FeedStats;
}

type Status = "loading" | "ready" | "error";

export function FeedClient() {
  const [category, setCategory] = useState<Category | null>(null);
  const [when, setWhen] = useState<WhenFilter>("all");
  const [free, setFree] = useState(false);

  const [events, setEvents] = useState<RankedEvent[]>([]);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setStatus("loading");
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (free) params.set("free", "true");
    if (when !== "all") params.set("when", when);

    try {
      const res = await fetch(`/api/feed?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Feed responded ${res.status}`);
      const data: FeedResponse = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
      setStats(data.stats ?? null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [category, free, when]);

  useEffect(() => {
    load();
  }, [load]);

  const interact = useCallback(
    (eventId: string, action: "save" | "dismiss" | "going") => {
      // Fire-and-forget; UI already updated optimistically.
      fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action }),
      }).catch(() => {});
    },
    []
  );

  const handleSave = useCallback(
    (id: string, next: boolean) => {
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, saved: next } : e))
      );
      interact(id, "save");
    },
    [interact]
  );

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set(prev).add(id));
      interact(id, "dismiss");
    },
    [interact]
  );

  const resetFilters = useCallback(() => {
    setCategory(null);
    setWhen("all");
    setFree(false);
  }, []);

  const visible = events.filter((e) => !dismissed.has(e.id));
  const filtersActive = category !== null || when !== "all" || free;

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero strip */}
      <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-16">
        <p className="font-mono text-xs uppercase tracking-widest2 text-text-tertiary">
          Curated for you · San Francisco
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-text-primary text-balance sm:text-6xl">
          {heroLine(status, visible.length, stats)}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary">
          Real events from across the city, ranked by how well they fit your taste — refreshed
          automatically. {lastIngestLabel(stats)}
        </p>
      </section>

      {/* Filters */}
      <section className="mx-auto mt-10 max-w-6xl px-5 sm:px-8">
        <CategoryFilter
          category={category}
          when={when}
          free={free}
          onCategory={setCategory}
          onWhen={setWhen}
          onFree={setFree}
        />
      </section>

      {/* Feed */}
      <section className="mx-auto mt-8 max-w-6xl px-5 pb-24 sm:px-8">
        {status === "loading" ? (
          <FeedSkeleton />
        ) : status === "error" ? (
          <ErrorState onRetry={load} />
        ) : visible.length === 0 ? (
          <EmptyState filtered={filtersActive} onReset={resetFilters} />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((event, i) => (
              <EventCard
                key={event.id}
                event={event}
                index={i}
                onSave={handleSave}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function heroLine(status: Status, count: number, stats: FeedStats | null): string {
  if (status === "loading") return "Reading the city…";
  if (status === "error") return "The feed hit a snag";
  if (count === 0) return "Nothing on the radar yet";
  const n = stats?.shown ?? count;
  return `${n} ${n === 1 ? "event" : "events"}, curated for you`;
}

function lastIngestLabel(stats: FeedStats | null): string {
  if (!stats?.lastIngest) return "";
  const d = new Date(stats.lastIngest);
  if (Number.isNaN(d.getTime())) return "";
  return `Last refreshed ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}.`;
}
