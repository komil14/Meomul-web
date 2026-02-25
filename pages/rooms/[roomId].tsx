import Link from "next/link";
import { useMemo } from "react";
import { PriceLockReadyBar } from "@/components/rooms/detail/price-lock-ready-bar";
import { getRoomPresentation } from "@/components/rooms/detail/room-presenters";
import { RoomBookingSidebar } from "@/components/rooms/detail/room-booking-sidebar";
import { RoomHeroSection } from "@/components/rooms/detail/room-hero-section";
import { RoomOverviewSection } from "@/components/rooms/detail/room-overview-section";
import { LiveInterestFab } from "@/components/rooms/live-interest-fab";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useRoomBookingState } from "@/lib/hooks/use-room-booking-state";
import { useRoomDetailData } from "@/lib/hooks/use-room-detail-data";
import { useRoomLiveViewers } from "@/lib/hooks/use-room-live-viewers";
import { useRoomPriceLock } from "@/lib/hooks/use-room-price-lock";
import { formatEnumLabel, isCalendarDayBookable } from "@/lib/rooms/booking";
import { getErrorMessage } from "@/lib/utils/error";

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
  const {
    isHydrated,
    memberType,
    todayDate,
    todayMonth,
    calendarMonth,
    setCalendarMonth,
    roomId,
    room,
    roomLoading,
    roomError,
    roomHotelId,
    priceCalendarData,
    priceCalendarLoading,
    priceCalendarError,
    refetchPriceCalendar,
    hotel,
    hotelError,
    coverImage,
    galleryImages,
    activeDeal,
  } = useRoomDetailData();

  const { viewerCount: liveViewerCount, connected: isLiveViewConnected } = useRoomLiveViewers({ roomId });

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

  const {
    myPriceLockError,
    lockActionError,
    lockingPrice,
    lockRequestPrice,
    effectiveNightlyRate,
    effectiveNightlyRateSourceLabel,
    showBottomLockBar,
    onLockPrice,
  } = useRoomPriceLock({
    isHydrated,
    roomId,
    room,
    memberType,
    activeDeal,
  });

  const calendarLoadInProgress = priceCalendarLoading;
  const calendarLoadError = priceCalendarError;
  const calendarLoadErrorMessage = calendarLoadError && visibleWindowCalendar.length === 0 ? getErrorMessage(calendarLoadError) : null;
  const cheapestDatePrice = cheapestDateKey ? availabilityByDate.get(cheapestDateKey)?.price : undefined;
  const peakDatePrice = peakDateKey ? availabilityByDate.get(peakDateKey)?.price : undefined;
  const continueBookingHref = canContinueBooking && room
    ? buildBookingHref(roomHotelId, room._id, checkInDate, checkOutDate, adultCount, childCount, roomQuantity)
    : undefined;
  const { roomTypeLabel, viewTypeLabel, roomTypeLine, roomFactCards, roomHeroHighlights, roomAmenityCards } = useMemo(
    () => getRoomPresentation(room),
    [room],
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

          {showBottomLockBar ? <PriceLockReadyBar basePrice={lockRequestPrice} locking={lockingPrice} onLockPrice={() => void onLockPrice()} /> : null}
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
