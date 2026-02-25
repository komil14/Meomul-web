import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { PriceLockReadyBar } from "@/components/rooms/detail/price-lock-ready-bar";
import { getRoomPresentation } from "@/components/rooms/detail/room-presenters";
import { RoomBookingSidebar } from "@/components/rooms/detail/room-booking-sidebar";
import { RoomHeroSection } from "@/components/rooms/detail/room-hero-section";
import { RoomOverviewSection } from "@/components/rooms/detail/room-overview-section";
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
import { formatDateInput, formatEnumLabel, isCalendarDayBookable } from "@/lib/rooms/booking";
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
  const { roomTypeLabel, viewTypeLabel, roomTypeLine, roomFactCards, roomHeroHighlights, roomAmenityCards } = useMemo(
    () => getRoomPresentation(room),
    [room],
  );

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
            roomTypeLabel={roomTypeLabel}
            viewTypeLabel={viewTypeLabel}
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
                roomTypeLine={roomTypeLine}
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
