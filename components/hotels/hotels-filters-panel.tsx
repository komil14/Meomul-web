import { ErrorNotice } from "@/components/ui/error-notice";
import { HotelsAmenitiesFilters } from "@/components/hotels/filters/hotels-amenities-filters";
import { HotelsBasicFilters } from "@/components/hotels/filters/hotels-basic-filters";
import { HotelsCategoriesFilters } from "@/components/hotels/filters/hotels-categories-filters";
import { HotelsFlagsFilters } from "@/components/hotels/filters/hotels-flags-filters";
import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";

interface HotelsFiltersPanelProps {
  state: HotelsPageQueryState;
}

export function HotelsFiltersPanel({ state }: HotelsFiltersPanelProps) {
  return (
    <section className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <header className="mb-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trip basics</p>
          <p className="text-sm text-slate-600">Set where, when, and how you want to stay.</p>
        </header>
        <HotelsBasicFilters state={state} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <header className="mb-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Booking options</p>
          <p className="text-sm text-slate-600">Keep only stays that fit your booking requirements.</p>
        </header>
        <HotelsFlagsFilters state={state} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <header className="mb-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stay type</p>
          <p className="text-sm text-slate-600">Narrow by property style, room category, and rating.</p>
        </header>
        <HotelsCategoriesFilters state={state} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <header className="mb-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Amenities</p>
          <p className="text-sm text-slate-600">Choose the comforts and practical features you need.</p>
        </header>
        <HotelsAmenitiesFilters state={state} />
      </section>

      {state.hasPriceRangeError ? (
        <ErrorNotice className="mt-3" tone="warn" message="Min price must be less than or equal to max price." />
      ) : null}
      {state.hasDateRangeError ? (
        <ErrorNotice className="mt-3" tone="warn" message="Check-out must be after check-in." />
      ) : null}
    </section>
  );
}
