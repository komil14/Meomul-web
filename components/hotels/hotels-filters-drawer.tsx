import { useEffect } from "react";
import { HotelsFiltersPanel } from "@/components/hotels/hotels-filters-panel";
import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";

interface HotelsFiltersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  state: HotelsPageQueryState;
}

export function HotelsFiltersDrawer({ isOpen, onClose, state }: HotelsFiltersDrawerProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`fixed inset-0 z-[80] ${isOpen ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/45 transition duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
      />

      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-[#f6f9fd] p-3 shadow-2xl transition-transform duration-300 sm:p-4 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="sticky top-0 z-10 mb-3 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Advanced filters</p>
              <p className="mt-1 text-sm text-slate-600">Everything supported by backend search.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-slate-500"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <HotelsFiltersPanel state={state} />

        <div className="sticky bottom-0 mt-3 border-t border-slate-200 bg-[#f6f9fd]/95 pb-1 pt-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Show Results
          </button>
        </div>
      </aside>
    </div>
  );
}
