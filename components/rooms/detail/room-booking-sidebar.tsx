import Link, { type LinkProps } from "next/link";
import { DayPicker, type DateRange, type DayPickerProps } from "react-day-picker";
import type { CSSProperties } from "react";
import type { DayPriceDto } from "@/types/hotel";

interface RoomBookingSidebarProps {
  effectiveNightlyRate: number;
  effectiveNightlyRateSourceLabel: string;
  adultCount: number;
  childCount: number;
  roomQuantity: number;
  onAdultCountChange: (rawValue: string) => void;
  onChildCountChange: (rawValue: string) => void;
  onRoomQuantityChange: (rawValue: string) => void;
  checkInDate: string;
  checkOutDate: string;
  hoveredDateKey: string | null;
  hoveredDay: DayPriceDto | undefined;
  isCalendarDayBookable: (day: DayPriceDto | undefined) => boolean;
  calendarMonthKey: string;
  selectedRange: DateRange | undefined;
  calendarMonthDate: Date;
  minCalendarMonthDate: Date;
  onCalendarMonthChange: (month: Date) => void;
  onCalendarDayClick: (day: Date | undefined) => void;
  disabledDays: (date: Date) => boolean;
  dayPickerComponents: DayPickerProps["components"];
  dayPickerClassNames: DayPickerProps["classNames"];
  dayPickerStyle: CSSProperties;
  calendarLoadInProgress: boolean;
  calendarLoadErrorMessage: string | null;
  visibleWindowCalendarLength: number;
  averageVisiblePrice: number;
  cheapestDateKey: string;
  cheapestDatePrice?: number;
  peakDateKey: string;
  peakDatePrice?: number;
  bookingValidationMessage: string | null;
  canContinueBooking: boolean;
  continueBookingHref?: LinkProps["href"];
}

export function RoomBookingSidebar({
  effectiveNightlyRate,
  effectiveNightlyRateSourceLabel,
  adultCount,
  childCount,
  roomQuantity,
  onAdultCountChange,
  onChildCountChange,
  onRoomQuantityChange,
  checkInDate,
  checkOutDate,
  hoveredDateKey,
  hoveredDay,
  isCalendarDayBookable,
  calendarMonthKey,
  selectedRange,
  calendarMonthDate,
  minCalendarMonthDate,
  onCalendarMonthChange,
  onCalendarDayClick,
  disabledDays,
  dayPickerComponents,
  dayPickerClassNames,
  dayPickerStyle,
  calendarLoadInProgress,
  calendarLoadErrorMessage,
  visibleWindowCalendarLength,
  averageVisiblePrice,
  cheapestDateKey,
  cheapestDatePrice,
  peakDateKey,
  peakDatePrice,
  bookingValidationMessage,
  canContinueBooking,
  continueBookingHref,
}: RoomBookingSidebarProps) {
  return (
    <aside className="order-1 self-start space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur lg:order-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick Booking</p>
        <h3 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Select Stay Dates</h3>
        <p className="mt-1 text-xs text-slate-500">Step 1: dates • Step 2: guests • Step 3: continue to booking</p>
      </div>

      <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Current bookable nightly rate</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">₩ {effectiveNightlyRate.toLocaleString()}</p>
        <p className="text-[11px] text-slate-600">{effectiveNightlyRateSourceLabel}</p>
      </article>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-in</span>
          <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900">{checkInDate || "Select date"}</div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-out</span>
          <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900">{checkOutDate || "Select date"}</div>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Adults</span>
        <input
          value={String(adultCount)}
          onChange={(event) => onAdultCountChange(event.target.value)}
          inputMode="numeric"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold outline-none ring-slate-900 focus:ring-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Children</span>
          <input
            value={String(childCount)}
            onChange={(event) => onChildCountChange(event.target.value)}
            inputMode="numeric"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold outline-none ring-slate-900 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Rooms</span>
          <input
            value={String(roomQuantity)}
            onChange={(event) => onRoomQuantityChange(event.target.value)}
            inputMode="numeric"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold outline-none ring-slate-900 focus:ring-2"
          />
        </label>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 p-3.5 shadow-[0_18px_38px_-24px_rgba(15,23,42,0.42)] before:pointer-events-none before:absolute before:inset-[-40%_-20%] before:bg-[radial-gradient(circle_at_25%_30%,rgba(56,189,248,0.2),transparent_38%),radial-gradient(circle_at_75%_70%,rgba(59,130,246,0.16),transparent_34%),conic-gradient(from_160deg_at_50%_50%,rgba(148,163,184,0.08),rgba(59,130,246,0.12),rgba(14,165,233,0.08),rgba(148,163,184,0.08))] before:blur-[18px] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] after:bg-[length:16px_16px] after:opacity-20">
        <div className="relative z-10">
          <div className="mb-3 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">Live Date Preview</p>
            <div className="mt-1.5 h-[78px] rounded-lg border border-sky-200 bg-white/80 px-3 py-2">
              {hoveredDateKey && hoveredDay ? (
                <div className="flex h-full items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{hoveredDateKey}</p>
                    <p className="text-xs text-slate-600">
                      {isCalendarDayBookable(hoveredDay)
                        ? `${hoveredDay.availableRooms ?? 0} room(s) left · ${hoveredDay.demandLevel.toLowerCase()} demand`
                        : "Unavailable for booking"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Nightly Price</p>
                    <p className="text-xl font-bold text-sky-900">₩ {hoveredDay.price.toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center text-xs text-slate-600">Hover a date to preview exact nightly price and availability.</div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto pb-1">
            <DayPicker
              key={calendarMonthKey}
              mode="range"
              selected={selectedRange}
              month={calendarMonthDate}
              startMonth={minCalendarMonthDate}
              numberOfMonths={1}
              pagedNavigation
              onMonthChange={onCalendarMonthChange}
              onDayClick={onCalendarDayClick}
              disabled={disabledDays}
              components={dayPickerComponents}
              classNames={dayPickerClassNames}
              style={dayPickerStyle}
              fixedWeeks
            />
          </div>
          {calendarLoadInProgress && visibleWindowCalendarLength === 0 ? <p className="mt-2 text-[11px] text-slate-500">Loading availability...</p> : null}
          {calendarLoadErrorMessage && visibleWindowCalendarLength === 0 ? <p className="mt-2 text-[11px] text-amber-700">{calendarLoadErrorMessage}</p> : null}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              Selected range
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Unavailable
            </span>
          </div>
        </div>
      </div>

      {visibleWindowCalendarLength > 0 ? (
        <div className="grid gap-2 text-xs text-slate-700">
          <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            Average (this month): <span className="font-semibold">₩ {averageVisiblePrice.toLocaleString()}</span>
          </p>
          {cheapestDateKey ? (
            <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              Cheapest:{" "}
              <span className="font-semibold">
                {cheapestDateKey} · ₩ {cheapestDatePrice?.toLocaleString()}
              </span>
            </p>
          ) : null}
          {peakDateKey ? (
            <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              Peak:{" "}
              <span className="font-semibold">
                {peakDateKey} · ₩ {peakDatePrice?.toLocaleString()}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="text-[11px] text-slate-500">Calendar prices are demand preview. Booking confirms final nightly rate by backend rule: price lock, then deal, then base rate.</p>

      {bookingValidationMessage ? <p className="text-xs font-medium text-amber-700">{bookingValidationMessage}</p> : null}

      {canContinueBooking && continueBookingHref ? (
        <Link href={continueBookingHref} className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700">
          Continue to booking
        </Link>
      ) : (
        <button type="button" disabled className="inline-flex w-full items-center justify-center rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Complete booking details
        </button>
      )}
    </aside>
  );
}
