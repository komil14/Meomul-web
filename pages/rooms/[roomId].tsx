import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { DayButton as DefaultDayButton, DayPicker, getDefaultClassNames, type DateRange, type DayButtonProps } from "react-day-picker";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_HOTEL_CONTEXT_QUERY, GET_PRICE_CALENDAR_QUERY, GET_ROOM_QUERY } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  DayPriceDto,
  GetHotelContextQueryData,
  GetHotelContextQueryVars,
  GetPriceCalendarQueryData,
  GetPriceCalendarQueryVars,
  GetRoomQueryData,
  GetRoomQueryVars,
} from "@/types/hotel";

const formatDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (dateInput: string, days: number): string => {
  const base = new Date(`${dateInput}T00:00:00`);
  base.setDate(base.getDate() + days);
  return formatDateInput(base);
};

const formatMonthLabel = (monthKey: string): string => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = monthNames[month - 1] ?? String(month);
  return `${monthLabel} ${year}`;
};

const buildStayDates = (checkInDate: string, checkOutDate: string): string[] => {
  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
    return [];
  }

  const dates: string[] = [];
  let cursor = checkInDate;
  while (cursor < checkOutDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const isCalendarDayBookable = (day: DayPriceDto | undefined): boolean => {
  if (!day) {
    return false;
  }
  if (day.localEvent === "Closed") {
    return false;
  }
  return (day.availableRooms ?? 0) > 0;
};

const isStayRangeAvailable = (checkInDate: string, checkOutDate: string, availabilityByDate: Map<string, DayPriceDto>): boolean => {
  const stayDates = buildStayDates(checkInDate, checkOutDate);
  if (stayDates.length === 0) {
    return false;
  }
  return stayDates.every((date) => isCalendarDayBookable(availabilityByDate.get(date)));
};

const buildBookingHref = (hotelId: string, roomId: string, checkInDate: string, checkOutDate: string, adults: number) => {
  const query: Record<string, string> = {
    hotelId,
    roomId,
    adultCount: String(adults),
  };

  if (checkInDate) {
    query.checkInDate = checkInDate;
  }
  if (checkOutDate) {
    query.checkOutDate = checkOutDate;
  }

  return {
    pathname: "/bookings/new",
    query,
  };
};

const toMonthKey = (value: Date): string => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const formatIsoDate = (value: string): string => {
  if (!value) {
    return "-";
  }
  return value.slice(0, 10);
};

const addMonthsToMonthKey = (monthKey: string, monthsToAdd: number): string => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }
  const next = new Date(year, month - 1 + monthsToAdd, 1);
  return toMonthKey(next);
};

const formatCompactKrw = (price: number): string => {
  if (!Number.isFinite(price)) {
    return "-";
  }
  if (price >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (price >= 1_000) {
    return `${Math.round(price / 1_000)}k`;
  }
  return `${Math.round(price)}`;
};

const PriceDayButton = ({
  day,
  modifiers,
  price,
  onHover,
  ...buttonProps
}: DayButtonProps & {
  price?: DayPriceDto;
  onHover?: (dateKey: string | null) => void;
}) => {
  const dateKey = formatDateInput(day.date);
  const isUnavailable = Boolean(price) && !isCalendarDayBookable(price);
  const priceLabel = !price ? "n/a" : isUnavailable ? "sold" : `₩${formatCompactKrw(price.price)}`;

  return (
    <DefaultDayButton
      {...buttonProps}
      day={day}
      modifiers={modifiers}
      onMouseEnter={(event) => {
        buttonProps.onMouseEnter?.(event);
        onHover?.(dateKey);
      }}
      onMouseLeave={(event) => {
        buttonProps.onMouseLeave?.(event);
        onHover?.(null);
      }}
      onFocus={(event) => {
        buttonProps.onFocus?.(event);
        onHover?.(dateKey);
      }}
      onBlur={(event) => {
        buttonProps.onBlur?.(event);
        onHover?.(null);
      }}
    >
      <span className="price-day-number">{day.date.getDate()}</span>
      <span className={`price-day-meta ${isUnavailable ? "is-unavailable" : ""}`}>{priceLabel}</span>
    </DefaultDayButton>
  );
};

export default function RoomDetailPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adultCount, setAdultCount] = useState(2);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const todayDate = useMemo(() => formatDateInput(new Date()), []);
  const todayMonth = useMemo(() => todayDate.slice(0, 7), [todayDate]);
  const [calendarMonth, setCalendarMonth] = useState(todayMonth);
  const [calendarByMonth, setCalendarByMonth] = useState<Record<string, DayPriceDto[]>>({});
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const nextCalendarMonth = useMemo(() => addMonthsToMonthKey(calendarMonth, 1), [calendarMonth]);

  const roomId = useMemo(() => {
    if (typeof router.query.roomId === "string") {
      return router.query.roomId;
    }
    return "";
  }, [router.query.roomId]);

  const {
    data: roomData,
    loading: roomLoading,
    error: roomError,
  } = useQuery<GetRoomQueryData, GetRoomQueryVars>(GET_ROOM_QUERY, {
    skip: !isHydrated || !roomId,
    variables: { roomId },
    fetchPolicy: "cache-and-network",
  });

  const room = roomData?.getRoom;
  const roomHotelId = room?.hotelId ?? "";

  const {
    data: priceCalendarData,
    loading: priceCalendarLoading,
    error: priceCalendarError,
  } = useQuery<GetPriceCalendarQueryData, GetPriceCalendarQueryVars>(GET_PRICE_CALENDAR_QUERY, {
    skip: !isHydrated || !roomId,
    variables: {
      input: {
        roomId,
        month: calendarMonth,
      },
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });
  const {
    data: nextPriceCalendarData,
    loading: nextPriceCalendarLoading,
    error: nextPriceCalendarError,
  } = useQuery<GetPriceCalendarQueryData, GetPriceCalendarQueryVars>(GET_PRICE_CALENDAR_QUERY, {
    skip: !isHydrated || !roomId,
    variables: {
      input: {
        roomId,
        month: nextCalendarMonth,
      },
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const { data: hotelData, error: hotelError } = useQuery<GetHotelContextQueryData, GetHotelContextQueryVars>(GET_HOTEL_CONTEXT_QUERY, {
    skip: !isHydrated || !roomHotelId,
    variables: {
      hotelId: roomHotelId,
    },
    fetchPolicy: "cache-first",
  });

  const hotel = hotelData?.getHotel;
  const coverImage = room?.roomImages[0] ?? "";
  const galleryImages = room?.roomImages.slice(1) ?? [];
  const deal = room?.lastMinuteDeal;

  useEffect(() => {
    if (!roomId) {
      return;
    }

    setCalendarByMonth({});
    setCalendarMonth(todayMonth);
    setCheckInDate("");
    setCheckOutDate("");
    setHoveredDateKey(null);
  }, [roomId, todayMonth]);

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
    const calendar = nextPriceCalendarData?.getPriceCalendar.calendar;
    if (!calendar || calendar.length === 0) {
      return;
    }
    if (calendar[0]?.date.slice(0, 7) !== nextCalendarMonth) {
      return;
    }

    setCalendarByMonth((previous) => ({
      ...previous,
      [nextCalendarMonth]: calendar,
    }));
  }, [nextCalendarMonth, nextPriceCalendarData]);

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, DayPriceDto>();
    Object.values(calendarByMonth)
      .flat()
      .forEach((day) => {
        map.set(day.date, day);
      });
    return map;
  }, [calendarByMonth]);

  const visibleWindowCalendar = useMemo(
    () => [...(calendarByMonth[calendarMonth] ?? []), ...(calendarByMonth[nextCalendarMonth] ?? [])],
    [calendarByMonth, calendarMonth, nextCalendarMonth],
  );

  const hasCalendarAvailability = availabilityByDate.size > 0;
  const calendarMonthLabel = useMemo(
    () => `${formatMonthLabel(calendarMonth)} · ${formatMonthLabel(nextCalendarMonth)}`,
    [calendarMonth, nextCalendarMonth],
  );
  const hoveredDay = useMemo(() => (hoveredDateKey ? availabilityByDate.get(hoveredDateKey) : undefined), [availabilityByDate, hoveredDateKey]);

  useEffect(() => {
    if (!checkInDate) {
      return;
    }

    const checkInDay = availabilityByDate.get(checkInDate);
    if (hasCalendarAvailability && (!checkInDay || !isCalendarDayBookable(checkInDay))) {
      setCheckInDate("");
      setCheckOutDate("");
      return;
    }

    if (checkOutDate && hasCalendarAvailability && !isStayRangeAvailable(checkInDate, checkOutDate, availabilityByDate)) {
      setCheckOutDate("");
    }
  }, [availabilityByDate, checkInDate, checkOutDate, hasCalendarAvailability]);

  const bookingValidationMessage = useMemo(() => {
    if (!room) {
      return "Room is not ready.";
    }
    if (room.roomStatus !== "AVAILABLE") {
      return `Room is currently ${room.roomStatus.toLowerCase()} and cannot be booked.`;
    }
    if (room.availableRooms <= 0) {
      return "This room is currently sold out.";
    }
    if (adultCount > room.maxOccupancy) {
      return `This room accepts up to ${room.maxOccupancy} adult(s).`;
    }
    if (!checkInDate || !checkOutDate) {
      return "Choose check-in and check-out dates.";
    }
    if (checkOutDate <= checkInDate) {
      return "Check-out must be after check-in.";
    }
    if (hasCalendarAvailability && !isStayRangeAvailable(checkInDate, checkOutDate, availabilityByDate)) {
      return "One or more selected nights are unavailable.";
    }
    if (adultCount < 1) {
      return "Adult count must be at least 1.";
    }
    return null;
  }, [adultCount, availabilityByDate, checkInDate, checkOutDate, hasCalendarAvailability, room]);

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
    return {
      from: new Date(`${checkInDate}T00:00:00`),
      ...(checkOutDate ? { to: new Date(`${checkOutDate}T00:00:00`) } : {}),
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

  const availabilityPulse = useMemo(() => {
    const maxAvailable = Math.max(...visibleWindowCalendar.map((day) => day.availableRooms ?? 0), 1);
    return visibleWindowCalendar.map((day) => {
      const available = day.availableRooms ?? 0;
      const ratio = Math.max(0.08, available / maxAvailable);
      const status =
        day.localEvent === "Closed" || available <= 0 ? "blocked" : day.demandLevel === "HIGH" ? "hot" : day.demandLevel === "MEDIUM" ? "warm" : "open";

      return {
        date: day.date,
        day: Number(day.date.slice(8, 10)),
        ratio,
        status,
      };
    });
  }, [visibleWindowCalendar]);

  const dayPickerClassNames = useMemo(() => {
    const defaults = getDefaultClassNames();
    return {
      ...defaults,
      root: `${defaults.root} w-full`,
      months: `${defaults.months} grid min-w-[44rem] grid-cols-2 gap-4`,
      month: `${defaults.month} rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.85)] backdrop-blur`,
      month_caption: `${defaults.month_caption} mb-3`,
      caption_label: `${defaults.caption_label} text-sm font-semibold uppercase tracking-[0.12em] text-slate-700`,
      nav: `${defaults.nav} gap-2`,
      button_previous: `${defaults.button_previous} h-8 w-8 rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-500`,
      button_next: `${defaults.button_next} h-8 w-8 rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-500`,
      weekdays: `${defaults.weekdays} border-b border-slate-200 pb-1`,
      weekday: `${defaults.weekday} text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500`,
      month_grid: `${defaults.month_grid} w-full border-separate border-spacing-1`,
      day: `${defaults.day} p-0`,
      day_button:
        `${defaults.day_button} price-day-button h-12 w-12 rounded-2xl border border-slate-200 bg-white/95 text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-lg`,
      selected: "border-sky-900 bg-sky-900 text-white shadow-[0_0_0_1px_rgba(3,105,161,0.45)]",
      range_start: "border-sky-900 bg-sky-900 text-white",
      range_middle: "border-sky-200 bg-sky-100 text-sky-900",
      range_end: "border-sky-900 bg-sky-900 text-white",
      today: "ring-2 ring-cyan-300",
      focused: "ring-2 ring-sky-400",
      disabled: "opacity-45",
      outside: "opacity-35",
      hidden: "opacity-0",
    };
  }, []);
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

  const handleSelectCalendarDay = (date: Date | undefined): void => {
    if (!date) {
      return;
    }
    handleSelectCalendarDate(formatDateInput(date));
  };
  const calendarLoadInProgress = priceCalendarLoading || nextPriceCalendarLoading;
  const calendarLoadError = priceCalendarError ?? nextPriceCalendarError;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
          Back to hotels
        </Link>
        {roomHotelId ? (
          <Link href={`/hotels/${roomHotelId}`} className="text-sm text-slate-600 underline underline-offset-4">
            Back to hotel detail
          </Link>
        ) : null}
      </div>

      {roomError ? <ErrorNotice message={getErrorMessage(roomError)} /> : null}
      {hotelError ? <ErrorNotice message={getErrorMessage(hotelError)} /> : null}

      {!isHydrated || roomLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">Loading room...</section>
      ) : null}

      {isHydrated && !roomLoading && !room ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">Room not found.</section>
      ) : null}

      {room ? (
        <>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div
              className="h-72 w-full bg-slate-200 bg-cover bg-center"
              style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
            >
              {!coverImage ? (
                <div className="flex h-full items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">No room image</div>
              ) : null}
            </div>
            {galleryImages.length > 0 ? (
              <div className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-4">
                {galleryImages.map((image) => (
                  <div
                    key={image}
                    className="h-20 rounded-lg bg-slate-200 bg-cover bg-center"
                    style={{ backgroundImage: `url(${image})` }}
                    aria-hidden
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {room.roomType} {room.roomNumber ? `· #${room.roomNumber}` : ""}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">{room.roomName}</h1>
                {hotel ? <p className="mt-1 text-sm text-slate-600">{hotel.hotelTitle}</p> : null}
              </div>
              <div className="text-right">
                {deal?.isActive ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Last minute deal</p>
                    <p className="text-2xl font-semibold text-slate-900">₩ {deal.dealPrice.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 line-through">₩ {deal.originalPrice.toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Base rate</p>
                    <p className="text-2xl font-semibold text-slate-900">₩ {room.basePrice.toLocaleString()}</p>
                  </>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700">{room.roomDesc || "No room description provided."}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Status: <span className="font-semibold text-slate-900">{room.roomStatus}</span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Max occupancy: <span className="font-semibold text-slate-900">{room.maxOccupancy}</span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Bed:{" "}
                <span className="font-semibold text-slate-900">
                  {room.bedCount} x {room.bedType}
                </span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                View: <span className="font-semibold text-slate-900">{room.viewType}</span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Room size: <span className="font-semibold text-slate-900">{room.roomSize} m²</span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Inventory:{" "}
                <span className="font-semibold text-slate-900">
                  {room.availableRooms}/{room.totalRooms} available
                </span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Weekend surcharge: <span className="font-semibold text-slate-900">₩ {room.weekendSurcharge.toLocaleString()}</span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Current viewers: <span className="font-semibold text-slate-900">{room.currentViewers}</span>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Updated: <span className="font-semibold text-slate-900">{formatIsoDate(room.updatedAt)}</span>
              </article>
            </div>

            {room.roomAmenities.length > 0 ? (
              <div className="mt-5 space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Room amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {room.roomAmenities.map((amenity) => (
                    <span key={amenity} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-in</span>
                  <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                    {checkInDate || "Select date"}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-out</span>
                  <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                    {checkOutDate || "Select date"}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Adults</span>
                <input
                  value={String(adultCount)}
                  onChange={(event) => {
                    const parsed = Number(event.target.value.replace(/\D/g, ""));
                    const normalized = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
                    const clamped = room ? Math.min(normalized, Math.max(1, room.maxOccupancy)) : normalized;
                    setAdultCount(clamped);
                  }}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                />
              </label>

              <div className="calendar-shell rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">{calendarMonthLabel}</p>
                  <p className="text-[11px] text-slate-500">2-month cinematic price board</p>
                </div>
                <div className="sticky top-2 z-20 mb-3 flex flex-wrap gap-1.5 rounded-lg border border-slate-200/90 bg-white/90 p-2 text-[10px] text-slate-600 backdrop-blur">
                  <span className="rounded-full border border-cyan-300/80 bg-cyan-50 px-2 py-0.5 text-cyan-900">Best price</span>
                  <span className="rounded-full border border-sky-300/80 bg-sky-50 px-2 py-0.5 text-sky-900">Peak price</span>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5">Sold out</span>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5">Date + price in each cell</span>
                  {hoveredDateKey && hoveredDay ? (
                    <span className="rounded-full border border-sky-400 bg-sky-50 px-2 py-0.5 font-semibold text-sky-900">
                      {hoveredDateKey} · ₩ {hoveredDay.price.toLocaleString()}
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5">Hover a date to preview exact rate</span>
                  )}
                </div>
                {availabilityPulse.length > 0 ? (
                  <div className="mb-3 rounded-lg border border-slate-200 bg-white/80 p-2">
                    <div className="flex items-end gap-[3px] overflow-x-auto pb-1">
                      {availabilityPulse.map((entry) => {
                        const statusClassName =
                          entry.status === "blocked"
                            ? "bg-slate-300"
                            : entry.status === "hot"
                              ? "bg-sky-600"
                              : entry.status === "warm"
                                ? "bg-sky-400"
                                : "bg-cyan-400";
                        const isDisabled = entry.status === "blocked";
                        return (
                          <button
                            key={entry.date}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleSelectCalendarDate(entry.date)}
                            className="pulse-day inline-flex min-w-5 flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-45"
                            title={entry.date}
                          >
                            <span
                              className={`w-3 rounded-full transition-all duration-300 ${statusClassName}`}
                              style={{ height: `${Math.round(12 + entry.ratio * 24)}px` }}
                            />
                            <span className="text-[9px] font-semibold text-slate-500">{entry.day}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                        Open
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-400" />
                        Medium demand
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-600" />
                        High demand
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                        Unavailable
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="overflow-x-auto pb-1">
                  <DayPicker
                    animate
                    mode="range"
                    selected={selectedRange}
                    month={calendarMonthDate}
                    numberOfMonths={2}
                    pagedNavigation
                    onMonthChange={(month) => setCalendarMonth(toMonthKey(month))}
                    onDayClick={handleSelectCalendarDay}
                    disabled={disabledDays}
                    modifiers={{
                      cheap: (date) => formatDateInput(date) === cheapestDateKey,
                      peak: (date) => formatDateInput(date) === peakDateKey,
                    }}
                    modifiersClassNames={{
                      cheap: "rdp-day-cheap",
                      peak: "rdp-day-peak",
                    }}
                    components={dayPickerComponents}
                    classNames={dayPickerClassNames}
                    showOutsideDays
                  />
                </div>
                {calendarLoadInProgress && visibleWindowCalendar.length === 0 ? (
                  <p className="mt-2 text-[11px] text-slate-500">Loading availability...</p>
                ) : null}
                {calendarLoadError && visibleWindowCalendar.length === 0 ? (
                  <p className="mt-2 text-[11px] text-amber-700">{getErrorMessage(calendarLoadError)}</p>
                ) : null}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-900" />
                    Selected
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    In range
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-200" />
                    Disabled unavailable
                  </span>
                </div>
              </div>

              {visibleWindowCalendar.length > 0 ? (
                <div className="grid gap-2 text-xs text-slate-700">
                  <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                    Average (2 months): <span className="font-semibold">₩ {averageVisiblePrice.toLocaleString()}</span>
                  </p>
                  {cheapestDateKey ? (
                    <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      Cheapest:{" "}
                      <span className="font-semibold">
                        {cheapestDateKey} · ₩ {availabilityByDate.get(cheapestDateKey)?.price.toLocaleString()}
                      </span>
                    </p>
                  ) : null}
                  {peakDateKey ? (
                    <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      Peak:{" "}
                      <span className="font-semibold">
                        {peakDateKey} · ₩ {availabilityByDate.get(peakDateKey)?.price.toLocaleString()}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {bookingValidationMessage ? <p className="text-xs font-medium text-amber-700">{bookingValidationMessage}</p> : null}

              {canContinueBooking && roomHotelId ? (
                <Link
                  href={buildBookingHref(roomHotelId, room._id, checkInDate, checkOutDate, adultCount)}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Continue to booking
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex w-full items-center justify-center rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Complete booking details
                </button>
              )}
            </div>

            {roomHotelId ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href={`/hotels/${roomHotelId}`}
                  className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                >
                  Open hotel detail
                </Link>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
