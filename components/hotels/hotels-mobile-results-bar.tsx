interface HotelsMobileResultsBarProps {
  total: number;
  loading: boolean;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export function HotelsMobileResultsBar({ total, loading, activeFilterCount, onOpenFilters }: HotelsMobileResultsBarProps) {
  return (
    <div className="sticky top-[4.3rem] z-20 -mx-1 px-1 md:hidden">
      <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Results</p>
            <p className="text-sm font-semibold text-slate-800">
              {loading ? "Refreshing..." : `${total.toLocaleString()} stays`}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFilters}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
          >
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
