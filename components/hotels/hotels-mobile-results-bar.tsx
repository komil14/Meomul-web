interface HotelsMobileResultsBarProps {
  total: number;
  loading: boolean;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export function HotelsMobileResultsBar({ total, loading, activeFilterCount, onOpenFilters }: HotelsMobileResultsBarProps) {
  return (
    <div className="sticky top-[4.3rem] z-20 -mx-1 px-1 md:hidden">
      <div className="rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Stays</p>
            <p className="text-sm font-semibold text-slate-900">
              {loading ? "Refreshing..." : `${total.toLocaleString()} stays`}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFilters}
            className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
          >
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
