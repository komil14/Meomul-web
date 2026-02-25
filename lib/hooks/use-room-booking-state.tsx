import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getDefaultClassNames, type DateRange, type DayButtonProps, type DayPickerProps } from "react-day-picker";
import { PriceDayButton } from "@/components/rooms/detail/price-day-button";
import {
  buildStayDates,
  formatDateInput,
  hasStayDatesLoaded,
  isCalendarDayBookable,
  isStayRangeAvailable,
  toLocalDateFromDateKey,
  toMonthKey,
} from "@/lib/rooms/booking";
import type { DayPriceDto, GetPriceCalendarQueryData, GetPriceCalendarQueryVars, RoomDetailItem } from "@/types/hotel";

type RefetchPriceCalendar = (variables?: GetPriceCalendarQueryVars) => Promise<unknown>;

interface UseRoomBookingStateInput {
  roomId: string;
  room: RoomDetailItem | undefined;
  roomHotelId: string;
  isHydrated: boolean;
  todayDate: string;
  todayMonth: string;
  calendarMonth: string;
  setCalendarMonth: (value: string) => void;
  priceCalendarData: GetPriceCalendarQueryData | undefined;
  refetchPriceCalendar: RefetchPriceCalendar;
}

interface UseRoomBookingStateResult {
  checkInDate: string;
  checkOutDate: string;
  adultCount: number;
  childCount: number;
  roomQuantity: number;
  hoveredDateKey: string | null;
  hoveredDay: DayPriceDto | undefined;
  availabilityByDate: Map<string, DayPriceDto>;
  visibleWindowCalendar: DayPriceDto[];
  selectedStayMinAvailable: number | null;
  bookingValidationMessage: string | null;
  canContinueBooking: boolean;
  cheapestDateKey: string;
  peakDateKey: string;
  averageVisiblePrice: number;
  selectedRange: DateRange | undefined;
  calendarMonthDate: Date;
  minCalendarMonthDate: Date;
  dayPickerClassNames: DayPickerProps["classNames"];
  dayPickerStyle: CSSProperties;
  dayPickerComponents: DayPickerProps["components"];
  disabledDays: (date: Date) => boolean;
  onAdultCountChange: (rawValue: string) => void;
  onChildCountChange: (rawValue: string) => void;
  onRoomQuantityChange: (rawValue: string) => void;
  onCalendarMonthChange: (month: Date) => void;
  onCalendarDayClick: (date: Date | undefined) => void;
}

export const useRoomBookingState = ({
  roomId,
  room,
  roomHotelId,
  isHydrated,
  todayDate,
  todayMonth,
  calendarMonth,
  setCalendarMonth,
  priceCalendarData,
  refetchPriceCalendar,
}: UseRoomBookingStateInput): UseRoomBookingStateResult => {
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  const [roomQuantity, setRoomQuantity] = useState(1);
  const [calendarByMonth, setCalendarByMonth] = useState<Record<string, DayPriceDto[]>>({});
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const lastCalendarRefetchAtRef = useRef(0);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    setCalendarByMonth({});
    setCalendarMonth(todayMonth);
    setCheckInDate("");
    setCheckOutDate("");
    setChildCount(0);
    setRoomQuantity(1);
    setHoveredDateKey(null);
  }, [roomId, setCalendarMonth, todayMonth]);

  useEffect(() => {
    const calendar = priceCalendarData?.getPriceCalendar.calendar;
    if (!calendar || calendar.length === 0) {
      return;
    }
    if (calendar[0]?.date.slice(0, 7) !== calendarMonth) {
      return;
    }

    setCalendarByMonth((previous) => ({
      ...previous,
      [calendarMonth]: calendar,
    }));
  }, [calendarMonth, priceCalendarData]);

  useEffect(() => {
    if (!isHydrated || !roomId) {
      return;
    }

    const refreshCalendar = (): void => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const nowMs = Date.now();
      if (nowMs - lastCalendarRefetchAtRef.current < 1000) {
        return;
      }
      lastCalendarRefetchAtRef.current = nowMs;

      void refetchPriceCalendar({
        input: {
          roomId,
          month: calendarMonth,
        },
      });
    };

    window.addEventListener("focus", refreshCalendar);
    document.addEventListener("visibilitychange", refreshCalendar);
    return () => {
      window.removeEventListener("focus", refreshCalendar);
      document.removeEventListener("visibilitychange", refreshCalendar);
    };
  }, [calendarMonth, isHydrated, refetchPriceCalendar, roomId]);

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, DayPriceDto>();
    Object.values(calendarByMonth)
      .flat()
      .forEach((day) => {
        map.set(day.date, day);
      });
    return map;
  }, [calendarByMonth]);

  const visibleWindowCalendar = useMemo(() => calendarByMonth[calendarMonth] ?? [], [calendarByMonth, calendarMonth]);
  const hoveredDay = useMemo(() => (hoveredDateKey ? availabilityByDate.get(hoveredDateKey) : undefined), [availabilityByDate, hoveredDateKey]);

  useEffect(() => {
    if (!checkInDate) {
      return;
    }

    const checkInDay = availabilityByDate.get(checkInDate);
    if (checkInDay && !isCalendarDayBookable(checkInDay)) {
      setCheckInDate("");
      setCheckOutDate("");
      return;
    }

    if (
      checkOutDate &&
      hasStayDatesLoaded(checkInDate, checkOutDate, availabilityByDate) &&
      !isStayRangeAvailable(checkInDate, checkOutDate, availabilityByDate)
    ) {
      setCheckOutDate("");
    }
  }, [availabilityByDate, checkInDate, checkOutDate]);

  const selectedStayMinAvailable = useMemo(() => {
    if (!checkInDate || !checkOutDate) {
      return null;
    }

    const stayDates = buildStayDates(checkInDate, checkOutDate);
    if (stayDates.length === 0) {
      return null;
    }

    let minAvailable: number | null = null;
    for (const date of stayDates) {
      const day = availabilityByDate.get(date);
      if (!day) {
        return null;
      }
      const available = isCalendarDayBookable(day) ? (day.availableRooms ?? 0) : 0;
      minAvailable = minAvailable === null ? available : Math.min(minAvailable, available);
    }

    return minAvailable;
  }, [availabilityByDate, checkInDate, checkOutDate]);

  useEffect(() => {
    if (!room) {
      return;
    }

    const maxByInventory = selectedStayMinAvailable ?? room.totalRooms;
    const cappedQuantity = Math.max(1, Math.min(roomQuantity, Math.max(1, maxByInventory)));
    if (cappedQuantity !== roomQuantity) {
      setRoomQuantity(cappedQuantity);
    }
  }, [room, roomQuantity, selectedStayMinAvailable]);

  const bookingValidationMessage = useMemo(() => {
    if (!room) {
      return "Room is not ready.";
    }
    if (room.roomStatus !== "AVAILABLE") {
      return `Room is currently ${room.roomStatus.toLowerCase()} and cannot be booked.`;
    }
    if (roomQuantity < 1) {
      return "Room quantity must be at least 1.";
    }
    if (adultCount > room.maxOccupancy * roomQuantity) {
      return `Adults exceed room capacity (${room.maxOccupancy} x ${roomQuantity} room(s)).`;
    }
    if (childCount < 0) {
      return "Child count cannot be negative.";
    }
    if (adultCount + childCount > room.maxOccupancy * roomQuantity) {
      return `Total guests exceed room capacity (${room.maxOccupancy} x ${roomQuantity} room(s)).`;
    }
    if (!checkInDate || !checkOutDate) {
      return "Choose check-in and check-out dates.";
    }
    if (checkOutDate <= checkInDate) {
      return "Check-out must be after check-in.";
    }
    if (!hasStayDatesLoaded(checkInDate, checkOutDate, availabilityByDate)) {
      return "Checking selected dates availability...";
    }
    if (!isStayRangeAvailable(checkInDate, checkOutDate, availabilityByDate)) {
      return "One or more selected nights are unavailable.";
    }
    if (selectedStayMinAvailable !== null && roomQuantity > selectedStayMinAvailable) {
      return `Only ${selectedStayMinAvailable} room(s) available for at least one selected night.`;
    }
    if (adultCount < 1) {
      return "Adult count must be at least 1.";
    }
    return null;
  }, [adultCount, availabilityByDate, checkInDate, checkOutDate, childCount, room, roomQuantity, selectedStayMinAvailable]);

  const canContinueBooking = bookingValidationMessage === null && Boolean(roomHotelId) && Boolean(room);
  const cheapestDateKey = useMemo(() => {
    const availableDays = visibleWindowCalendar.filter((day) => isCalendarDayBookable(day));
    if (availableDays.length === 0) {
      return "";
    }
    return availableDays.reduce((lowest, current) => (current.price < lowest.price ? current : lowest)).date;
  }, [visibleWindowCalendar]);

  const peakDateKey = useMemo(() => {
    const availableDays = visibleWindowCalendar.filter((day) => isCalendarDayBookable(day));
    if (availableDays.length === 0) {
      return "";
    }
    return availableDays.reduce((highest, current) => (current.price > highest.price ? current : highest)).date;
  }, [visibleWindowCalendar]);

  const averageVisiblePrice = useMemo(() => {
    const availableDays = visibleWindowCalendar.filter((day) => isCalendarDayBookable(day));
    if (availableDays.length === 0) {
      return 0;
    }
    return Math.round(availableDays.reduce((sum, day) => sum + day.price, 0) / availableDays.length);
  }, [visibleWindowCalendar]);

  const selectedRange = useMemo<DateRange | undefined>(() => {
    if (!checkInDate) {
      return undefined;
    }
    const fromDate = toLocalDateFromDateKey(checkInDate);
    if (!fromDate) {
      return undefined;
    }
    const toDate = checkOutDate ? toLocalDateFromDateKey(checkOutDate) : null;
    return {
      from: fromDate,
      ...(toDate ? { to: toDate } : {}),
    };
  }, [checkInDate, checkOutDate]);

  const calendarMonthDate = useMemo(() => {
    const [yearPart, monthPart] = calendarMonth.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return new Date();
    }
    return new Date(year, month - 1, 1);
  }, [calendarMonth]);

  const minCalendarMonthDate = useMemo(() => {
    const [yearPart, monthPart] = todayMonth.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return new Date();
    }
    return new Date(year, month - 1, 1);
  }, [todayMonth]);

  const dayPickerClassNames = useMemo(() => {
    const defaults = getDefaultClassNames();
    return {
      ...defaults,
      root: `${defaults.root} w-full`,
      months: `${defaults.months} grid min-w-0 grid-cols-1 gap-3`,
      month: `${defaults.month} rounded-2xl border border-white/70 bg-white/80 p-2.5 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.85)] backdrop-blur`,
      month_caption: `${defaults.month_caption} mb-3`,
      caption_label: `${defaults.caption_label} text-xs font-semibold uppercase tracking-[0.12em] text-slate-700`,
      nav: `${defaults.nav} flex items-center gap-1`,
      button_previous:
        `${defaults.button_previous} inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40`,
      button_next:
        `${defaults.button_next} inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40`,
      weekdays: `${defaults.weekdays} border-b border-slate-200 pb-1`,
      weekday: `${defaults.weekday} text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500`,
      month_grid: `${defaults.month_grid} w-full border-separate border-spacing-[2px]`,
      day: `${defaults.day} p-0`,
      day_button:
        `${defaults.day_button} h-11 w-10 rounded-xl border border-slate-200 bg-white/95 text-slate-700 backdrop-blur-[4px] transition-colors duration-150 sm:h-11 sm:w-11`,
      selected: "",
      range_start: "",
      range_middle: "",
      range_end: "",
      today: "ring-2 ring-cyan-300",
      focused: "ring-2 ring-slate-500",
      disabled: "opacity-45",
      outside: "opacity-35",
      hidden: "opacity-0",
    };
  }, []);

  const dayPickerStyle = useMemo(
    () =>
      ({
        "--rdp-accent-color": "#4f46e5",
        "--rdp-range_middle-background-color": "#e2e8f0",
      }) as CSSProperties,
    [],
  );

  const dayPickerComponents = useMemo(
    () => ({
      DayButton: (props: DayButtonProps) => (
        <PriceDayButton {...props} price={availabilityByDate.get(formatDateInput(props.day.date))} onHover={setHoveredDateKey} />
      ),
    }),
    [availabilityByDate],
  );

  const disabledDays = useMemo(
    () => (date: Date): boolean => {
      const dateKey = formatDateInput(date);
      if (dateKey < todayDate) {
        return true;
      }

      if (!checkInDate || checkOutDate || dateKey <= checkInDate) {
        return !isCalendarDayBookable(availabilityByDate.get(dateKey));
      }

      return !isStayRangeAvailable(checkInDate, dateKey, availabilityByDate);
    },
    [availabilityByDate, checkInDate, checkOutDate, todayDate],
  );

  const handleSelectCalendarDate = (date: string): void => {
    if (date < todayDate) {
      return;
    }

    const day = availabilityByDate.get(date);
    const isBookableDay = isCalendarDayBookable(day);

    if (!checkInDate) {
      if (!isBookableDay) {
        return;
      }
      setCheckInDate(date);
      setCheckOutDate("");
      return;
    }

    if (checkOutDate) {
      if (!isBookableDay) {
        return;
      }
      setCheckInDate(date);
      setCheckOutDate("");
      return;
    }

    if (date <= checkInDate) {
      if (!isBookableDay) {
        return;
      }
      setCheckInDate(date);
      setCheckOutDate("");
      return;
    }

    if (!isStayRangeAvailable(checkInDate, date, availabilityByDate)) {
      return;
    }

    setCheckOutDate(date);
  };

  const onCalendarDayClick = (date: Date | undefined): void => {
    if (!date) {
      return;
    }
    handleSelectCalendarDate(formatDateInput(date));
  };

  const onAdultCountChange = (rawValue: string): void => {
    const parsed = Number(rawValue.replace(/\D/g, ""));
    const normalized = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    const maxAdults = room ? Math.max(1, room.maxOccupancy * roomQuantity) : normalized;
    const clamped = Math.min(normalized, maxAdults);
    setAdultCount(clamped);
  };

  const onChildCountChange = (rawValue: string): void => {
    const parsed = Number(rawValue.replace(/\D/g, ""));
    const normalized = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
    const maxChildren = room ? Math.max(0, room.maxOccupancy * roomQuantity - adultCount) : normalized;
    const clamped = Math.min(normalized, maxChildren);
    setChildCount(clamped);
  };

  const onRoomQuantityChange = (rawValue: string): void => {
    const parsed = Number(rawValue.replace(/\D/g, ""));
    const normalized = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    const maxByInventory = selectedStayMinAvailable ?? room?.totalRooms ?? normalized;
    const clampedQuantity = Math.min(normalized, Math.max(1, maxByInventory));
    setRoomQuantity(clampedQuantity);

    if (room) {
      const maxTotalGuests = room.maxOccupancy * clampedQuantity;
      const nextAdultCount = Math.min(adultCount, Math.max(1, maxTotalGuests));
      if (nextAdultCount !== adultCount) {
        setAdultCount(nextAdultCount);
      }
      if (nextAdultCount + childCount > maxTotalGuests) {
        setChildCount(Math.max(0, maxTotalGuests - nextAdultCount));
      }
    }
  };

  const onCalendarMonthChange = (month: Date): void => {
    setCalendarMonth(toMonthKey(month));
  };

  return {
    checkInDate,
    checkOutDate,
    adultCount,
    childCount,
    roomQuantity,
    hoveredDateKey,
    hoveredDay,
    availabilityByDate,
    visibleWindowCalendar,
    selectedStayMinAvailable,
    bookingValidationMessage,
    canContinueBooking,
    cheapestDateKey,
    peakDateKey,
    averageVisiblePrice,
    selectedRange,
    calendarMonthDate,
    minCalendarMonthDate,
    dayPickerClassNames,
    dayPickerStyle,
    dayPickerComponents,
    disabledDays,
    onAdultCountChange,
    onChildCountChange,
    onRoomQuantityChange,
    onCalendarMonthChange,
    onCalendarDayClick,
  };
};
