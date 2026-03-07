import { useI18n } from "@/lib/i18n/provider";

interface HotelsQuickFiltersRowProps {
  activePanel: "location" | "dates" | "guests" | null;
  locationSummary: string;
  dateSummary: string;
  guestSummary: string;
  hiddenFilterCount: number;
  total: number;
  loading: boolean;
  onOpenLocation: () => void;
  onOpenDates: () => void;
  onOpenGuests: () => void;
  onOpenFilters: () => void;
}

export function HotelsQuickFiltersRow({
  activePanel,
  locationSummary,
  dateSummary,
  guestSummary,
  hiddenFilterCount,
  total,
  loading,
  onOpenLocation,
  onOpenDates,
  onOpenGuests,
  onOpenFilters,
}: HotelsQuickFiltersRowProps) {
  const { t } = useI18n();
  return (
    <div className="relative z-20 mt-3">
      <div className="rounded-[1.7rem] border border-slate-200 bg-slate-50/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-[1fr_1fr_1fr_auto]">
          <button
            type="button"
            onClick={onOpenLocation}
            className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
              activePanel === "location" ? "bg-white shadow-sm" : "hover:bg-white/80"
            }`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t("hotels_quick_location")}</span>
            <span className="mt-1 block text-sm font-medium text-slate-900">{locationSummary}</span>
          </button>

          <button
            type="button"
            onClick={onOpenDates}
            className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
              activePanel === "dates" ? "bg-white shadow-sm" : "hover:bg-white/80"
            }`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t("hotels_quick_when")}</span>
            <span className="mt-1 block text-sm font-medium text-slate-900">{dateSummary}</span>
          </button>

          <button
            type="button"
            onClick={onOpenGuests}
            className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
              activePanel === "guests" ? "bg-white shadow-sm" : "hover:bg-white/80"
            }`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t("hotels_quick_guests")}</span>
            <span className="mt-1 block text-sm font-medium text-slate-900">{guestSummary}</span>
          </button>

          <button
            type="button"
            onClick={onOpenFilters}
            className={`relative inline-flex min-h-[4.75rem] items-center justify-center rounded-[1.35rem] border bg-white text-slate-700 transition hover:text-slate-900 ${
              hiddenFilterCount > 0
                ? "border-slate-300 px-3 shadow-sm hover:border-slate-400 md:min-w-[6.25rem] md:gap-2"
                : "border-slate-200 hover:border-slate-300 md:w-14"
            }`}
            aria-label={t("hotels_drawer_filters")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0">
              <path d="M4 7h16" />
              <path d="M7 12h10" />
              <path d="M10 17h4" />
            </svg>
            {hiddenFilterCount > 0 ? (
              <span className="hidden md:flex md:flex-col md:items-start md:leading-none">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("hotels_quick_stays")}</span>
                <span className="mt-1 text-sm font-semibold text-slate-900">{loading ? "..." : total.toLocaleString()}</span>
              </span>
            ) : null}
            {hiddenFilterCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white">
                {hiddenFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </div>
  );
}
