interface HotelsGuestsPanelProps {
  guestCount: number;
  onClear: () => void;
  onDecrease: () => void;
  onIncrease: () => void;
  onApply: () => void;
}

export function HotelsGuestsPanel({
  guestCount,
  onClear,
  onDecrease,
  onIncrease,
  onApply,
}: HotelsGuestsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Who is staying</p>
          <p className="mt-1 text-sm text-slate-600">Match rooms that comfortably fit your group size.</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Any guests
        </button>
      </div>

      <div className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Guests</p>
          <p className="mt-1 text-xs text-slate-500">Use this to filter rooms with enough capacity.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDecrease}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-400"
            aria-label="Decrease guests"
          >
            -
          </button>
          <div className="min-w-12 text-center text-lg font-semibold text-slate-900">{guestCount}</div>
          <button
            type="button"
            onClick={onIncrease}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-400"
            aria-label="Increase guests"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onApply}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Apply guests
        </button>
      </div>
    </div>
  );
}
