import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { CREATE_BOOKING_MUTATION, SEARCH_MEMBERS_FOR_BOOKING_QUERY } from "@/graphql/booking.gql";
import { GET_HOTEL_CONTEXT_QUERY, GET_MY_PRICE_LOCK_QUERY, GET_ROOM_QUERY } from "@/graphql/hotel.gql";
import {
  diffNights,
  type EffectiveRateSource,
  formatTodayDate,
  getBookingValidationMessage,
  isDateKey,
  parseNonNegativeInt,
  parsePositiveInt,
  resolveEffectiveNightPrice,
  toDateTime,
} from "@/lib/booking/booking-rules";
import { getSessionMember } from "@/lib/auth/session";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { getErrorMessage } from "@/lib/utils/error";
import { formatNumber } from "@/lib/utils/format";
import type {
  CreateBookingMutationData,
  CreateBookingMutationVars,
  PaymentMethod,
  SearchMembersForBookingQueryData,
  SearchMembersForBookingQueryVars,
} from "@/types/booking";
import type {
  GetHotelContextQueryData,
  GetHotelContextQueryVars,
  GetMyPriceLockQueryData,
  GetMyPriceLockQueryVars,
  GetRoomQueryData,
  GetRoomQueryVars,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";

const PAYMENT_METHODS: PaymentMethod[] = ["AT_HOTEL", "CREDIT_CARD", "DEBIT_CARD", "KAKAOPAY", "NAVERPAY", "TOSS"];

const NewBookingPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const isPageVisible = usePageVisible();
  const hasVisibilityMountedRef = useRef(false);
  const wasVisibleRef = useRef(false);

  const hotelId = useMemo(() => {
    if (typeof router.query.hotelId === "string") {
      return router.query.hotelId;
    }

    return "";
  }, [router.query.hotelId]);

  const roomId = useMemo(() => {
    if (typeof router.query.roomId === "string") {
      return router.query.roomId;
    }

    return "";
  }, [router.query.roomId]);

  const initialGuestIdFromQuery = useMemo(() => {
    if (typeof router.query.guestId === "string") {
      return router.query.guestId;
    }

    return "";
  }, [router.query.guestId]);
  const initialCheckInDateFromQuery = useMemo(() => {
    if (typeof router.query.checkInDate === "string" && isDateKey(router.query.checkInDate)) {
      return router.query.checkInDate;
    }
    return "";
  }, [router.query.checkInDate]);
  const initialCheckOutDateFromQuery = useMemo(() => {
    if (typeof router.query.checkOutDate === "string" && isDateKey(router.query.checkOutDate)) {
      return router.query.checkOutDate;
    }
    return "";
  }, [router.query.checkOutDate]);
  const initialAdultCountFromQuery = useMemo(() => {
    if (typeof router.query.adultCount !== "string") {
      return "";
    }
    const parsed = parsePositiveInt(router.query.adultCount);
    return parsed ? String(parsed) : "";
  }, [router.query.adultCount]);
  const initialChildCountFromQuery = useMemo(() => {
    if (typeof router.query.childCount !== "string") {
      return "";
    }
    const parsed = parseNonNegativeInt(router.query.childCount);
    return parsed != null ? String(parsed) : "";
  }, [router.query.childCount]);
  const initialQuantityFromQuery = useMemo(() => {
    if (typeof router.query.quantity !== "string") {
      return "";
    }
    const parsed = parsePositiveInt(router.query.quantity);
    return parsed ? String(parsed) : "";
  }, [router.query.quantity]);

  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [guestCountInput, setGuestCountInput] = useState("1");
  const [childCountInput, setChildCountInput] = useState("0");
  const [quantityInput, setQuantityInput] = useState("1");
  const [targetGuestId, setTargetGuestId] = useState("");
  const [guestKeyword, setGuestKeyword] = useState("");
  const [debouncedGuestKeyword, setDebouncedGuestKeyword] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("AT_HOTEL");
  const [earlyCheckIn, setEarlyCheckIn] = useState(false);
  const [lateCheckOut, setLateCheckOut] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [createdBookingCode, setCreatedBookingCode] = useState<string | null>(null);

  const {
    data: hotelData,
    loading: hotelLoading,
    error: hotelError,
    refetch: refetchHotel,
  } = useQuery<GetHotelContextQueryData, GetHotelContextQueryVars>(GET_HOTEL_CONTEXT_QUERY, {
    skip: !hotelId,
    variables: { hotelId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const { data: roomData, loading: roomLoading, error: roomError, refetch: refetchRoom } = useQuery<
    GetRoomQueryData,
    GetRoomQueryVars
  >(GET_ROOM_QUERY, {
    skip: !roomId,
    variables: { roomId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const memberType = member?.memberType;
  const canCreateBooking =
    memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const isStaffCreator = memberType === "AGENT" || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const {
    data: priceLockData,
    loading: priceLockLoading,
    error: priceLockError,
    refetch: refetchPriceLock,
  } = useQuery<GetMyPriceLockQueryData, GetMyPriceLockQueryVars>(GET_MY_PRICE_LOCK_QUERY, {
    skip: !roomId || isStaffCreator,
    variables: { roomId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const {
    data: guestCandidatesData,
    loading: guestCandidatesLoading,
    error: guestCandidatesError,
  } = useQuery<SearchMembersForBookingQueryData, SearchMembersForBookingQueryVars>(SEARCH_MEMBERS_FOR_BOOKING_QUERY, {
    skip: !isStaffCreator || debouncedGuestKeyword.length < 2,
    variables: {
      keyword: debouncedGuestKeyword,
      limit: 8,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [createBooking, { loading: creating, data: createdBookingData, error: createError }] = useMutation<
    CreateBookingMutationData,
    CreateBookingMutationVars
  >(CREATE_BOOKING_MUTATION);

  useEffect(() => {
    if (initialGuestIdFromQuery && !targetGuestId) {
      setTargetGuestId(initialGuestIdFromQuery);
    }
  }, [initialGuestIdFromQuery, targetGuestId]);
  useEffect(() => {
    if (initialCheckInDateFromQuery && !checkInDate) {
      setCheckInDate(initialCheckInDateFromQuery);
    }
  }, [checkInDate, initialCheckInDateFromQuery]);
  useEffect(() => {
    if (initialCheckOutDateFromQuery && !checkOutDate) {
      setCheckOutDate(initialCheckOutDateFromQuery);
    }
  }, [checkOutDate, initialCheckOutDateFromQuery]);
  useEffect(() => {
    if (initialAdultCountFromQuery && guestCountInput === "1") {
      setGuestCountInput(initialAdultCountFromQuery);
    }
  }, [guestCountInput, initialAdultCountFromQuery]);
  useEffect(() => {
    if (initialChildCountFromQuery && childCountInput === "0") {
      setChildCountInput(initialChildCountFromQuery);
    }
  }, [childCountInput, initialChildCountFromQuery]);
  useEffect(() => {
    if (initialQuantityFromQuery && quantityInput === "1") {
      setQuantityInput(initialQuantityFromQuery);
    }
  }, [initialQuantityFromQuery, quantityInput]);

  useEffect(() => {
    if (!isStaffCreator) {
      return;
    }

    const timeout = setTimeout(() => {
      setDebouncedGuestKeyword(guestKeyword.trim());
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [guestKeyword, isStaffCreator]);

  useEffect(() => {
    if (!isPageVisible) {
      wasVisibleRef.current = false;
      return;
    }

    const becameVisible = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    if (!hasVisibilityMountedRef.current) {
      hasVisibilityMountedRef.current = true;
      return;
    }
    if (!becameVisible) {
      return;
    }

    const refreshTasks: Array<Promise<unknown>> = [];
    if (hotelId) {
      refreshTasks.push(refetchHotel());
    }
    if (roomId) {
      refreshTasks.push(refetchRoom());
      if (!isStaffCreator) {
        refreshTasks.push(refetchPriceLock());
      }
    }

    if (refreshTasks.length > 0) {
      void Promise.allSettled(refreshTasks);
    }
  }, [hotelId, isPageVisible, isStaffCreator, refetchHotel, refetchPriceLock, refetchRoom, roomId]);

  const hotel = hotelData?.getHotel;
  const room = roomData?.getRoom;
  const guestCandidates = guestCandidatesData?.searchMembersForBooking ?? [];

  const guestCount = parsePositiveInt(guestCountInput);
  const childCount = parseNonNegativeInt(childCountInput);
  const quantity = parsePositiveInt(quantityInput);
  const todayDate = useMemo(() => formatTodayDate(), []);
  const roomCapacity = room?.maxOccupancy ?? 1;
  const maxAdultsByQuantity = roomCapacity * (quantity ?? 1);
  const maxChildrenByCurrentAdults = Math.max(0, maxAdultsByQuantity - (guestCount ?? 1));
  const totalGuests = (guestCount ?? 0) + (childCount ?? 0);

  const nights = diffNights(checkInDate, checkOutDate);
  const activePriceLock = !isStaffCreator ? priceLockData?.getMyPriceLock ?? null : null;
  const effectiveRate = useMemo(
    () =>
      resolveEffectiveNightPrice({
        basePrice: room?.basePrice ?? 0,
        allowPriceLock: !isStaffCreator,
        lockedPrice: activePriceLock?.lockedPrice,
        lastMinuteDeal: room?.lastMinuteDeal,
      }),
    [activePriceLock?.lockedPrice, isStaffCreator, room?.basePrice, room?.lastMinuteDeal],
  );
  const effectivePrice = effectiveRate.price;
  const effectivePriceSource: EffectiveRateSource = effectiveRate.source;

  const estimatedSubtotal = effectivePrice * (quantity ?? 0) * Math.max(0, nights);
  const estimatedTimeFees = (earlyCheckIn ? 30000 : 0) + (lateCheckOut ? 30000 : 0);
  const estimatedKnownTotal = estimatedSubtotal + estimatedTimeFees;
  const maxQuantity = room?.availableRooms && room.availableRooms > 0 ? room.availableRooms : 1;

  useEffect(() => {
    if (!room) {
      return;
    }
    const parsedQty = parsePositiveInt(quantityInput);
    if (!parsedQty) {
      return;
    }
    if (room.availableRooms > 0 && parsedQty > room.availableRooms) {
      setQuantityInput(String(room.availableRooms));
    }
  }, [quantityInput, room]);

  useEffect(() => {
    const parsedGuests = parsePositiveInt(guestCountInput);
    if (!parsedGuests) {
      return;
    }
    if (parsedGuests > maxAdultsByQuantity) {
      setGuestCountInput(String(Math.max(1, maxAdultsByQuantity)));
    }
  }, [guestCountInput, maxAdultsByQuantity]);
  useEffect(() => {
    const parsedChildren = parseNonNegativeInt(childCountInput);
    if (parsedChildren == null) {
      return;
    }
    if (parsedChildren > maxChildrenByCurrentAdults) {
      setChildCountInput(String(maxChildrenByCurrentAdults));
    }
  }, [childCountInput, maxChildrenByCurrentAdults]);

  const bookingValidationMessage = useMemo(() => {
    return getBookingValidationMessage({
      hotelId,
      roomId,
      canCreateBooking,
      isStaffCreator,
      targetGuestId,
      hasHotel: Boolean(hotel),
      hasRoom: Boolean(room),
      guestCount,
      childCount,
      quantity,
      roomStatus: room?.roomStatus,
      roomMaxOccupancy: room?.maxOccupancy,
      roomAvailableRooms: room?.availableRooms,
      checkInDate,
      checkOutDate,
      todayDate,
      nights,
    });
  }, [
    canCreateBooking,
    checkInDate,
    checkOutDate,
    childCount,
    guestCount,
    hotel,
    hotelId,
    isStaffCreator,
    nights,
    quantity,
    room,
    roomId,
    targetGuestId,
    todayDate,
  ]);
  const canSubmitBooking = !creating && bookingValidationMessage === null;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (bookingValidationMessage) {
      setFormError(bookingValidationMessage);
      return;
    }
    if (!hotel || !room || !guestCount || !quantity) {
      setFormError("Booking context is incomplete. Please refresh and try again.");
      return;
    }
    if (childCount == null) {
      setFormError("Child count must be a non-negative integer.");
      return;
    }

    try {
      const response = await createBooking({
        variables: {
          input: {
            ...(isStaffCreator ? { guestId: targetGuestId.trim() } : {}),
            hotelId,
            checkInDate: toDateTime(checkInDate),
            checkOutDate: toDateTime(checkOutDate),
            adultCount: guestCount,
            childCount,
            paymentMethod,
            specialRequests: specialRequests || undefined,
            earlyCheckIn,
            lateCheckOut,
            rooms: [
              {
                roomId,
                roomType: room.roomType,
                quantity,
                pricePerNight: effectivePrice,
                guestName: guestName || undefined,
              },
            ],
          },
        },
      });

      const bookingCode = response.data?.createBooking.bookingCode;
      setCreatedBookingCode(bookingCode ?? null);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  if (!hotelId || !roomId) {
    return (
      <main className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Missing booking context. Open booking from a specific hotel room.
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/hotels/${hotelId}`} className="text-slate-600 underline underline-offset-4">
          Back to hotel
        </Link>
        <Link href="/hotels" className="text-slate-600 underline underline-offset-4">
          Browse hotels
        </Link>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Booking</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create New Booking</h1>
        <p className="mt-2 text-sm text-slate-600">Select dates, guests, quantity, and payment method.</p>
      </header>

      {isStaffCreator ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Staff flow is active. Search and select a target user, or enter <code>guestId</code> manually.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          User flow: booking will be created for your own account.
        </div>
      )}

      {hotelError ? <ErrorNotice message={getErrorMessage(hotelError)} /> : null}
      {roomError ? <ErrorNotice message={getErrorMessage(roomError)} /> : null}
      {priceLockError ? <ErrorNotice message={getErrorMessage(priceLockError)} /> : null}

      {hotelLoading || roomLoading || priceLockLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading booking context...</div>
      ) : null}

      {hotel && room ? (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Hotel</h2>
            <p className="mt-2 text-sm text-slate-700">{hotel.hotelTitle}</p>
            <p className="text-sm text-slate-600">
              {hotel.hotelLocation} · {hotel.hotelType}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Room</h2>
            <p className="mt-2 text-sm text-slate-700">{room.roomName}</p>
            <p className="text-sm text-slate-600">{room.roomType}</p>
            <p className="text-sm text-slate-600">{room.viewType} view</p>
            <p className="mt-2 text-sm text-slate-700">Available: {room.availableRooms}</p>
            <p className="text-sm text-slate-700">Price per night: ₩ {formatNumber(effectivePrice)}</p>
            <p className="text-xs text-slate-500">
              Rate source:{" "}
              {effectivePriceSource === "PRICE_LOCK"
                ? "Price lock"
                : effectivePriceSource === "LAST_MINUTE_DEAL"
                  ? "Last-minute deal"
                  : "Base rate"}
            </p>
          </article>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {isStaffCreator ? (
            <>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Search target user</span>
                <input
                  value={guestKeyword}
                  onChange={(event) => setGuestKeyword(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                  placeholder="Search by nick, full name, or phone"
                />
              </label>

              {guestCandidatesLoading ? (
                <p className="md:col-span-2 text-sm text-slate-500">Searching users...</p>
              ) : null}
              {guestCandidatesError ? (
                <ErrorNotice className="md:col-span-2" message={getErrorMessage(guestCandidatesError)} />
              ) : null}

              {guestCandidates.length > 0 ? (
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Candidates</p>
                  <div className="grid gap-2">
                    {guestCandidates.map((candidate) => (
                      <button
                        key={candidate._id}
                        type="button"
                        onClick={() => {
                          setTargetGuestId(candidate._id);
                          setGuestKeyword(`${candidate.memberNick} (${candidate.memberPhone})`);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm transition hover:border-slate-500"
                      >
                        <p className="font-medium text-slate-900">{candidate.memberNick}</p>
                        <p className="text-slate-600">
                          {candidate.memberFullName || "No full name"} · {candidate.memberPhone}
                        </p>
                        <p className="text-xs text-slate-500">ID: {candidate._id}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Target guestId (manual fallback)</span>
                <input
                  value={targetGuestId}
                  onChange={(event) => setTargetGuestId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                  placeholder="Mongo member _id of target USER"
                  required
                />
              </label>
            </>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Check-in</span>
            <input
              type="date"
              min={todayDate}
              value={checkInDate}
              onChange={(event) => setCheckInDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Check-out</span>
            <input
              type="date"
              min={checkInDate || todayDate}
              value={checkOutDate}
              onChange={(event) => setCheckOutDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Guest count</span>
            <input
              type="number"
              value={guestCountInput}
              onChange={(event) => setGuestCountInput(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              min={1}
              max={String(Math.max(1, maxAdultsByQuantity))}
              aria-describedby="guest-capacity-hint"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
            <p id="guest-capacity-hint" className="mt-1 text-xs text-slate-500">
              Capacity: up to {maxAdultsByQuantity} total guest(s) ({roomCapacity} per room)
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Child count</span>
            <input
              type="number"
              value={childCountInput}
              onChange={(event) => setChildCountInput(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              min={0}
              max={String(Math.max(0, maxChildrenByCurrentAdults))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
            <p className="mt-1 text-xs text-slate-500">Current total guests: {totalGuests}</p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Room quantity</span>
            <input
              type="number"
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              min={1}
              max={String(maxQuantity)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
            {room ? <p className="mt-1 text-xs text-slate-500">Max available now: {room.availableRooms}</p> : null}
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Payment method</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700">Early check-in (+₩ 30,000)</span>
              <input
                type="checkbox"
                checked={earlyCheckIn}
                onChange={(event) => setEarlyCheckIn(event.target.checked)}
                className="h-4 w-4 accent-slate-900"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700">Late check-out (+₩ 30,000)</span>
              <input
                type="checkbox"
                checked={lateCheckOut}
                onChange={(event) => setLateCheckOut(event.target.checked)}
                className="h-4 w-4 accent-slate-900"
              />
            </label>
          </div>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Guest name (optional)</span>
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              placeholder="Name shown in booking rooms[]"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Special requests (optional)</span>
            <textarea
              value={specialRequests}
              onChange={(event) => setSpecialRequests(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              placeholder="Late arrival note, accessibility request, etc."
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            Estimated subtotal: <span className="font-semibold">₩ {formatNumber(estimatedSubtotal)}</span>
          </p>
          <p className="mt-1">
            Early/Late fees (known): <span className="font-semibold">₩ {formatNumber(estimatedTimeFees)}</span>
          </p>
          <p className="mt-1">
            Estimated known total: <span className="font-semibold">₩ {formatNumber(estimatedKnownTotal)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Final total is calculated on server (taxes, service fee, surcharges).</p>
          <p className="mt-1 text-xs text-slate-500">
            Backend rate priority: price lock, then deal, then base rate. Calendar demand preview may differ.
          </p>
        </div>

        {formError ? <ErrorNotice message={formError} /> : null}
        {!formError && bookingValidationMessage ? <p className="text-xs font-medium text-amber-700">{bookingValidationMessage}</p> : null}
        {createError ? <ErrorNotice message={getErrorMessage(createError)} /> : null}

        <button
          type="submit"
          disabled={!canSubmitBooking}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "Creating booking..." : "Create booking"}
        </button>
      </form>

      {createdBookingCode && createdBookingData?.createBooking ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-800">Booking created</h2>
          <p className="mt-2 text-sm text-emerald-800">
            Code: <span className="font-semibold">{createdBookingCode}</span>
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Total price: <span className="font-semibold">₩ {formatNumber(createdBookingData.createBooking.totalPrice)}</span>
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Payment status: <span className="font-semibold">{createdBookingData.createBooking.paymentStatus}</span>
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/dashboard" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">
              Go to dashboard
            </Link>
            <Link href={`/hotels/${hotelId}`} className="text-sm font-semibold text-emerald-800 underline underline-offset-4">
              Back to hotel
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
};

NewBookingPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default NewBookingPage;
