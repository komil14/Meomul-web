interface PriceLockReadyBarProps {
  basePrice: number;
  locking: boolean;
  onLockPrice: () => void;
}

export function PriceLockReadyBar({ basePrice, locking, onLockPrice }: PriceLockReadyBarProps) {
  return (
    <section className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_28px_-18px_rgba(15,23,42,0.65)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Price lock ready</p>
          <p className="text-sm font-semibold text-slate-900">Lock ₩ {basePrice.toLocaleString()} for 30 minutes</p>
        </div>
        <button
          type="button"
          onClick={onLockPrice}
          disabled={locking}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {locking ? "Locking..." : "Lock price"}
        </button>
      </div>
    </section>
  );
}
