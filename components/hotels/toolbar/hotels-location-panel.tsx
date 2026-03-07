import { HOTEL_LOCATIONS } from "@/lib/hotels/hotels-filter-config";
import { getHotelLocationLabelLocalized } from "@/lib/hotels/hotels-i18n";
import { useI18n } from "@/lib/i18n/provider";
import type { HotelLocation } from "@/types/hotel";

interface HotelsLocationPanelProps {
  selectedLocation: HotelLocation | "";
  onSelectLocation: (location: HotelLocation) => void;
  onClear: () => void;
}

export function HotelsLocationPanel({ selectedLocation, onSelectLocation, onClear }: HotelsLocationPanelProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("hotels_location_title")}</p>
          <p className="mt-1 text-sm text-slate-600">{t("hotels_location_desc")}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          {t("hotels_location_anywhere")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {HOTEL_LOCATIONS.map((location) => {
          const isActive = selectedLocation === location;

          return (
            <button
              key={location}
              type="button"
              onClick={() => {
                onSelectLocation(location);
              }}
              className={`rounded-xl border px-3 py-3 text-left transition sm:rounded-2xl sm:px-4 ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50/70 text-slate-800 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70 sm:block">{t("hotels_location_stay_in")}</span>
              <span className="block text-sm font-semibold sm:mt-1">{getHotelLocationLabelLocalized(location, t)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
