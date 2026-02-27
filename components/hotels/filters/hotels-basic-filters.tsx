import {
  HOTEL_LOCATIONS,
  MIN_RATING_OPTIONS,
  STAY_PURPOSE_OPTIONS,
} from "@/lib/hotels/hotels-filter-config";
import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";

interface HotelsBasicFiltersProps {
  state: HotelsPageQueryState;
}

const INPUT_CLASS_NAME =
  "w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-slate-900 transition focus:ring-2";

export function HotelsBasicFilters({ state }: HotelsBasicFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <label className="block md:col-span-2 lg:col-span-3">
        <span className="mb-2 block text-sm font-medium text-slate-700">Search</span>
        <input
          value={state.textInput}
          onChange={(event) => {
            state.patchQuery({ q: event.target.value.trim() || undefined });
          }}
          placeholder="Hotel title or description"
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Location</span>
        <select
          value={state.selectedLocation}
          onChange={(event) => {
            state.patchQuery({ location: event.target.value || undefined });
          }}
          className={INPUT_CLASS_NAME}
        >
          <option value="">All locations</option>
          {HOTEL_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Purpose</span>
        <select
          value={state.selectedPurpose}
          onChange={(event) => {
            state.patchQuery({ purpose: event.target.value || undefined });
          }}
          className={INPUT_CLASS_NAME}
        >
          <option value="">Any purpose</option>
          {STAY_PURPOSE_OPTIONS.map((purpose) => (
            <option key={purpose.value} value={purpose.value}>
              {purpose.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Guests</span>
        <input
          value={state.guestCountInput}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            state.patchQuery({ guests: digits || undefined });
          }}
          inputMode="numeric"
          placeholder="2"
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Check-in</span>
        <input
          type="date"
          value={state.checkInInput}
          onChange={(event) => {
            state.patchQuery({ checkIn: event.target.value || undefined });
          }}
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Check-out</span>
        <input
          type="date"
          value={state.checkOutInput}
          onChange={(event) => {
            state.patchQuery({ checkOut: event.target.value || undefined });
          }}
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Min price (KRW)</span>
        <input
          value={state.minInput}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            state.patchQuery({ min: digits || undefined });
          }}
          inputMode="numeric"
          placeholder="0"
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Max price (KRW)</span>
        <input
          value={state.maxInput}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            state.patchQuery({ max: digits || undefined });
          }}
          inputMode="numeric"
          placeholder="500000"
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Min rating</span>
        <select
          value={state.minRatingInput}
          onChange={(event) => {
            state.patchQuery({ minRating: event.target.value || undefined });
          }}
          className={INPUT_CLASS_NAME}
        >
          <option value="">Any rating</option>
          {MIN_RATING_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value.toFixed(1)}+
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Dong</span>
        <input
          value={state.dongInput}
          onChange={(event) => {
            state.patchQuery({ dong: event.target.value.trim() || undefined });
          }}
          placeholder="e.g. Yeoksam-dong"
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Nearest subway</span>
        <input
          value={state.nearestSubwayInput}
          onChange={(event) => {
            state.patchQuery({ subway: event.target.value.trim() || undefined });
          }}
          placeholder="Gangnam Station"
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Subway lines (comma)</span>
        <input
          value={state.subwayLinesInput}
          onChange={(event) => {
            const normalized = event.target.value.replace(/[^\d,\s]/g, "");
            state.patchQuery({ lines: normalized.trim() || undefined });
          }}
          placeholder="2,9"
          className={INPUT_CLASS_NAME}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Max walk (minutes)</span>
        <input
          value={state.maxWalkingDistanceInput}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            state.patchQuery({ walk: digits || undefined });
          }}
          inputMode="numeric"
          placeholder="15"
          className={INPUT_CLASS_NAME}
        />
      </label>
    </div>
  );
}
