import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DayButton as DefaultDayButton, DayPicker, getDefaultClassNames, type DateRange, type DayButtonProps } from "react-day-picker";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  CANCEL_PRICE_LOCK_MUTATION,
  GET_HOTEL_CONTEXT_QUERY,
  GET_MY_PRICE_LOCK_QUERY,
  GET_MY_PRICE_LOCKS_QUERY,
  GET_PRICE_CALENDAR_QUERY,
  GET_ROOM_QUERY,
  GET_ROOMS_BY_HOTEL_QUERY,
  LOCK_PRICE_MUTATION,
} from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { useRoomLiveViewers } from "@/lib/hooks/use-room-live-viewers";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  CancelPriceLockMutationData,
  CancelPriceLockMutationVars,
  DayPriceDto,
  GetHotelContextQueryData,
  GetHotelContextQueryVars,
  GetMyPriceLockQueryData,
  GetMyPriceLockQueryVars,
  GetPriceCalendarQueryData,
  GetPriceCalendarQueryVars,
  GetRoomQueryData,
  GetRoomQueryVars,
  GetRoomsByHotelQueryData,
  GetRoomsByHotelQueryVars,
  LockPriceMutationData,
  LockPriceMutationVars,
  ViewType,
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

const canUsePriceActions = (memberType: string | undefined): boolean =>
  memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

const getMinutesUntil = (value: string): number => {
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 60000));
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
type DetailIconName =
  | "status"
  | "capacity"
  | "bed"
  | "view"
  | "size"
  | "inventory"
  | "surcharge"
  | "eyes"
  | "clock"
  | "wifi"
  | "food"
  | "service"
  | "access"
  | "parking"
  | "entertainment"
  | "default";
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
const DetailIcon = ({ name }: { name: DetailIconName }) => {
  if (name === "status") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="12" r="8" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (name === "capacity") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M4 18c0-2.8 2.2-5 5-5s5 2.2 5 5M14 18c0-1.9 1.5-3.5 3.5-3.5S21 16.1 21 18" />
      </svg>
    );
  }
  if (name === "bed") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M3 11h18v6H3z" />
        <path d="M3 11V8a2 2 0 012-2h4a2 2 0 012 2v3M13 11V9a2 2 0 012-2h4a2 2 0 012 2v2" />
        <path d="M3 17v3M21 17v3" />
      </svg>
    );
  }
  if (name === "view" || name === "eyes") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }
  if (name === "size") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
        <path d="M8 8l-5-5M16 8l5-5M8 16l-5 5M16 16l5 5" />
      </svg>
    );
  }
  if (name === "inventory" || name === "parking") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M3 8l2-3h14l2 3v10H3z" />
        <path d="M7 18a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM17 18a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
      </svg>
    );
  }
  if (name === "surcharge" || name === "food" || name === "service") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8M9.5 10.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 2-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2 2.5-.8 2.5-2" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    );
  }
  if (name === "wifi") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M4 10a12 12 0 0116 0M7 13a8 8 0 0110 0M10 16a4 4 0 014 0" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "access") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="6.5" r="1.8" />
        <path d="M8 10h8M12 8.5V16M12 12l4 4M12 12l-3 5" />
      </svg>
    );
  }
  if (name === "entertainment") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21h8M10 17v4M14 17v4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 8l8-5 8 5v10l-8 5-8-5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
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
  const [cancelPriceLockMutation, { loading: cancellingPriceLock }] = useMutation<
    CancelPriceLockMutationData,
    CancelPriceLockMutationVars
  >(CANCEL_PRICE_LOCK_MUTATION);

  const { data: hotelData, error: hotelError } = useQuery<GetHotelContextQueryData, GetHotelContextQueryVars>(GET_HOTEL_CONTEXT_QUERY, {
    skip: !isHydrated || !roomHotelId,
    variables: {
      hotelId: roomHotelId,
    },
    fetchPolicy: "cache-first",
  });
  const { data: roomsByHotelData } = useQuery<GetRoomsByHotelQueryData, GetRoomsByHotelQueryVars>(GET_ROOMS_BY_HOTEL_QUERY, {
    skip: !isHydrated || !roomHotelId,
    variables: {
      hotelId: roomHotelId,
      input: {
        page: 1,
        limit: 100,
        sort: "createdAt",
        direction: -1,
      },
    },
    fetchPolicy: "cache-first",
  });

  const hotel = hotelData?.getHotel;
  const coverImage = room?.roomImages[0] ?? "";
  const galleryImages = room?.roomImages.slice(1) ?? [];
  const deal = room?.lastMinuteDeal;
  const { viewerCount: liveViewerCount, connected: isLiveViewConnected } = useRoomLiveViewers({ roomId });
  const sameTypeViewOptions = useMemo(() => {
    if (!room) {
      return [] as Array<{ viewType: ViewType; roomId: string }>;
    }
    const allRooms = roomsByHotelData?.getRoomsByHotel.list ?? [];
    const sameTypeRooms = allRooms.filter((candidate) => candidate.roomType === room.roomType && candidate.viewType);
    const unique = new Map<ViewType, string>();
    for (const candidate of sameTypeRooms) {
      if (!unique.has(candidate.viewType)) {
        unique.set(candidate.viewType, candidate._id);
      }
    }
    if (!unique.has(room.viewType)) {
      unique.set(room.viewType, room._id);
    }
    return Array.from(unique.entries()).map(([viewType, roomId]) => ({ viewType, roomId }));
  }, [room, roomsByHotelData?.getRoomsByHotel.list]);

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

  const hasCalendarAvailability = availabilityByDate.size > 0;
  const calendarMonthLabel = useMemo(() => formatMonthLabel(calendarMonth), [calendarMonth]);
  const canMoveToPreviousMonth = calendarMonth > todayMonth;
  const previousMonthKey = useMemo(() => addMonthsToMonthKey(calendarMonth, -1), [calendarMonth]);
  const nextMonthKey = useMemo(() => addMonthsToMonthKey(calendarMonth, 1), [calendarMonth]);
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
  const canLockCurrentRoom = Boolean(room && room.roomStatus === "AVAILABLE" && room.availableRooms > 0);
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

  const dayPickerClassNames = useMemo(() => {
    const defaults = getDefaultClassNames();
    return {
      ...defaults,
      root: `${defaults.root} w-full`,
      months: `${defaults.months} grid min-w-0 grid-cols-1 gap-3`,
      month: `${defaults.month} rounded-2xl border border-white/70 bg-white/80 p-2.5 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.85)] backdrop-blur`,
      month_caption: `${defaults.month_caption} mb-3`,
      caption_label: `${defaults.caption_label} text-xs font-semibold uppercase tracking-[0.12em] text-slate-700`,
      nav: "hidden",
      button_previous: "hidden",
      button_next: "hidden",
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
  const activePriceLock = myPriceLockData?.getMyPriceLock ?? null;
  const lockMinutesLeft = activePriceLock ? getMinutesUntil(activePriceLock.expiresAt) : 0;
  const showBottomLockBar = canLockPrice && canLockCurrentRoom && !myPriceLockLoading && !activePriceLock && !lockingPrice;

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

  const handleCancelPriceLock = async (): Promise<void> => {
    if (!canLockPrice || !activePriceLock) {
      return;
    }

    setLockActionError(null);
    try {
      await cancelPriceLockMutation({
        variables: { priceLockId: activePriceLock._id },
        refetchQueries: [
          { query: GET_MY_PRICE_LOCK_QUERY, variables: { roomId: activePriceLock.roomId } },
          { query: GET_MY_PRICE_LOCKS_QUERY },
        ],
        awaitRefetchQueries: true,
      });
    } catch (error) {
      setLockActionError(getErrorMessage(error));
    }
  };
  const roomFactCards = useMemo(
    () =>
      room
        ? [
            { label: "Status", value: formatEnumLabel(room.roomStatus), icon: "status" as const },
            { label: "Capacity", value: `${room.maxOccupancy} guests`, icon: "capacity" as const },
            { label: "Bed Setup", value: `${room.bedCount} x ${formatEnumLabel(room.bedType)}`, icon: "bed" as const },
            { label: "Room Size", value: `${room.roomSize} m²`, icon: "size" as const },
            { label: "Inventory", value: `${room.availableRooms}/${room.totalRooms} ready`, icon: "inventory" as const },
            { label: "Weekend Add-on", value: `₩ ${room.weekendSurcharge.toLocaleString()}`, icon: "surcharge" as const },
            { label: "Live Interest", value: `${liveViewerCount} viewer${liveViewerCount === 1 ? "" : "s"}`, icon: "eyes" as const },
            { label: "Updated", value: formatIsoDate(room.updatedAt), icon: "clock" as const },
          ]
        : [],
    [liveViewerCount, room],
  );
  const roomHeroHighlights = useMemo(
    () =>
      room
        ? [
            { label: "Guests", value: `${room.maxOccupancy}`, icon: "capacity" as const },
            { label: "Size", value: `${room.roomSize}m²`, icon: "size" as const },
            { label: "Beds", value: `${room.bedCount}`, icon: "bed" as const },
            { label: "Available", value: `${room.availableRooms}`, icon: "inventory" as const },
          ]
        : [],
    [room],
  );
  const roomAmenityCards = useMemo(
    () =>
      (room?.roomAmenities ?? []).map((amenity) => {
        const icon = resolveAmenityIcon(amenity);
        const tone = resolveAmenityTone(icon);
        return {
          amenity,
          label: formatAmenityLabel(amenity),
          icon,
          tone,
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
          <section className="relative overflow-hidden rounded-[2.2rem] border border-slate-200/90 bg-white shadow-[0_24px_60px_-35px_rgba(15,23,42,0.55)]">
            <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-cyan-200/70 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-blue-200/60 blur-3xl" />
            <div
              className="relative h-[32rem] w-full bg-slate-200 bg-cover bg-center sm:h-[36rem]"
              style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
            >
              {!coverImage ? (
                <div className="flex h-full items-center justify-center bg-slate-100 text-base font-medium text-slate-500">No room image</div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.28),transparent_45%)]" />
                  <div className="absolute left-4 right-4 top-4 rounded-2xl border border-white/35 bg-slate-900/55 px-4 py-3 text-right text-white shadow-xl backdrop-blur sm:left-auto sm:right-7 sm:top-7 sm:w-auto">
                    {deal?.isActive ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-200">Deal Price</p>
                        <p className="mt-1 text-2xl font-semibold">₩ {deal.dealPrice.toLocaleString()}</p>
                        <p className="text-[11px] text-slate-200 line-through">₩ {deal.originalPrice.toLocaleString()}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Nightly Rate</p>
                        <p className="mt-1 text-2xl font-semibold">₩ {room.basePrice.toLocaleString()}</p>
                      </>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-8">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                        {formatEnumLabel(room.roomType)}
                      </span>
                      <span className="rounded-full border border-white/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                        {formatEnumLabel(room.viewType)} View
                      </span>
                      {room.roomNumber ? (
                        <span className="rounded-full border border-white/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                          Room #{room.roomNumber}
                        </span>
                      ) : null}
                    </div>
                    <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{room.roomName}</h1>
                    <p className="mt-3 max-w-3xl text-base text-slate-100 sm:text-lg">
                      {room.roomDesc || "Premium room prepared with practical comforts and a refined atmosphere."}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-2 lg:max-w-2xl lg:grid-cols-4">
                      {roomHeroHighlights.map((item) => (
                        <article key={item.label} className="rounded-xl border border-white/35 bg-white/10 px-3 py-2 backdrop-blur-sm">
                          <div className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/40 bg-white/10 text-white">
                            <DetailIcon name={item.icon} />
                          </div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">{item.label}</p>
                          <p className="text-lg font-semibold">{item.value}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {galleryImages.length > 0 ? (
              <div className="border-t border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50/35 p-3 sm:p-4">
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {galleryImages.map((image, index) => (
                    <div key={image} className="group relative h-32 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:h-36 sm:min-w-[12rem]">
                      <div
                        className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url(${image})` }}
                        aria-hidden
                      />
                      <span className="absolute left-2 top-2 rounded-md border border-white/35 bg-slate-900/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="relative overflow-visible rounded-[2.2rem] border border-slate-200 bg-gradient-to-b from-white via-slate-50/60 to-white p-5 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.45)] sm:p-7">
            <div className="pointer-events-none absolute -right-28 top-16 h-52 w-52 rounded-full bg-sky-100/80 blur-3xl" />
            <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
              <div className="order-2 relative space-y-8 lg:order-1 lg:pr-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {formatEnumLabel(room.roomType)} {room.roomNumber ? `· #${room.roomNumber}` : ""}
                    </p>
                    <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{room.roomName}</h2>
                    {hotel ? <p className="mt-3 text-lg text-slate-600">{hotel.hotelTitle}</p> : null}
                  </div>
                  <div className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-right shadow-sm sm:w-auto sm:min-w-[14rem]">
                    {deal?.isActive ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Last minute deal</p>
                        <p className="mt-1 text-3xl font-semibold text-slate-900">₩ {deal.dealPrice.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 line-through">₩ {deal.originalPrice.toLocaleString()}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Base rate</p>
                        <p className="mt-1 text-3xl font-semibold text-slate-900">₩ {room.basePrice.toLocaleString()}</p>
                      </>
                    )}
                  </div>
                </div>

                <p className="max-w-3xl text-lg leading-8 text-slate-700">
                  {room.roomDesc || "No room description provided. This room is prepared for practical comfort with distinct atmosphere and clean details."}
                </p>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {roomFactCards.map((item) => (
                    <article
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
                        <DetailIcon name={item.icon} />
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.value}</p>
                    </article>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Live viewer tracking: {isLiveViewConnected ? "connected" : "reconnecting..."}
                </p>

                <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Room Amenities</h3>
                    <p className="mt-1 text-sm text-slate-600">Clear icon-based amenity list so guests quickly understand what this room includes.</p>
                  </div>
                  {roomAmenityCards.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {roomAmenityCards.map((item) => (
                        <article key={item.amenity} className={`rounded-2xl border px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-sm ${item.styles.card}`}>
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${item.styles.icon}`}>
                              <DetailIcon name={item.icon} />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 sm:text-base">{item.label}</p>
                              <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${item.styles.badge}`}>
                                Ready to use
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">No detailed amenities were provided for this room.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">View Options</h3>
                  <div className="flex flex-wrap gap-2">
                    {sameTypeViewOptions.map((option) => {
                      const isCurrent = option.roomId === room._id;
                      return isCurrent ? (
                        <span
                          key={option.viewType}
                          className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-900"
                        >
                          {formatEnumLabel(option.viewType)} (Current)
                        </span>
                      ) : (
                        <Link
                          key={option.viewType}
                          href={`/rooms/${option.roomId}`}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                        >
                          {formatEnumLabel(option.viewType)}
                        </Link>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">Switch to another view from the same room category when available.</p>
                </div>
              </div>

              <aside className="order-1 self-start space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur lg:order-2 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-scroll">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick Booking</p>
                  <h3 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Select Stay Dates</h3>
                  <p className="mt-1 text-xs text-slate-500">Step 1: dates • Step 2: guests • Step 3: continue to booking</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-in</span>
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900">
                      {checkInDate || "Select date"}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-out</span>
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold outline-none ring-slate-900 focus:ring-2"
                  />
                </label>

                <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Price lock (30 min)</p>
                  <div className="mt-2 space-y-2.5">
                    {canLockPrice ? (
                      <>
                        {myPriceLockLoading ? <p className="text-xs text-slate-500">Checking your active lock...</p> : null}
                        {activePriceLock ? (
                          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                            <p>
                              Locked price: <span className="font-semibold">₩ {activePriceLock.lockedPrice.toLocaleString()}</span>
                            </p>
                            <p>
                              Expires in <span className="font-semibold">{lockMinutesLeft} min</span> ({formatDateTime(activePriceLock.expiresAt)})
                            </p>
                            <button
                              type="button"
                              onClick={() => void handleCancelPriceLock()}
                              disabled={cancellingPriceLock}
                              className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {cancellingPriceLock ? "Cancelling..." : "Cancel lock"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleLockPrice()}
                            disabled={!canLockCurrentRoom || lockingPrice}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {lockingPrice
                              ? "Locking..."
                              : `Lock ₩ ${(room?.basePrice ?? 0).toLocaleString()} for 30 min`}
                          </button>
                        )}
                        {!canLockCurrentRoom ? (
                          <p className="text-xs text-slate-500">Room is not currently bookable, so lock cannot be created.</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Login with USER/AGENT/ADMIN to use price lock.</p>
                    )}
                  </div>
                </section>

                <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 p-3.5 shadow-[0_18px_38px_-24px_rgba(15,23,42,0.42)] before:pointer-events-none before:absolute before:inset-[-40%_-20%] before:bg-[radial-gradient(circle_at_25%_30%,rgba(56,189,248,0.2),transparent_38%),radial-gradient(circle_at_75%_70%,rgba(59,130,246,0.16),transparent_34%),conic-gradient(from_160deg_at_50%_50%,rgba(148,163,184,0.08),rgba(59,130,246,0.12),rgba(14,165,233,0.08),rgba(148,163,184,0.08))] before:blur-[18px] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] after:bg-[length:16px_16px] after:opacity-20">
                  <div className="relative z-10">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">{calendarMonthLabel}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-slate-500">Monthly price board</p>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCalendarMonth(previousMonthKey)}
                          disabled={!canMoveToPreviousMonth}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarMonth(nextMonthKey)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-500"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    </div>
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
                      key={calendarMonth}
                      mode="range"
                      selected={selectedRange}
                      month={calendarMonthDate}
                      numberOfMonths={1}
                      pagedNavigation
                      onMonthChange={(month) => setCalendarMonth(toMonthKey(month))}
                      onDayClick={handleSelectCalendarDay}
                      disabled={disabledDays}
                      components={dayPickerComponents}
                      classNames={dayPickerClassNames}
                      style={dayPickerStyle}
                      fixedWeeks
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

                {visibleWindowCalendar.length > 0 ? (
                  <div className="grid gap-2 text-xs text-slate-700">
                    <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      Average (this month): <span className="font-semibold">₩ {averageVisiblePrice.toLocaleString()}</span>
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
                <p className="text-[11px] text-slate-500">
                  Calendar prices are demand preview. Booking confirms final nightly rate by backend rule: price lock, then deal, then base rate.
                </p>

                {bookingValidationMessage ? <p className="text-xs font-medium text-amber-700">{bookingValidationMessage}</p> : null}

                {canContinueBooking && roomHotelId ? (
                  <Link
                    href={buildBookingHref(roomHotelId, room._id, checkInDate, checkOutDate, adultCount)}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Continue to booking
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full items-center justify-center rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    Complete booking details
                  </button>
                )}

              </aside>
            </div>
          </section>

          {showBottomLockBar ? (
            <section className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_28px_-18px_rgba(15,23,42,0.65)] backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Price lock ready</p>
                  <p className="text-sm font-semibold text-slate-900">Lock ₩ {room.basePrice.toLocaleString()} for 30 minutes</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLockPrice()}
                  disabled={lockingPrice}
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lockingPrice ? "Locking..." : "Lock price"}
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
