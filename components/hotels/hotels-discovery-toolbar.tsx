import { useEffect, useMemo, useRef, useState } from "react";
import { HOTEL_LOCATIONS, HOTELS_SORT_OPTIONS } from "@/lib/hotels/hotels-filter-config";
import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";
import type { HotelLocation } from "@/types/hotel";

interface HotelsDiscoveryToolbarProps {
  state: HotelsPageQueryState;
  total: number;
  loading: boolean;
  onOpenFilters: () => void;
}

type OpenPanel = "location" | "dates" | "guests" | null;

interface CalendarCell {
  date: Date | null;
  inMonth: boolean;
  key: string;
}

const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const isIsoDateInput = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const createUtcDate = (year: number, monthIndex: number, day: number): Date => new Date(Date.UTC(year, monthIndex, day));

const parseIsoDate = (value: string): Date | null => {
  if (!isIsoDateInput(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  return createUtcDate(Number(yearText), Number(monthText) - 1, Number(dayText));
};

const toIsoDate = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfUtcMonth = (value: Date): Date => createUtcDate(value.getUTCFullYear(), value.getUTCMonth(), 1);

const addUtcMonths = (value: Date, amount: number): Date => createUtcDate(value.getUTCFullYear(), value.getUTCMonth() + amount, 1);

const isSameUtcDay = (first: Date | null, second: Date | null): boolean =>
  Boolean(first && second && first.getTime() === second.getTime());

const isBeforeUtcDay = (first: Date, second: Date): boolean => first.getTime() < second.getTime();

const formatLocationLabel = (value: HotelLocation): string =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDateLabel = (value: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return "";
  }

  const month = SHORT_MONTH_LABELS[parsed.getUTCMonth()] ?? "";
  return `${month} ${parsed.getUTCDate()}`;
};

const buildDateSummary = (checkIn: string, checkOut: string): string => {
  const start = formatDateLabel(checkIn);
  const end = formatDateLabel(checkOut);

  if (start && end) {
    return `${start} - ${end}`;
  }
  if (start) {
    return `From ${start}`;
  }
  if (end) {
    return `Until ${end}`;
  }
  return "Add dates";
};

const parseGuestCount = (value: string): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
};

const getInitialVisibleMonth = (checkInInput: string): Date => {
  const selected = parseIsoDate(checkInInput);
  if (selected) {
    return startOfUtcMonth(selected);
  }

  const now = new Date();
  return createUtcDate(now.getFullYear(), now.getMonth(), 1);
};

const buildMonthCells = (monthStart: Date): CalendarCell[] => {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const firstWeekday = monthStart.getUTCDay();
  const daysInCurrentMonth = createUtcDate(year, month + 1, 0).getUTCDate();

  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({
      date: null,
      inMonth: false,
      key: `leading-${year}-${month}-${index}`,
    });
  }

  for (let day = 1; day <= daysInCurrentMonth; day += 1) {
    cells.push({
      date: createUtcDate(year, month, day),
      inMonth: true,
      key: `day-${year}-${month}-${day}`,
    });
  }

  while (cells.length < 42) {
    cells.push({
      date: null,
      inMonth: false,
      key: `trailing-${year}-${month}-${cells.length}`,
    });
  }

  return cells;
};

const formatMonthTitle = (monthStart: Date): string =>
  `${MONTH_LABELS[monthStart.getUTCMonth()] ?? ""} ${monthStart.getUTCFullYear()}`;

const getNightCount = (checkIn: Date | null, checkOut: Date | null): number => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  return Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
};

export function HotelsDiscoveryToolbar({ state, total, loading, onOpenFilters }: HotelsDiscoveryToolbarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [draftText, setDraftText] = useState(state.textInput);
  const [draftCheckIn, setDraftCheckIn] = useState(state.checkInInput);
  const [draftCheckOut, setDraftCheckOut] = useState(state.checkOutInput);
  const [draftGuests, setDraftGuests] = useState<number>(parseGuestCount(state.guestCountInput));
  const [visibleMonthStart, setVisibleMonthStart] = useState<Date | null>(null);
  const [todayDate, setTodayDate] = useState<Date | null>(null);

  useEffect(() => {
    setDraftText(state.textInput);
  }, [state.textInput]);

  useEffect(() => {
    const now = new Date();
    setTodayDate(createUtcDate(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  useEffect(() => {
    if (!openPanel) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openPanel]);

  const hiddenFilterCount = useMemo(() => {
    const quickFilterCount =
      (state.textInput.trim() ? 1 : 0) +
      (state.selectedLocation ? 1 : 0) +
      (state.checkInInput || state.checkOutInput ? 1 : 0) +
      (state.guestCountInput ? 1 : 0);

    return Math.max(0, state.activeFilterCount - quickFilterCount);
  }, [
    state.activeFilterCount,
    state.checkInInput,
    state.checkOutInput,
    state.guestCountInput,
    state.selectedLocation,
    state.textInput,
  ]);

  const selectedCheckInDate = useMemo(() => parseIsoDate(draftCheckIn), [draftCheckIn]);
  const selectedCheckOutDate = useMemo(() => parseIsoDate(draftCheckOut), [draftCheckOut]);
  const hasDraftDateError = Boolean(
    selectedCheckInDate && selectedCheckOutDate && !isBeforeUtcDay(selectedCheckInDate, selectedCheckOutDate),
  );

  const primaryMonth = visibleMonthStart;
  const secondaryMonth = primaryMonth ? addUtcMonths(primaryMonth, 1) : null;
  const minimumVisibleMonth = todayDate ? startOfUtcMonth(todayDate) : null;
  const canGoToPreviousMonth = Boolean(primaryMonth && minimumVisibleMonth && isBeforeUtcDay(minimumVisibleMonth, primaryMonth));

  const locationSummary = state.selectedLocation ? formatLocationLabel(state.selectedLocation) : "Anywhere";
  const dateSummary = buildDateSummary(state.checkInInput, state.checkOutInput);
  const guestSummary = state.guestCountInput
    ? `${state.guestCountInput} guest${state.guestCountInput === "1" ? "" : "s"}`
    : "Add guests";
  const stayNightCount = getNightCount(selectedCheckInDate, selectedCheckOutDate);

  const openLocationPanel = () => {
    setOpenPanel((current) => (current === "location" ? null : "location"));
  };

  const openDatesPanel = () => {
    if (openPanel === "dates") {
      setOpenPanel(null);
      return;
    }

    setDraftCheckIn(state.checkInInput);
    setDraftCheckOut(state.checkOutInput);
    setVisibleMonthStart(getInitialVisibleMonth(state.checkInInput));
    setOpenPanel("dates");
  };

  const openGuestsPanel = () => {
    if (openPanel === "guests") {
      setOpenPanel(null);
      return;
    }

    setDraftGuests(parseGuestCount(state.guestCountInput));
    setOpenPanel("guests");
  };

  const applySearch = (additionalPatch?: Record<string, string | undefined>) => {
    state.patchQuery({
      q: draftText.trim() || undefined,
      ...additionalPatch,
    });
  };

  const applyDateDraft = () => {
    if (hasDraftDateError) {
      return;
    }

    applySearch({
      checkIn: draftCheckIn || undefined,
      checkOut: draftCheckOut || undefined,
    });
    setOpenPanel(null);
  };

  const clearDateDraft = () => {
    setDraftCheckIn("");
    setDraftCheckOut("");
    applySearch({
      checkIn: undefined,
      checkOut: undefined,
    });
  };

  const applyGuestDraft = () => {
    applySearch({
      guests: String(draftGuests),
    });
    setOpenPanel(null);
  };

  const clearGuestDraft = () => {
    setDraftGuests(2);
    applySearch({
      guests: undefined,
    });
  };

  const handleSearch = () => {
    if (openPanel === "dates" && hasDraftDateError) {
      applySearch();
      return;
    }

    if (openPanel === "dates") {
      applySearch({
        checkIn: draftCheckIn || undefined,
        checkOut: draftCheckOut || undefined,
      });
      setOpenPanel(null);
      return;
    }

    if (openPanel === "guests") {
      applySearch({
        guests: String(draftGuests),
      });
      setOpenPanel(null);
      return;
    }

    applySearch();
    setOpenPanel(null);
  };

  const handleCalendarDayClick = (date: Date) => {
    if (todayDate && isBeforeUtcDay(date, todayDate)) {
      return;
    }

    const isoDate = toIsoDate(date);

    if (!selectedCheckInDate || (selectedCheckInDate && selectedCheckOutDate)) {
      setDraftCheckIn(isoDate);
      setDraftCheckOut("");
      return;
    }

    if (!selectedCheckOutDate) {
      if (!isBeforeUtcDay(selectedCheckInDate, date)) {
        setDraftCheckIn(isoDate);
        setDraftCheckOut("");
        return;
      }

      setDraftCheckOut(isoDate);
    }
  };

  const renderCalendarMonth = (monthStart: Date) => {
    const cells = buildMonthCells(monthStart);

    return (
      <div key={monthStart.toISOString()} className="rounded-[1.15rem] border border-slate-200 bg-white/90 p-2 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.4)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">{formatMonthTitle(monthStart)}</p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Exact dates</p>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {WEEKDAY_LABELS.map((label) => (
            <span key={`${monthStart.toISOString()}-${label}`} className="py-0.5">
              {label}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-0.5">
          {cells.map((cell) => {
            const cellDate = cell.date;

            if (!cellDate) {
              return <div key={cell.key} className="h-8 rounded-md border border-transparent" aria-hidden="true" />;
            }

            const isPastDate = Boolean(todayDate && isBeforeUtcDay(cellDate, todayDate));
            const isStart = isSameUtcDay(selectedCheckInDate, cellDate);
            const isEnd = isSameUtcDay(selectedCheckOutDate, cellDate);
            const isBoundary = isStart || isEnd;
            const isInRange = Boolean(
              selectedCheckInDate &&
                selectedCheckOutDate &&
                isBeforeUtcDay(selectedCheckInDate, cellDate) &&
                isBeforeUtcDay(cellDate, selectedCheckOutDate),
            );

            return (
              <button
                key={cell.key}
                type="button"
                disabled={isPastDate}
                onClick={() => {
                  handleCalendarDayClick(cellDate);
                }}
                className={`flex h-8 items-center justify-center rounded-md border text-[12px] font-semibold transition ${
                  isBoundary
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_12px_24px_-16px_rgba(79,70,229,0.8)]"
                    : isInRange
                      ? "border-slate-300 bg-slate-200 text-slate-900"
                      : isPastDate
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {cellDate.getUTCDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative z-30 rounded-[2rem] border border-slate-200/90 bg-white/95 p-3 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)]"
    >
      <div className="relative z-20 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="flex-1 rounded-[1.3rem] bg-white px-4 py-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Search stays</span>
            <input
              value={draftText}
              onChange={(event) => {
                setDraftText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Hotel name, district, or landmark"
              className="mt-1 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:items-center">
            <button
              type="button"
              onClick={handleSearch}
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
                value={state.sortBy}
                onChange={(event) => {
                  state.patchQuery({ sort: event.target.value });
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

      <div className="relative z-20 mt-3">
        <div className="rounded-[1.7rem] border border-slate-200 bg-slate-50/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-[1fr_1fr_1fr_auto]">
            <button
              type="button"
              onClick={openLocationPanel}
              className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
                openPanel === "location" ? "bg-white shadow-sm" : "hover:bg-white/80"
              }`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Location</span>
              <span className="mt-1 block text-sm font-medium text-slate-900">{locationSummary}</span>
            </button>

            <button
              type="button"
              onClick={openDatesPanel}
              className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
                openPanel === "dates" ? "bg-white shadow-sm" : "hover:bg-white/80"
              }`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">When</span>
              <span className="mt-1 block text-sm font-medium text-slate-900">{dateSummary}</span>
            </button>

            <button
              type="button"
              onClick={openGuestsPanel}
              className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
                openPanel === "guests" ? "bg-white shadow-sm" : "hover:bg-white/80"
              }`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Guests</span>
              <span className="mt-1 block text-sm font-medium text-slate-900">{guestSummary}</span>
            </button>

            <button
              type="button"
              onClick={onOpenFilters}
              className={`relative inline-flex min-h-[4.75rem] items-center justify-center rounded-[1.35rem] border bg-white text-slate-700 transition hover:text-slate-900 ${
                hiddenFilterCount > 0
                  ? "border-slate-300 px-3 shadow-sm hover:border-slate-400 md:min-w-[6.25rem] md:gap-2"
                  : "border-slate-200 hover:border-slate-300 md:w-14"
              }`}
              aria-label="Open more filters"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0">
                <path d="M4 7h16" />
                <path d="M7 12h10" />
                <path d="M10 17h4" />
              </svg>
              {hiddenFilterCount > 0 ? (
                <span className="hidden md:flex md:flex-col md:items-start md:leading-none">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Stays</span>
                  <span className="mt-1 text-sm font-semibold text-slate-900">{loading ? "..." : total.toLocaleString()}</span>
                </span>
              ) : null}
              {hiddenFilterCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white">
                  {hiddenFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {openPanel ? (
        <div
          className={`absolute top-full z-40 mt-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.35)] sm:p-5 ${
            openPanel === "dates"
              ? "left-0 right-0 md:left-1/2 md:right-auto md:w-full md:max-w-4xl md:-translate-x-1/2"
              : openPanel === "location"
                ? "left-0 right-0 md:right-auto md:w-full md:max-w-4xl"
                : "left-0 right-0 md:left-auto md:w-full md:max-w-2xl"
          }`}
        >
          {openPanel === "location" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Where to</p>
                  <p className="mt-1 text-sm text-slate-600">Choose a city first. Detailed transport filters stay in More filters.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    state.patchQuery({ location: undefined });
                    setOpenPanel(null);
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Anywhere
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {HOTEL_LOCATIONS.map((location) => {
                  const isActive = state.selectedLocation === location;

                  return (
                    <button
                      key={location}
                      type="button"
                      onClick={() => {
                        state.patchQuery({ location });
                        setOpenPanel(null);
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50/70 text-slate-800 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Stay in</span>
                      <span className="mt-1 block text-sm font-semibold">{formatLocationLabel(location)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {openPanel === "dates" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Choose your stay</p>
                  <p className="mt-1 text-sm text-slate-600">Pick check-in and check-out from a compact two-month calendar, then apply once.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (primaryMonth && canGoToPreviousMonth) {
                        setVisibleMonthStart(addUtcMonths(primaryMonth, -1));
                      }
                    }}
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
                    onClick={() => {
                      if (primaryMonth) {
                        setVisibleMonthStart(addUtcMonths(primaryMonth, 1));
                      }
                    }}
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
                <div className="grid gap-2 md:grid-cols-2">
                  {primaryMonth ? renderCalendarMonth(primaryMonth) : null}
                  {secondaryMonth ? renderCalendarMonth(secondaryMonth) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected stay</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedCheckInDate
                      ? selectedCheckOutDate
                        ? `${formatDateLabel(draftCheckIn)} - ${formatDateLabel(draftCheckOut)}`
                        : `${formatDateLabel(draftCheckIn)} check-in`
                      : "No exact dates selected"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {stayNightCount > 0
                      ? `${stayNightCount} night${stayNightCount === 1 ? "" : "s"}`
                      : "Pick a start date, then an end date, then apply the range."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={clearDateDraft}
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Clear dates
                  </button>
                  <button
                    type="button"
                    onClick={applyDateDraft}
                    disabled={hasDraftDateError}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply dates
                  </button>
                </div>
              </div>

              {hasDraftDateError ? (
                <p className="text-xs font-medium text-rose-600">Check-out must be later than check-in.</p>
              ) : null}
            </div>
          ) : null}

          {openPanel === "guests" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Who is staying</p>
                  <p className="mt-1 text-sm text-slate-600">Match rooms that comfortably fit your group size.</p>
                </div>
                <button
                  type="button"
                  onClick={clearGuestDraft}
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
                    onClick={() => {
                      setDraftGuests((current) => Math.max(1, current - 1));
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-400"
                    aria-label="Decrease guests"
                  >
                    -
                  </button>
                  <div className="min-w-12 text-center text-lg font-semibold text-slate-900">{draftGuests}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftGuests((current) => Math.min(20, current + 1));
                    }}
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
                  onClick={applyGuestDraft}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Apply guests
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
