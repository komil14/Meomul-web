import { HOTEL_LOCATIONS } from "@/lib/hotels/hotels-filter-config";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import type { HotelLocation } from "@/types/hotel";

interface HotelsLocationPanelProps {
  selectedLocation: HotelLocation | "";
  onSelectLocation: (location: HotelLocation) => void;
  onClear: () => void;
}

export function HotelsLocationPanel({ selectedLocation, onSelectLocation, onClear }: HotelsLocationPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Where to</p>
          <p className="mt-1 text-sm text-slate-600">Choose a city first. Detailed transport filters stay in More filters.</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Anywhere
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
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70 sm:block">Stay in</span>
              <span className="block text-sm font-semibold sm:mt-1">{formatHotelLocationLabel(location)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
