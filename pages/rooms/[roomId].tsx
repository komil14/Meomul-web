import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DayButton as DefaultDayButton, getDefaultClassNames, type DateRange, type DayButtonProps } from "react-day-picker";
import type { DetailIconName } from "@/components/rooms/detail/detail-icon";
import { PriceLockReadyBar } from "@/components/rooms/detail/price-lock-ready-bar";
import { RoomBookingSidebar } from "@/components/rooms/detail/room-booking-sidebar";
import { RoomHeroSection, type RoomHeroHighlight } from "@/components/rooms/detail/room-hero-section";
import { RoomOverviewSection, type RoomAmenityCard, type RoomFactCard } from "@/components/rooms/detail/room-overview-section";
import { LiveInterestFab } from "@/components/rooms/live-interest-fab";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  GET_HOTEL_CONTEXT_QUERY,
  GET_MY_PRICE_LOCK_QUERY,
  GET_MY_PRICE_LOCKS_QUERY,
  GET_PRICE_CALENDAR_QUERY,
  GET_ROOM_QUERY,
  LOCK_PRICE_MUTATION,
} from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { useRoomLiveViewers } from "@/lib/hooks/use-room-live-viewers";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  DayPriceDto,
  GetHotelContextQueryData,
  GetHotelContextQueryVars,
  GetMyPriceLockQueryData,
  GetMyPriceLockQueryVars,
  GetPriceCalendarQueryData,
  GetPriceCalendarQueryVars,
  GetRoomQueryData,
  GetRoomQueryVars,
  LockPriceMutationData,
  LockPriceMutationVars,
} from "@/types/hotel";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateKeyParts = (value: string): { year: number; month: number; day: number } | null => {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }

  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) {
    return null;
  }

  return { year, month, day };
};

const formatDateKeyUtc = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toLocalDateFromDateKey = (dateKey: string): Date | null => {
  const parts = parseDateKeyParts(dateKey);
  if (!parts) {
    return null;
  }

  return new Date(parts.year, parts.month - 1, parts.day);
};

const addDays = (dateInput: string, days: number): string => {
  const parts = parseDateKeyParts(dateInput);
  if (!parts) {
    return dateInput;
  }

  const baseUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
  baseUtc.setUTCDate(baseUtc.getUTCDate() + days);
  return formatDateKeyUtc(baseUtc);
};

const canUsePriceActions = (memberType: string | undefined): boolean =>
  memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";

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

const hasStayDatesLoaded = (checkInDate: string, checkOutDate: string, availabilityByDate: Map<string, DayPriceDto>): boolean => {
  const stayDates = buildStayDates(checkInDate, checkOutDate);
  if (stayDates.length === 0) {
    return false;
  }
  return stayDates.every((date) => availabilityByDate.has(date));
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
const formatEnumLabel = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
const formatAmenityLabel = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
const resolveAmenityIcon = (amenity: string): DetailIconName => {
  const value = amenity.toLowerCase();
  if (value.includes("wifi") || value.includes("internet")) return "wifi";
  if (value.includes("restaurant") || value.includes("breakfast") || value.includes("kitchen") || value.includes("coffee")) return "food";
  if (value.includes("service") || value.includes("clean") || value.includes("laundry") || value.includes("room")) return "service";
  if (value.includes("access") || value.includes("wheelchair") || value.includes("elevator") || value.includes("bathroom")) return "access";
  if (value.includes("parking") || value.includes("shuttle") || value.includes("charging")) return "parking";
  if (value.includes("tv") || value.includes("stream") || value.includes("spa") || value.includes("pool")) return "entertainment";
  return "default";
};
type AmenityTone = "sky" | "emerald" | "amber" | "violet" | "rose" | "slate";
const resolveAmenityTone = (icon: DetailIconName): AmenityTone => {
  if (icon === "wifi" || icon === "access") return "sky";
  if (icon === "service" || icon === "default") return "emerald";
  if (icon === "food" || icon === "surcharge") return "amber";
  if (icon === "entertainment" || icon === "view") return "violet";
  if (icon === "clock" || icon === "eyes") return "rose";
  return "slate";
};
const amenityToneStyles: Record<AmenityTone, { card: string; icon: string; badge: string }> = {
  sky: {
    card: "border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-50",
    icon: "border-sky-200 bg-white text-sky-700",
    badge: "border-sky-300 bg-white text-sky-700",
  },
  emerald: {
    card: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-lime-50",
    icon: "border-emerald-200 bg-white text-emerald-700",
    badge: "border-emerald-300 bg-white text-emerald-700",
  },
  amber: {
    card: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50",
    icon: "border-amber-200 bg-white text-amber-700",
    badge: "border-amber-300 bg-white text-amber-700",
  },
  violet: {
    card: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-fuchsia-50",
    icon: "border-violet-200 bg-white text-violet-700",
    badge: "border-violet-300 bg-white text-violet-700",
  },
  rose: {
    card: "border-rose-200/80 bg-gradient-to-br from-rose-50 to-pink-50",
    icon: "border-rose-200 bg-white text-rose-700",
    badge: "border-rose-300 bg-white text-rose-700",
  },
  slate: {
    card: "border-slate-200/80 bg-gradient-to-br from-slate-50 to-white",
    icon: "border-slate-200 bg-white text-slate-700",
    badge: "border-slate-300 bg-white text-slate-700",
  },
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
  const isSelected = Boolean(modifiers.selected);
  const isRangeStart = Boolean(modifiers.range_start);
  const isRangeEnd = Boolean(modifiers.range_end);
  const isRangeMiddle = Boolean(modifiers.range_middle);
  const isDisabled = Boolean(modifiers.disabled);
  const isSingleSelected = isSelected && !isRangeStart && !isRangeEnd && !isRangeMiddle;
  const isEdgeSelected = isSingleSelected || isRangeStart || isRangeEnd;
  const isMiddleSelected = isRangeMiddle && !isEdgeSelected;
  const isInSelectedRange = isEdgeSelected || isMiddleSelected;
  const isBookable = !isUnavailable && !isDisabled;

  return (
    <DefaultDayButton
      {...buttonProps}
      day={day}
      modifiers={modifiers}
      className={[
        buttonProps.className,
        "group inline-flex flex-col items-center justify-center gap-0 overflow-hidden",
        isEdgeSelected ? "!border-indigo-600 !bg-indigo-600 !text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]" : "",
        isMiddleSelected ? "!border-slate-300 !bg-slate-200 !text-slate-900" : "",
        !isInSelectedRange && isUnavailable ? "border-slate-200 bg-slate-100 text-slate-400" : "",
        !isInSelectedRange && isBookable ? "hover:border-slate-500 hover:bg-slate-50 hover:shadow-sm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
      <span
        className={`block text-[11px] leading-none font-bold transition ${
          isEdgeSelected ? "text-white drop-shadow-sm" : isMiddleSelected ? "text-slate-900" : "text-slate-700"
        }`}
      >
        {day.date.getDate()}
      </span>
      <span
        className={[
          "inline-flex min-w-7 items-center justify-center rounded-full px-1 py-[1px] text-[8px] leading-none font-bold transition",
          isUnavailable ? "bg-slate-300/70 text-slate-500" : "",
          !isUnavailable && isEdgeSelected ? "border border-indigo-200/60 bg-indigo-400/35 text-white" : "",
          !isUnavailable && isMiddleSelected ? "border border-slate-400 bg-slate-300 text-slate-800" : "",
          !isUnavailable && !isInSelectedRange ? "bg-slate-900/10 text-slate-600" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {priceLabel}
      </span>
    </DefaultDayButton>
  );
};

export default function RoomDetailPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adultCount, setAdultCount] = useState(2);
  const [lockActionError, setLockActionError] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
    setMember(getSessionMember());
  }, []);

  const todayDate = useMemo(() => formatDateInput(new Date()), []);
  const todayMonth = useMemo(() => todayDate.slice(0, 7), [todayDate]);
  const [calendarMonth, setCalendarMonth] = useState(todayMonth);
  const [calendarByMonth, setCalendarByMonth] = useState<Record<string, DayPriceDto[]>>({});
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const lastCalendarRefetchAtRef = useRef(0);

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
  const memberType = member?.memberType;
  const canLockPrice = canUsePriceActions(memberType);

  const {
    data: priceCalendarData,
    loading: priceCalendarLoading,
    error: priceCalendarError,
    refetch: refetchPriceCalendar,
  } = useQuery<GetPriceCalendarQueryData, GetPriceCalendarQueryVars>(GET_PRICE_CALENDAR_QUERY, {
    skip: !isHydrated || !roomId,
    variables: {
      input: {
        roomId,
        month: calendarMonth,
      },
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: myPriceLockData,
    loading: myPriceLockLoading,
    error: myPriceLockError,
  } = useQuery<GetMyPriceLockQueryData, GetMyPriceLockQueryVars>(GET_MY_PRICE_LOCK_QUERY, {
    skip: !isHydrated || !roomId || !canLockPrice,
    variables: {
      roomId,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });
  const [lockPriceMutation, { loading: lockingPrice }] = useMutation<LockPriceMutationData, LockPriceMutationVars>(LOCK_PRICE_MUTATION);

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
  const { viewerCount: liveViewerCount, connected: isLiveViewConnected } = useRoomLiveViewers({ roomId });

  useEffect(() => {
    if (!roomId) {
      return;
    }

    setCalendarByMonth({});
    setCalendarMonth(todayMonth);
    setCheckInDate("");
    setCheckOutDate("");
    setHoveredDateKey(null);
    setLockActionError(null);
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

  const bookingValidationMessage = useMemo(() => {
    if (!room) {
      return "Room is not ready.";
    }
    if (room.roomStatus !== "AVAILABLE") {
      return `Room is currently ${room.roomStatus.toLowerCase()} and cannot be booked.`;
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
    if (!hasStayDatesLoaded(checkInDate, checkOutDate, availabilityByDate)) {
      return "Checking selected dates availability...";
    }
    if (!isStayRangeAvailable(checkInDate, checkOutDate, availabilityByDate)) {
      return "One or more selected nights are unavailable.";
    }
    if (adultCount < 1) {
      return "Adult count must be at least 1.";
    }
    return null;
  }, [adultCount, availabilityByDate, checkInDate, checkOutDate, room]);

  const canContinueBooking = bookingValidationMessage === null && Boolean(roomHotelId) && Boolean(room);
  const canLockCurrentRoom = Boolean(room && room.roomStatus === "AVAILABLE");
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

  const handleSelectCalendarDay = (date: Date | undefined): void => {
    if (!date) {
      return;
    }
    handleSelectCalendarDate(formatDateInput(date));
  };
  const calendarLoadInProgress = priceCalendarLoading;
  const calendarLoadError = priceCalendarError;
  const calendarLoadErrorMessage = calendarLoadError && visibleWindowCalendar.length === 0 ? getErrorMessage(calendarLoadError) : null;
  const activePriceLock = myPriceLockData?.getMyPriceLock ?? null;
  const showBottomLockBar = canLockPrice && canLockCurrentRoom && !myPriceLockLoading && !activePriceLock && !lockingPrice;
  const cheapestDatePrice = cheapestDateKey ? availabilityByDate.get(cheapestDateKey)?.price : undefined;
  const peakDatePrice = peakDateKey ? availabilityByDate.get(peakDateKey)?.price : undefined;
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
  const continueBookingHref = canContinueBooking && room
    ? buildBookingHref(roomHotelId, room._id, checkInDate, checkOutDate, adultCount)
    : undefined;

  const handleAdultCountChange = (rawValue: string): void => {
    const parsed = Number(rawValue.replace(/\D/g, ""));
    const normalized = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    const clamped = room ? Math.min(normalized, Math.max(1, room.maxOccupancy)) : normalized;
    setAdultCount(clamped);
  };

  const handleLockPrice = async (): Promise<void> => {
    if (!canLockPrice || !room) {
      return;
    }

    setLockActionError(null);
    try {
      await lockPriceMutation({
        variables: {
          input: {
            roomId: room._id,
            currentPrice: room.basePrice,
          },
        },
        refetchQueries: [
          { query: GET_MY_PRICE_LOCK_QUERY, variables: { roomId: room._id } },
          { query: GET_MY_PRICE_LOCKS_QUERY },
        ],
        awaitRefetchQueries: true,
      });
    } catch (error) {
      setLockActionError(getErrorMessage(error));
    }
  };
  const roomFactCards = useMemo<RoomFactCard[]>(
    () =>
      room
        ? [
            { label: "View Option", value: `${formatEnumLabel(room.viewType)} View`, icon: "view" },
            { label: "Status", value: formatEnumLabel(room.roomStatus), icon: "status" },
            { label: "Capacity", value: `${room.maxOccupancy} guests`, icon: "capacity" },
            { label: "Bed Setup", value: `${room.bedCount} x ${formatEnumLabel(room.bedType)}`, icon: "bed" },
            { label: "Room Size", value: `${room.roomSize} m²`, icon: "size" },
            { label: "Inventory", value: `${room.totalRooms} total · date-based`, icon: "inventory" },
            { label: "Weekend Add-on", value: `₩ ${room.weekendSurcharge.toLocaleString()}`, icon: "surcharge" },
            { label: "Updated", value: formatIsoDate(room.updatedAt), icon: "clock" },
          ]
        : [],
    [room],
  );
  const roomHeroHighlights = useMemo<RoomHeroHighlight[]>(
    () =>
      room
        ? [
            { label: "Guests", value: `${room.maxOccupancy}`, icon: "capacity" },
            { label: "Size", value: `${room.roomSize}m²`, icon: "size" },
            { label: "Beds", value: `${room.bedCount}`, icon: "bed" },
            { label: "Units", value: `${room.totalRooms}`, icon: "inventory" },
          ]
        : [],
    [room],
  );
  const roomAmenityCards = useMemo<RoomAmenityCard[]>(
    () =>
      (room?.roomAmenities ?? []).map((amenity) => {
        const icon = resolveAmenityIcon(amenity);
        const tone = resolveAmenityTone(icon);
        return {
          amenity,
          label: formatAmenityLabel(amenity),
          icon,
          styles: amenityToneStyles[tone],
        };
      }),
    [room?.roomAmenities],
  );

  return (
    <main className={showBottomLockBar ? "space-y-6 pb-28 sm:pb-32" : "space-y-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
          Back to hotels
        </Link>
      </div>

      {roomError ? <ErrorNotice message={getErrorMessage(roomError)} /> : null}
      {hotelError ? <ErrorNotice message={getErrorMessage(hotelError)} /> : null}
      {myPriceLockError ? <ErrorNotice message={getErrorMessage(myPriceLockError)} /> : null}
      {lockActionError ? <ErrorNotice message={lockActionError} /> : null}

      {!isHydrated || roomLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">Loading room...</section>
      ) : null}

      {isHydrated && !roomLoading && !room ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">Room not found.</section>
      ) : null}

      {room ? (
        <>
          <RoomHeroSection
            coverImage={coverImage}
            galleryImages={galleryImages}
            roomTypeLabel={formatEnumLabel(room.roomType)}
            viewTypeLabel={formatEnumLabel(room.viewType)}
            roomNumber={room.roomNumber}
            roomName={room.roomName}
            roomDesc={room.roomDesc}
            basePrice={room.basePrice}
            deal={deal}
            highlights={roomHeroHighlights}
          />

          <section className="relative overflow-visible rounded-[2.2rem] border border-slate-200 bg-gradient-to-b from-white via-slate-50/60 to-white p-5 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.45)] sm:p-7">
            <div className="pointer-events-none absolute -right-28 top-16 h-52 w-52 rounded-full bg-sky-100/80 blur-3xl" />
            <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
              <RoomOverviewSection
                roomTypeLine={`${formatEnumLabel(room.roomType)}${room.roomNumber ? ` · #${room.roomNumber}` : ""}`}
                roomName={room.roomName}
                hotelTitle={hotel?.hotelTitle}
                deal={deal}
                roomDesc={room.roomDesc}
                factCards={roomFactCards}
                amenityCards={roomAmenityCards}
              />
              <RoomBookingSidebar
                adultCount={adultCount}
                onAdultCountChange={handleAdultCountChange}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                hoveredDateKey={hoveredDateKey}
                hoveredDay={hoveredDay}
                isCalendarDayBookable={isCalendarDayBookable}
                calendarMonthKey={calendarMonth}
                selectedRange={selectedRange}
                calendarMonthDate={calendarMonthDate}
                minCalendarMonthDate={minCalendarMonthDate}
                onCalendarMonthChange={(month) => setCalendarMonth(toMonthKey(month))}
                onCalendarDayClick={handleSelectCalendarDay}
                disabledDays={disabledDays}
                dayPickerComponents={dayPickerComponents}
                dayPickerClassNames={dayPickerClassNames}
                dayPickerStyle={dayPickerStyle}
                calendarLoadInProgress={calendarLoadInProgress}
                calendarLoadErrorMessage={calendarLoadErrorMessage}
                visibleWindowCalendarLength={visibleWindowCalendar.length}
                averageVisiblePrice={averageVisiblePrice}
                cheapestDateKey={cheapestDateKey}
                cheapestDatePrice={cheapestDatePrice}
                peakDateKey={peakDateKey}
                peakDatePrice={peakDatePrice}
                bookingValidationMessage={bookingValidationMessage}
                canContinueBooking={canContinueBooking}
                continueBookingHref={continueBookingHref}
              />
            </div>
          </section>

          {showBottomLockBar ? <PriceLockReadyBar basePrice={room.basePrice} locking={lockingPrice} onLockPrice={() => void handleLockPrice()} /> : null}
          <LiveInterestFab
            viewerCount={liveViewerCount}
            connected={isLiveViewConnected}
            availableRooms={selectedStayMinAvailable ?? room.availableRooms}
          />
        </>
      ) : null}
    </main>
  );
}
