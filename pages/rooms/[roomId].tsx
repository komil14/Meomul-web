import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback } from "react";
import { PriceLockReadyBar } from "@/components/rooms/detail/price-lock-ready-bar";
import { RoomHeroSection } from "@/components/rooms/detail/room-hero-section";
import { RoomOverviewSection } from "@/components/rooms/detail/room-overview-section";
import { LiveInterestFabContainer } from "@/components/rooms/live-interest-fab-container";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useRoomDetailPageViewModel } from "@/lib/hooks/use-room-detail-page-view-model";
import { formatEnumLabel } from "@/lib/rooms/booking";

const RoomBookingSidebar = dynamic(
  () => import("@/components/rooms/detail/room-booking-sidebar").then((mod) => mod.RoomBookingSidebar),
  { loading: () => <aside className="order-1 self-start rounded-2xl border border-slate-200 bg-white/90 p-3.5 text-sm text-slate-500 sm:rounded-3xl sm:p-4 lg:order-2">Loading booking panel...</aside> },
);

const ROOM_DETAIL_MOTION_INTENSITY_CLASS = "motion-intensity-bold";

export default function RoomDetailPage() {
  const liveInterestWidgetClass =
    "bottom-[calc(env(safe-area-inset-bottom)+15.5rem)] sm:bottom-[16rem]";

  const {
    isHydrated,
    room,
    roomLoading,
    roomErrorMessage,
    hotelErrorMessage,
    myPriceLockErrorMessage,
    lockActionError,
    priceCalendarLoading,
    calendarLoadErrorMessage,
    hotel,
    coverImage,
    galleryImages,
    activeDeal,
    checkInDate,
    checkOutDate,
    adultCount,
    childCount,
    roomQuantity,
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
    disabledDays,
    onAdultCountChange,
    onChildCountChange,
    onRoomQuantityChange,
    onCalendarMonthChange,
    onCalendarDayClick,
    lockingPrice,
    lockRequestPrice,
    effectiveNightlyRate,
    effectiveNightlyRateSourceLabel,
    showBottomLockBar,
    onLockPrice,
    cheapestDatePrice,
    peakDatePrice,
    continueBookingHref,
    roomTypeLabel,
    viewTypeLabel,
    roomTypeLine,
    roomFactCards,
    roomHeroHighlights,
    roomAmenityCards,
  } = useRoomDetailPageViewModel();

  const handleLockPrice = useCallback(() => {
    void onLockPrice();
  }, [onLockPrice]);

  return (
    <main
      className={`${ROOM_DETAIL_MOTION_INTENSITY_CLASS} ${showBottomLockBar ? "space-y-6 pb-[calc(env(safe-area-inset-bottom)+9.5rem)] sm:pb-32" : "space-y-6"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 motion-fade-up motion-delay-1">
        <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
          Back to hotels
        </Link>
      </div>

      {roomErrorMessage ? <ErrorNotice message={roomErrorMessage} /> : null}
      {hotelErrorMessage ? <ErrorNotice message={hotelErrorMessage} /> : null}
      {myPriceLockErrorMessage ? <ErrorNotice message={myPriceLockErrorMessage} /> : null}
      {lockActionError ? <ErrorNotice message={lockActionError} /> : null}

      {!isHydrated || roomLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600 motion-fade-up motion-delay-2">
          Loading room...
        </section>
      ) : null}

      {isHydrated && !roomLoading && !room ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600 motion-fade-up motion-delay-2">
          Room not found.
        </section>
      ) : null}

      {room ? (
        <>
          <div className="motion-pop-in motion-delay-1">
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
          </div>

          <section className="relative overflow-visible rounded-[2.2rem] border border-slate-200 bg-gradient-to-b from-white via-slate-50/60 to-white p-5 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.45)] motion-fade-up motion-delay-2 sm:p-7">
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
                availabilityByDate={availabilityByDate}
                selectedRange={selectedRange}
                calendarMonthDate={calendarMonthDate}
                minCalendarMonthDate={minCalendarMonthDate}
                onCalendarMonthChange={onCalendarMonthChange}
                onCalendarDayClick={onCalendarDayClick}
                disabledDays={disabledDays}
                dayPickerClassNames={dayPickerClassNames}
                dayPickerStyle={dayPickerStyle}
                calendarLoadInProgress={priceCalendarLoading}
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

          {showBottomLockBar ? (
            <PriceLockReadyBar basePrice={lockRequestPrice} locking={lockingPrice} onLockPrice={handleLockPrice} />
          ) : null}
          <LiveInterestFabContainer
            roomId={room._id}
            availableRooms={selectedStayMinAvailable ?? room.availableRooms}
            containerClassName={liveInterestWidgetClass}
          />
        </>
      ) : null}
    </main>
  );
}
