import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
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
import { useRoomBookingState } from "@/lib/hooks/use-room-booking-state";
import { useRoomLiveViewers } from "@/lib/hooks/use-room-live-viewers";
import {
  formatAmenityLabel,
  formatDateInput,
  formatEnumLabel,
  formatIsoDate,
  isCalendarDayBookable,
} from "@/lib/rooms/booking";
import { getErrorMessage } from "@/lib/utils/error";
import type {
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

const canUsePriceActions = (memberType: string | undefined): boolean =>
  memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";

const buildBookingHref = (
  hotelId: string,
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  adults: number,
  children: number,
  quantity: number,
) => {
  const query: Record<string, string> = {
    hotelId,
    roomId,
    adultCount: String(adults),
    childCount: String(children),
    quantity: String(quantity),
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

export default function RoomDetailPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);
  const [lockActionError, setLockActionError] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
    setMember(getSessionMember());
  }, []);

  const todayDate = useMemo(() => formatDateInput(new Date()), []);
  const todayMonth = useMemo(() => todayDate.slice(0, 7), [todayDate]);
  const [calendarMonth, setCalendarMonth] = useState(todayMonth);

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
  const activeDeal = useMemo(() => {
    const deal = room?.lastMinuteDeal;
    if (!deal?.isActive) {
      return null;
    }

    const expiresAtMs = new Date(deal.validUntil).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return null;
    }

    return deal;
  }, [room?.lastMinuteDeal]);
  const { viewerCount: liveViewerCount, connected: isLiveViewConnected } = useRoomLiveViewers({ roomId });

  useEffect(() => {
    if (!roomId) {
      return;
    }

    setLockActionError(null);
  }, [roomId]);

  const {
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
  } = useRoomBookingState({
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
  });

  const canLockCurrentRoom = Boolean(room && room.roomStatus === "AVAILABLE");
  const calendarLoadInProgress = priceCalendarLoading;
  const calendarLoadError = priceCalendarError;
  const calendarLoadErrorMessage = calendarLoadError && visibleWindowCalendar.length === 0 ? getErrorMessage(calendarLoadError) : null;
  const activePriceLock = myPriceLockData?.getMyPriceLock ?? null;
  const lockRequestPrice = activeDeal?.dealPrice ?? room?.basePrice ?? 0;
  const effectiveNightlyRate = activePriceLock?.lockedPrice ?? lockRequestPrice;
  const effectiveNightlyRateSourceLabel = activePriceLock
    ? "Locked price is active for your account."
    : activeDeal
      ? "Last-minute deal is currently active."
      : "Base rate (before taxes/fees).";
  const showBottomLockBar = canLockPrice && canLockCurrentRoom && !myPriceLockLoading && !activePriceLock && !lockingPrice;
  const cheapestDatePrice = cheapestDateKey ? availabilityByDate.get(cheapestDateKey)?.price : undefined;
  const peakDatePrice = peakDateKey ? availabilityByDate.get(peakDateKey)?.price : undefined;
  const continueBookingHref = canContinueBooking && room
    ? buildBookingHref(roomHotelId, room._id, checkInDate, checkOutDate, adultCount, childCount, roomQuantity)
    : undefined;

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
            currentPrice: lockRequestPrice,
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
            deal={activeDeal ?? undefined}
            highlights={roomHeroHighlights}
          />

          <section className="relative overflow-visible rounded-[2.2rem] border border-slate-200 bg-gradient-to-b from-white via-slate-50/60 to-white p-5 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.45)] sm:p-7">
            <div className="pointer-events-none absolute -right-28 top-16 h-52 w-52 rounded-full bg-sky-100/80 blur-3xl" />
            <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
              <RoomOverviewSection
                roomTypeLine={`${formatEnumLabel(room.roomType)}${room.roomNumber ? ` · #${room.roomNumber}` : ""}`}
                roomName={room.roomName}
                hotelTitle={hotel?.hotelTitle}
                hotelCheckInTime={hotel?.checkInTime}
                hotelCheckOutTime={hotel?.checkOutTime}
                hotelCancellationPolicy={hotel?.cancellationPolicy ? formatEnumLabel(hotel.cancellationPolicy) : undefined}
                deal={activeDeal ?? undefined}
                roomDesc={room.roomDesc}
                factCards={roomFactCards}
                amenityCards={roomAmenityCards}
              />
              <RoomBookingSidebar
                effectiveNightlyRate={effectiveNightlyRate}
                effectiveNightlyRateSourceLabel={effectiveNightlyRateSourceLabel}
                adultCount={adultCount}
                childCount={childCount}
                roomQuantity={roomQuantity}
                onAdultCountChange={onAdultCountChange}
                onChildCountChange={onChildCountChange}
                onRoomQuantityChange={onRoomQuantityChange}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                hoveredDateKey={hoveredDateKey}
                hoveredDay={hoveredDay}
                isCalendarDayBookable={isCalendarDayBookable}
                calendarMonthKey={calendarMonth}
                selectedRange={selectedRange}
                calendarMonthDate={calendarMonthDate}
                minCalendarMonthDate={minCalendarMonthDate}
                onCalendarMonthChange={onCalendarMonthChange}
                onCalendarDayClick={onCalendarDayClick}
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

          {showBottomLockBar ? <PriceLockReadyBar basePrice={lockRequestPrice} locking={lockingPrice} onLockPrice={() => void handleLockPrice()} /> : null}
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
