interface HotelsResultsSkeletonProps {
  count?: number;
}

export function HotelsResultsSkeleton({ count = 6 }: HotelsResultsSkeletonProps) {
  return (
    <div className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`hotel-skeleton-${index}`}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)]"
          aria-hidden="true"
        >
          <div className="h-64 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 sm:h-72" />
          <div className="space-y-3 px-4 py-3">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
