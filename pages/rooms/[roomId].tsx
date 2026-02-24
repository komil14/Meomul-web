import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_HOTEL_QUERY, GET_PRICE_CALENDAR_QUERY, GET_ROOM_QUERY } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  DayPriceDto,
  GetHotelQueryData,
  GetHotelQueryVars,
  GetPriceCalendarQueryData,
  GetPriceCalendarQueryVars,
  GetRoomQueryData,
  GetRoomQueryVars,
} from "@/types/hotel";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

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

const addMonthsToMonthKey = (monthKey: string, months: number): string => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  const date = new Date(Date.UTC(year, month - 1 + months, 1, 0, 0, 0, 0));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
};

const buildMonthGrid = (monthKey: string): Array<string | null> => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return [];
  }

  const firstWeekDay = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0, 0, 0, 0, 0)).getUTCDate();
  const grid: Array<string | null> = [];

  for (let i = 0; i < firstWeekDay; i += 1) {
    grid.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }

  return grid;
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

const formatIsoDate = (value: string): string => {
  if (!value) {
    return "-";
  }
  return value.slice(0, 10);
};

export default function RoomDetailPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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

  const { data: hotelData, error: hotelError } = useQuery<GetHotelQueryData, GetHotelQueryVars>(GET_HOTEL_QUERY, {
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

            {roomHotelId ? (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link
                  href={`/bookings/new?hotelId=${roomHotelId}&roomId=${room._id}`}
                  className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Book this room
                </Link>
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
