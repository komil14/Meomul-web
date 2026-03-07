import Link, { type LinkProps } from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DayPicker, type DateRange, type DayButtonProps, type DayPickerProps } from "react-day-picker";
import { PriceDayButton } from "@/components/rooms/detail/price-day-button";
import { useI18n } from "@/lib/i18n/provider";
import { formatDateInput, isCalendarDayBookable } from "@/lib/rooms/booking";
import { formatNumber } from "@/lib/utils/format";
import type { DemandLevel } from "@/types/hotel";
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
  availabilityByDate: Map<string, DayPriceDto>;
  selectedRange: DateRange | undefined;
  calendarMonthDate: Date;
  minCalendarMonthDate: Date;
  onCalendarMonthChange: (month: Date) => void;
  onCalendarDayClick: (day: Date | undefined) => void;
  disabledDays: (date: Date) => boolean;
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

export const RoomBookingSidebar = memo(function RoomBookingSidebar({
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
  availabilityByDate,
  selectedRange,
  calendarMonthDate,
  minCalendarMonthDate,
  onCalendarMonthChange,
  onCalendarDayClick,
  disabledDays,
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
  const { t } = useI18n();
  const hoverFrameRef = useRef<number | null>(null);
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);

  const commitHoveredDateKey = useCallback((nextDateKey: string | null): void => {
    setHoveredDateKey((previous) => (previous === nextDateKey ? previous : nextDateKey));
  }, []);

  const handleHoverDateKey = useCallback(
    (nextDateKey: string | null): void => {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }

      hoverFrameRef.current = window.requestAnimationFrame(() => {
        hoverFrameRef.current = null;
        commitHoveredDateKey(nextDateKey);
      });
    },
    [commitHoveredDateKey],
  );

  const handleCalendarMouseLeave = useCallback(() => {
    handleHoverDateKey(null);
  }, [handleHoverDateKey]);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }
    },
    [],
  );

  const hoveredDay = useMemo(
    () => (hoveredDateKey ? availabilityByDate.get(hoveredDateKey) : undefined),
    [availabilityByDate, hoveredDateKey],
  );
  const demandLabelMap = useMemo<Record<DemandLevel, string>>(
    () => ({
      LOW: t("room_demand_low"),
      MEDIUM: t("room_demand_medium"),
      HIGH: t("room_demand_high"),
    }),
    [t],
  );

  const dayPickerComponents = useMemo<DayPickerProps["components"]>(
    () => ({
      DayButton: (props: DayButtonProps) => (
        <PriceDayButton
          {...props}
          price={availabilityByDate.get(formatDateInput(props.day.date))}
          onHover={handleHoverDateKey}
        />
      ),
    }),
    [availabilityByDate, handleHoverDateKey],
  );

  return (
    <aside className="order-1 self-start space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-sm backdrop-blur sm:rounded-3xl sm:p-4 lg:order-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t("room_booking_quick")}</p>
        <h3 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">{t("room_booking_title")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("room_booking_steps")}</p>
      </div>

      <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("room_booking_rate_title")}</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">₩ {formatNumber(effectiveNightlyRate)}</p>
        <p className="text-[11px] text-slate-600">{effectiveNightlyRateSourceLabel}</p>
      </article>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("room_booking_checkin")}</span>
          <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900">{checkInDate || t("room_booking_select_date")}</div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("room_booking_checkout")}</span>
          <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900">{checkOutDate || t("room_booking_select_date")}</div>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("room_booking_adults")}</span>
        <input
          value={String(adultCount)}
          onChange={(event) => onAdultCountChange(event.target.value)}
          inputMode="numeric"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold outline-none ring-slate-900 focus:ring-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("room_booking_children")}</span>
          <input
            value={String(childCount)}
            onChange={(event) => onChildCountChange(event.target.value)}
            inputMode="numeric"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold outline-none ring-slate-900 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("room_booking_rooms")}</span>
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">{t("room_booking_preview_title")}</p>
            <div className="mt-1.5 h-[78px] rounded-lg border border-sky-200 bg-white/80 px-3 py-2">
              {hoveredDateKey && hoveredDay ? (
                <div className="flex h-full items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{hoveredDateKey}</p>
                    <p className="text-xs text-slate-600">
                      {isCalendarDayBookable(hoveredDay)
                        ? t("room_booking_rooms_left", {
                            count: hoveredDay.availableRooms ?? 0,
                            demand: demandLabelMap[hoveredDay.demandLevel],
                          })
                        : t("room_booking_unavailable")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("room_booking_nightly_price")}</p>
                    <p className="text-xl font-bold text-sky-900">₩ {formatNumber(hoveredDay.price)}</p>
                  </div>
                </div>
              ) : <div className="flex h-full items-center text-xs text-slate-600">{t("room_booking_preview_hint")}</div>}
            </div>
          </div>
          <div className="overflow-x-auto pb-1" onMouseLeave={handleCalendarMouseLeave}>
            <DayPicker
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
          {calendarLoadInProgress && visibleWindowCalendarLength === 0 ? <p className="mt-2 text-[11px] text-slate-500">{t("room_booking_loading_availability")}</p> : null}
          {calendarLoadErrorMessage && visibleWindowCalendarLength === 0 ? <p className="mt-2 text-[11px] text-amber-700">{calendarLoadErrorMessage}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              {t("room_booking_selected_range")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              {t("room_booking_unavailable_label")}
            </span>
          </div>
        </div>
      </div>

      {visibleWindowCalendarLength > 0 ? (
        <div className="grid gap-2 text-xs text-slate-700">
          <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            {t("room_booking_average_month")} <span className="font-semibold">₩ {formatNumber(averageVisiblePrice)}</span>
          </p>
          {cheapestDateKey ? (
            <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              {t("room_booking_cheapest")}{" "}
              <span className="font-semibold">
                {cheapestDateKey} · ₩ {cheapestDatePrice != null ? formatNumber(cheapestDatePrice) : "-"}
              </span>
            </p>
          ) : null}
          {peakDateKey ? (
            <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              {t("room_booking_peak")}{" "}
              <span className="font-semibold">
                {peakDateKey} · ₩ {peakDatePrice != null ? formatNumber(peakDatePrice) : "-"}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="text-[11px] text-slate-500">{t("room_booking_calendar_note")}</p>

      {bookingValidationMessage ? <p className="text-xs font-medium text-amber-700">{bookingValidationMessage}</p> : null}

      {canContinueBooking && continueBookingHref ? (
        <Link
          href={continueBookingHref}
          className="inline-flex w-full touch-manipulation items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          {t("room_booking_continue")}
        </Link>
      ) : (
        <button type="button" disabled className="inline-flex w-full touch-manipulation items-center justify-center rounded-lg bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">
          {t("room_booking_complete_details")}
        </button>
      )}
    </aside>
  );
});
