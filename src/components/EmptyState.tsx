import Link from "next/link";
import { Compass, RefreshCw, AlertTriangle } from "lucide-react";

/** Shown when the feed has zero events — must look intentional, not broken. */
export function EmptyState({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface">
        <Compass className="h-7 w-7 text-text-secondary" aria-hidden />
      </div>
      <h2 className="font-display text-2xl text-text-primary">
        {filtered ? "Nothing matches those filters" : "The city's still loading"}
      </h2>
      <p className="mt-3 max-w-sm text-balance text-sm leading-relaxed text-text-secondary">
        {filtered
          ? "Try widening your filters — clear the category or include paid events to see more of what's happening."
          : "No events have been gathered yet. Once the feed refreshes, your curated picks will appear here, ranked to your taste."}
      </p>
      <div className="mt-7 flex items-center gap-3">
        {filtered && onReset ? (
          <button
            onClick={onReset}
            className="flex items-center gap-2 rounded-full bg-text-primary px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </button>
        ) : null}
        <Link
          href="/onboarding"
          className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-2 hover:text-text-primary"
        >
          Set your taste
        </Link>
      </div>
    </div>
  );
}

/** Shown when the feed request fails outright. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#5a2a2a] bg-[#1a1012]/50 px-6 py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#5a2a2a] bg-[#1a1012]">
        <AlertTriangle className="h-7 w-7 text-[#ff8b8b]" aria-hidden />
      </div>
      <h2 className="font-display text-2xl text-text-primary">Couldn&apos;t load the feed</h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
        Something went sideways fetching your events. Give it another go.
      </p>
      <button
        onClick={onRetry}
        className="mt-7 flex items-center gap-2 rounded-full bg-text-primary px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Retry
      </button>
    </div>
  );
}
