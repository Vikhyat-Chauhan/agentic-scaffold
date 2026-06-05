"use client";

import { CATEGORIES } from "@/lib/types";
import type { Category } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type WhenFilter = "all" | "today" | "weekend";

const WHENS: { key: WhenFilter; label: string }[] = [
  { key: "all", label: "Anytime" },
  { key: "today", label: "Today" },
  { key: "weekend", label: "This weekend" },
];

/** Horizontal, scrollable taste controls: time, free toggle, then category pills. */
export function CategoryFilter({
  category,
  when,
  free,
  onCategory,
  onWhen,
  onFree,
}: {
  category: Category | null;
  when: WhenFilter;
  free: boolean;
  onCategory: (c: Category | null) => void;
  onWhen: (w: WhenFilter) => void;
  onFree: (f: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Time + price row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {WHENS.map((w) => (
            <button
              key={w.key}
              onClick={() => onWhen(w.key)}
              aria-pressed={when === w.key}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                when === w.key
                  ? "bg-text-primary text-canvas"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onFree(!free)}
          aria-pressed={free}
          className={cn(
            "rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
            free
              ? "border-[#4ade80]/40 bg-[#4ade80]/10 text-[#86efac]"
              : "border-border bg-surface text-text-secondary hover:text-text-primary"
          )}
        >
          Free only
        </button>
      </div>

      {/* Category pills */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        <Pill active={category === null} onClick={() => onCategory(null)}>
          ✦ All
        </Pill>
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const active = category === c;
          return (
            <Pill
              key={c}
              active={active}
              accent={meta.accent}
              onClick={() => onCategory(active ? null : c)}
            >
              <span aria-hidden>{meta.emoji}</span> {meta.label}
            </Pill>
          );
        })}
      </div>
    </div>
  );
}

function Pill({
  children,
  active,
  accent,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  accent?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
        active
          ? "text-canvas"
          : "border-border bg-surface text-text-secondary hover:border-border-2 hover:text-text-primary"
      )}
      style={
        active && accent
          ? { backgroundColor: accent, borderColor: accent }
          : active
            ? { backgroundColor: "#f5f4f2", borderColor: "#f5f4f2", color: "#0a0a0b" }
            : undefined
      }
    >
      {children}
    </button>
  );
}
