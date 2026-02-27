import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";

interface HotelsFlagsFiltersProps {
  state: HotelsPageQueryState;
}

export function HotelsFlagsFilters({ state }: HotelsFlagsFiltersProps) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={state.verifiedOnly}
          onChange={(event) => {
            state.patchQuery({ verified: event.target.checked ? "1" : undefined });
          }}
          className="h-4 w-4"
        />
        Verified only
      </label>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={state.petsAllowed}
          onChange={(event) => {
            state.patchQuery({ pets: event.target.checked ? "1" : undefined });
          }}
          className="h-4 w-4"
        />
        Pets allowed
      </label>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={state.wheelchairAccessible}
          onChange={(event) => {
            state.patchQuery({ wheelchair: event.target.checked ? "1" : undefined });
          }}
          className="h-4 w-4"
        />
        Wheelchair accessible
      </label>
    </div>
  );
}
