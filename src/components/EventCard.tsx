"use client";

import Image from "next/image";
import { useState } from "react";
import { Heart, X, MapPin, ArrowUpRight } from "lucide-react";
import type { RankedEvent } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { MatchBadge } from "./MatchBadge";
import { formatEventDate, formatPrice, relativeDay } from "./format";

/** A category-keyed gradient used when an event has no image. */
function gradientFor(accent: string): string {
  return `linear-gradient(135deg, ${accent}33 0%, #0a0a0b 70%), radial-gradient(circle at 30% 20%, ${accent}40, transparent 55%)`;
}

export function EventCard({
  event,
  index = 0,
  onSave,
  onDismiss,
}: {
  event: RankedEvent;
  index?: number;
  onSave: (id: string, next: boolean) => void;
  onDismiss: (id: string) => void;
}) {
  const meta = CATEGORY_META[event.category];
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = event.imageUrl && !imgFailed;
  const price = formatPrice(event);
  const isFreeLabel = price === "Free";
  const rel = relativeDay(event.startTime);

  return (
    <article
      className="group animate-fade-up relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-border-2 hover:shadow-2xl hover:shadow-black/40"
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
    >
      {/* Media */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-2">
        {showImage ? (
          <Image
            src={event.imageUrl as string}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: gradientFor(meta.accent) }}>
            <span
              className="absolute bottom-4 right-4 text-5xl opacity-30 transition-transform duration-500 group-hover:scale-110"
              aria-hidden
            >
              {meta.emoji}
            </span>
          </div>
        )}

        {/* Top gradient scrim for legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />

        {/* Category pill */}
        <div className="absolute left-3 top-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider backdrop-blur-md"
            style={{
              color: meta.accent,
              borderColor: `${meta.accent}55`,
              backgroundColor: "rgba(10,10,11,0.55)",
            }}
          >
            <span aria-hidden>{meta.emoji}</span>
            {meta.label}
          </span>
        </div>

        {/* Match badge */}
        <div className="absolute right-3 top-3">
          <MatchBadge score={event.score} />
        </div>

        {/* Save / dismiss controls */}
        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
          <IconButton
            label={event.saved ? "Remove from saved" : "Save event"}
            pressed={event.saved}
            onClick={() => onSave(event.id, !event.saved)}
            tone="save"
          >
            <Heart className={cn("h-4 w-4", event.saved && "fill-current")} aria-hidden />
          </IconButton>
          <IconButton
            label="Dismiss event"
            onClick={() => onDismiss(event.id)}
            tone="dismiss"
          >
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>

        {rel ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-canvas/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary backdrop-blur-md">
            {rel}
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
          {formatEventDate(event.startTime)}
        </p>

        <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-text-primary text-balance">
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white after:absolute after:inset-0 after:content-['']"
          >
            {event.title}
          </a>
        </h3>

        {/* Venue + neighborhood */}
        {(event.venue || event.neighborhood) && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
            <span className="truncate">
              {event.venue}
              {event.venue && event.neighborhood ? " · " : ""}
              {event.neighborhood}
            </span>
          </p>
        )}

        {/* Reason — editorial pull-quote */}
        {event.reason ? (
          <p className="mt-4 border-l-2 border-border-2 pl-3 font-display text-[15px] italic leading-snug text-text-primary/90 text-balance">
            “{event.reason}”
          </p>
        ) : null}

        {/* Tags */}
        {event.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {event.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] lowercase tracking-wide text-text-secondary"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer: price + source link */}
        <div className="mt-auto flex items-center justify-between pt-5">
          <span
            className={cn(
              "text-sm font-semibold",
              isFreeLabel ? "text-[#86efac]" : "text-text-primary"
            )}
          >
            {price}
          </span>
          <span className="relative z-10 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-text-tertiary transition-colors group-hover:text-text-secondary">
            {event.source}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}

function IconButton({
  children,
  label,
  onClick,
  pressed,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  tone: "save" | "dismiss";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        // z-10 keeps these above the title's stretched ::after click target.
        "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 hover:scale-110",
        tone === "save" && pressed
          ? "border-[#ff6b9d]/50 bg-[#ff6b9d]/20 text-[#ff6b9d]"
          : "border-border-2 bg-canvas/70 text-text-primary hover:bg-canvas"
      )}
    >
      {children}
    </button>
  );
}
