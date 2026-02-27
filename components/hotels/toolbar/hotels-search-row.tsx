import type { ChangeEvent, KeyboardEvent } from "react";
import { HOTELS_SORT_OPTIONS, type HotelsSortBy } from "@/lib/hotels/hotels-filter-config";

interface HotelsSearchRowProps {
  draftText: string;
  sortBy: HotelsSortBy;
  onDraftTextChange: (value: string) => void;
  onSearch: () => void;
  onSortChange: (value: HotelsSortBy) => void;
}

export function HotelsSearchRow({
  draftText,
  sortBy,
  onDraftTextChange,
  onSearch,
  onSortChange,
}: HotelsSearchRowProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onDraftTextChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch();
    }
  };

  return (
    <div className="relative z-20 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <label className="flex-1 rounded-[1.3rem] bg-white px-4 py-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)]">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Search stays</span>
          <input
            value={draftText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Hotel name, district, or landmark"
            className="mt-1 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:items-center">
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] bg-rose-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-600 md:min-w-[9.5rem] md:px-5 md:py-4"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="m21 21-4.35-4.35" />
              <circle cx="11" cy="11" r="6" />
            </svg>
            Search
          </button>

          <label className="flex items-center gap-2 rounded-[1.3rem] bg-white px-3 py-3 text-sm text-slate-600 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)] md:min-w-[13rem] md:px-4">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:text-[11px]">Sort</span>
            <select
              value={sortBy}
              onChange={(event) => {
                onSortChange(event.target.value as HotelsSortBy);
              }}
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
            >
              {HOTELS_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
