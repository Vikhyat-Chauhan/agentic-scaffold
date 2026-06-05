// Loading placeholders that echo the EventCard shape so the layout doesn't jump.

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="shimmer aspect-[16/10] w-full" />
      <div className="space-y-3 p-5">
        <div className="shimmer h-3 w-24 rounded-full" />
        <div className="shimmer h-5 w-5/6 rounded-md" />
        <div className="shimmer h-5 w-2/3 rounded-md" />
        <div className="flex gap-2 pt-2">
          <div className="shimmer h-3 w-20 rounded-full" />
          <div className="shimmer h-3 w-16 rounded-full" />
        </div>
        <div className="shimmer mt-3 h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading events"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
