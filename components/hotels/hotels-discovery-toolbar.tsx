import { useEffect, useState, type FormEvent } from "react";
import {
  HOTEL_LOCATIONS,
  HOTELS_SORT_OPTIONS,
  STAY_PURPOSE_OPTIONS,
} from "@/lib/hotels/hotels-filter-config";
import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";

const FEATURED_LOCATIONS = HOTEL_LOCATIONS.slice(0, 4);
const FEATURED_PURPOSES = STAY_PURPOSE_OPTIONS.slice(0, 4);

interface HotelsDiscoveryToolbarProps {
  state: HotelsPageQueryState;
  total: number;
  loading: boolean;
  onOpenFilters: () => void;
}

export function HotelsDiscoveryToolbar({ state, total, loading, onOpenFilters }: HotelsDiscoveryToolbarProps) {
  const [searchDraft, setSearchDraft] = useState(state.textInput);

  useEffect(() => {
    setSearchDraft(state.textInput);
  }, [state.textInput]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.patchQuery({ q: searchDraft.trim() || undefined });
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-sky-100/70 bg-gradient-to-br from-white via-sky-50/60 to-emerald-50/45 p-3.5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.35)] sm:p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-200/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-emerald-200/30 blur-2xl" />

      <div className="relative">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Find Stays Faster</p>
            <p className="mt-1 text-sm text-slate-600">
              {loading ? "Refreshing results..." : `${total.toLocaleString()} stays matched`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenFilters}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Filters {state.activeFilterCount > 0 ? `(${state.activeFilterCount})` : ""}
            </button>
            {state.activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  state.clearQuery();
                }}
                className="rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/80 hover:text-slate-900"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        <form onSubmit={submitSearch} className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search by hotel name, mood, or vibe"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none ring-slate-900 transition focus:ring-2"
          />
          <select
            value={state.sortBy}
            onChange={(event) => {
              state.patchQuery({ sort: event.target.value || undefined }, false);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none ring-slate-900 transition focus:ring-2"
          >
            {HOTELS_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Search
          </button>
        </form>

        <div className="mt-2 hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-5">
          <select
            value={state.selectedLocation}
            onChange={(event) => {
              state.patchQuery({ location: event.target.value || undefined });
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
          >
            <option value="">All locations</option>
            {HOTEL_LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
          <select
            value={state.selectedPurpose}
            onChange={(event) => {
              state.patchQuery({ purpose: event.target.value || undefined });
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
          >
            <option value="">Any purpose</option>
            {STAY_PURPOSE_OPTIONS.map((purpose) => (
              <option key={purpose.value} value={purpose.value}>
                {purpose.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={state.checkInInput}
            onChange={(event) => {
              state.patchQuery({ checkIn: event.target.value || undefined });
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
          />
          <input
            type="date"
            value={state.checkOutInput}
            onChange={(event) => {
              state.patchQuery({ checkOut: event.target.value || undefined });
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
          />
          <input
            value={state.guestCountInput}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              state.patchQuery({ guests: digits || undefined });
            }}
            inputMode="numeric"
            placeholder="Guests"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
          />
        </div>

        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 sm:mt-3 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {FEATURED_LOCATIONS.map((location) => {
            const selected = state.selectedLocation === location;
            return (
              <button
                key={location}
                type="button"
                onClick={() => {
                  state.patchQuery({ location: selected ? undefined : location });
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em] transition ${
                  selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"
                }`}
              >
                {location}
              </button>
            );
          })}
          {FEATURED_PURPOSES.map((purpose) => {
            const selected = state.selectedPurpose === purpose.value;
            return (
              <button
                key={purpose.value}
                type="button"
                onClick={() => {
                  state.patchQuery({ purpose: selected ? undefined : purpose.value });
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em] transition ${
                  selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"
                }`}
              >
                {purpose.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
