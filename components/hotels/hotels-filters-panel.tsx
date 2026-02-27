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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <HotelsBasicFilters state={state} />
      <HotelsFlagsFilters state={state} />
      <HotelsCategoriesFilters state={state} />
      <HotelsAmenitiesFilters state={state} />

      {state.hasPriceRangeError ? (
        <ErrorNotice className="mt-3" tone="warn" message="Min price must be less than or equal to max price." />
      ) : null}
      {state.hasDateRangeError ? (
        <ErrorNotice className="mt-3" tone="warn" message="Check-out must be after check-in." />
      ) : null}
    </section>
  );
}
