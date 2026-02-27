import type { ReactNode } from "react";

interface HotelsDatePanelProps {
  canGoToPreviousMonth: boolean;
  months: ReactNode[];
  selectedSummary: string;
  selectedHint: string;
  hasDateRangeError: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onClearDates: () => void;
  onApplyDates: () => void;
}

export function HotelsDatePanel({
  canGoToPreviousMonth,
  months,
  selectedSummary,
  selectedHint,
  hasDateRangeError,
  onPreviousMonth,
  onNextMonth,
  onClearDates,
  onApplyDates,
}: HotelsDatePanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Choose your stay</p>
          <p className="mt-1 text-sm text-slate-600">Pick check-in and check-out from a compact two-month calendar, then apply once.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousMonth}
            disabled={!canGoToPreviousMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
            aria-label="Previous months"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            aria-label="Next months"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-auto w-full rounded-[1.2rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-2">
        <div className="grid gap-2 md:grid-cols-2">{months}</div>
      </div>

      <div className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected stay</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{selectedSummary}</p>
          <p className="mt-1 text-xs text-slate-500">{selectedHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClearDates}
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Clear dates
          </button>
          <button
            type="button"
            onClick={onApplyDates}
            disabled={hasDateRangeError}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply dates
          </button>
        </div>
      </div>

      {hasDateRangeError ? <p className="text-xs font-medium text-rose-600">Check-out must be later than check-in.</p> : null}
    </div>
  );
}
