"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import type { RankedEvent } from "@/lib/types";
import { Header } from "./Header";
import { EventCard } from "./EventCard";
import { FeedSkeleton } from "./Skeleton";
import { ErrorState } from "./EmptyState";

type Status = "loading" | "ready" | "error";

export function SavedClient() {
  const [events, setEvents] = useState<RankedEvent[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      if (!res.ok) throw new Error(`Feed responded ${res.status}`);
      const data: { events: RankedEvent[] } = await res.json();
      const saved = Array.isArray(data.events)
        ? data.events.filter((e) => e.saved)
        : [];
      setEvents(saved);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const interact = useCallback((eventId: string, action: "save" | "dismiss") => {
    fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, action }),
    }).catch(() => {});
  }, []);

  // On this view, un-saving or dismissing removes the card immediately.
  const handleSave = useCallback(
    (id: string, next: boolean) => {
      if (!next) {
        setRemoved((prev) => new Set(prev).add(id));
        interact(id, "save");
      }
    },
    [interact]
  );

  const handleDismiss = useCallback(
    (id: string) => {
      setRemoved((prev) => new Set(prev).add(id));
      interact(id, "dismiss");
    },
    [interact]
  );

  const visible = events.filter((e) => !removed.has(e.id));

  return (
    <div className="min-h-screen">
      <Header />

      <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-16">
        <p className="font-mono text-xs uppercase tracking-widest2 text-text-tertiary">
          Your shortlist · San Francisco
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-text-primary text-balance sm:text-6xl">
          {status === "ready" && visible.length > 0
            ? `${visible.length} ${visible.length === 1 ? "event" : "events"} you saved`
            : "Saved events"}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary">
          Everything you&apos;ve thumbed up, in one place. Un-save to clear it from the list.
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-5 pb-24 sm:px-8">
        {status === "loading" ? (
          <FeedSkeleton />
        ) : status === "error" ? (
          <ErrorState onRetry={load} />
        ) : visible.length === 0 ? (
          <SavedEmpty />
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

function SavedEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface">
        <Compass className="h-7 w-7 text-text-secondary" aria-hidden />
      </div>
      <h2 className="font-display text-2xl text-text-primary">No saved events yet</h2>
      <p className="mt-3 max-w-sm text-balance text-sm leading-relaxed text-text-secondary">
        Tap the heart on any event in your feed and it&apos;ll show up here, ready when you are.
      </p>
      <Link
        href="/"
        className="mt-7 rounded-full bg-text-primary px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
      >
        Browse the feed
      </Link>
    </div>
  );
}
