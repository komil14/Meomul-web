import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CREATE_BOOKING_MUTATION,
  SEARCH_MEMBERS_FOR_BOOKING_QUERY,
} from "@/graphql/booking.gql";
import {
  GET_HOTEL_CONTEXT_QUERY,
  GET_MY_PRICE_LOCK_QUERY,
  GET_ROOM_QUERY,
} from "@/graphql/hotel.gql";
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
import { ErrorNotice } from "@/components/ui/error-notice";
import { getErrorMessage } from "@/lib/utils/error";
import { formatNumber } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media-url";
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
  HotelContextItem,
  RoomDetailItem,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";
import { ArrowLeft, Check, ChevronDown, Minus, Plus } from "lucide-react";

// ─── Payment methods ──────────────────────────────────────────────────────────

const PAYMENT_METHODS_CONFIG: Array<{
  value: PaymentMethod;
  label: string;
  emoji: string;
}> = [
  { value: "AT_HOTEL", label: "Pay at Hotel", emoji: "🏨" },
  { value: "CREDIT_CARD", label: "Credit Card", emoji: "💳" },
  { value: "DEBIT_CARD", label: "Debit Card", emoji: "🪙" },
  { value: "KAKAOPAY", label: "KakaoPay", emoji: "💛" },
  { value: "NAVERPAY", label: "NaverPay", emoji: "💚" },
  { value: "TOSS", label: "Toss", emoji: "💙" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={14} />
        </button>
        <span className="w-8 text-center text-base font-semibold text-slate-900">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Increase ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

const STEP_LABELS = ["Dates & Guests", "Guest Info", "Payment"];

function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-start">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <div key={stepNum} className="flex flex-1 items-start">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Check size={14} strokeWidth={3} /> : stepNum}
              </div>
              <span
                className={`mt-2 text-center text-xs leading-tight ${
                  active
                    ? "font-semibold text-slate-900"
                    : done
                      ? "text-emerald-600"
                      : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`mt-4 h-px flex-1 transition-colors duration-300 ${
                  done ? "bg-emerald-300" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PriceSummaryPanel({
  hotel,
  room,
  nights,
  quantity,
  effectivePrice,
  priceSource,
  earlyCheckIn,
  lateCheckOut,
}: {
  hotel: HotelContextItem;
  room: RoomDetailItem;
  nights: number;
  quantity: number;
  effectivePrice: number;
  priceSource: EffectiveRateSource;
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
}) {
  const validNights = Math.max(0, nights);
  const subtotal = effectivePrice * quantity * validNights;
  const timeFees = (earlyCheckIn ? 30_000 : 0) + (lateCheckOut ? 30_000 : 0);
  const estTaxes = Math.round(subtotal * 0.1);
  const estTotal = subtotal + timeFees + estTaxes;
  const thumbnail = room.roomImages[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {thumbnail && (
        <div className="h-36 overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveMediaUrl(thumbnail)}
            alt={room.roomName}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {hotel.hotelTitle}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">
          {room.roomName}
        </p>
        <p className="text-xs text-slate-500">{room.roomType}</p>

        {priceSource !== "BASE_RATE" && (
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              priceSource === "PRICE_LOCK"
                ? "bg-violet-50 text-violet-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {priceSource === "PRICE_LOCK" ? "⚡ Price Lock" : "🔥 Last-minute Deal"}
          </span>
        )}

        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
          {validNights > 0 ? (
            <>
              <div className="flex justify-between text-slate-600">
                <span>
                  ₩{formatNumber(effectivePrice)} ×{" "}
                  {quantity > 1 ? `${quantity} rooms × ` : ""}
                  {validNights} night{validNights !== 1 ? "s" : ""}
                </span>
                <span className="font-medium text-slate-900">
                  ₩{formatNumber(subtotal)}
                </span>
              </div>
              {earlyCheckIn && (
                <div className="flex justify-between text-slate-600">
                  <span>Early check-in</span>
                  <span>+₩30,000</span>
                </div>
              )}
              {lateCheckOut && (
                <div className="flex justify-between text-slate-600">
                  <span>Late check-out</span>
                  <span>+₩30,000</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Est. taxes (~10%)</span>
                <span>₩{formatNumber(estTaxes)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-sm font-semibold text-slate-900">
                  Est. Total
                </span>
                <span className="text-base font-bold text-slate-900">
                  ₩{formatNumber(estTotal)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">
              Select dates to see price breakdown
            </p>
          )}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          Final amount includes taxes, surcharges and any applicable discounts —
          confirmed on booking.
        </p>
      </div>
    </div>
  );
}

function PaymentCard({
  value,
  label,
  emoji,
  selected,
  onSelect,
}: {
  value: PaymentMethod;
  label: string;
  emoji: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
        selected
          ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200 text-sky-800"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="text-xl">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const NewBookingPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const isPageVisible = usePageVisible();
  const hasVisibilityMountedRef = useRef(false);
  const wasVisibleRef = useRef(false);

  // URL params
  const hotelId = useMemo(
    () =>
      typeof router.query.hotelId === "string" ? router.query.hotelId : "",
    [router.query.hotelId],
  );
  const roomId = useMemo(
    () =>
      typeof router.query.roomId === "string" ? router.query.roomId : "",
    [router.query.roomId],
  );
  const initialGuestIdFromQuery = useMemo(
    () =>
      typeof router.query.guestId === "string" ? router.query.guestId : "",
    [router.query.guestId],
  );
  const initialCheckInFromQuery = useMemo(
    () =>
      typeof router.query.checkInDate === "string" &&
      isDateKey(router.query.checkInDate)
        ? router.query.checkInDate
        : "",
    [router.query.checkInDate],
  );
  const initialCheckOutFromQuery = useMemo(
    () =>
      typeof router.query.checkOutDate === "string" &&
      isDateKey(router.query.checkOutDate)
        ? router.query.checkOutDate
        : "",
    [router.query.checkOutDate],
  );
  const initialAdults = useMemo(
    () =>
      typeof router.query.adultCount === "string"
        ? (parsePositiveInt(router.query.adultCount) ?? 1)
        : 1,
    [router.query.adultCount],
  );
  const initialChildren = useMemo(
    () =>
      typeof router.query.childCount === "string"
        ? (parseNonNegativeInt(router.query.childCount) ?? 0)
        : 0,
    [router.query.childCount],
  );
  const initialQty = useMemo(
    () =>
      typeof router.query.quantity === "string"
        ? (parsePositiveInt(router.query.quantity) ?? 1)
        : 1,
    [router.query.quantity],
  );

  // Auth
  const memberType = member?.memberType;
  const canCreateBooking =
    memberType === "USER" ||
    memberType === "AGENT" ||
    memberType === "ADMIN" ||
    memberType === "ADMIN_OPERATOR";
  const isStaffCreator =
    memberType === "AGENT" ||
    memberType === "ADMIN" ||
    memberType === "ADMIN_OPERATOR";

  // Step
  const [step, setStep] = useState(1);

  // Step 1 — Dates & Guests
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adultCount, setAdultCount] = useState(initialAdults);
  const [childCount, setChildCount] = useState(initialChildren);
  const [quantity, setQuantity] = useState(initialQty);

  // Step 2 — Guest Info
  const [guestName, setGuestName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [targetGuestId, setTargetGuestId] = useState("");
  const [guestKeyword, setGuestKeyword] = useState("");
  const [debouncedGuestKeyword, setDebouncedGuestKeyword] = useState("");

  // Step 3 — Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("AT_HOTEL");
  const [earlyCheckIn, setEarlyCheckIn] = useState(false);
  const [lateCheckOut, setLateCheckOut] = useState(false);

  // UI
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<{
    code: string;
    total: number;
    paymentStatus: string;
  } | null>(null);

  // Queries
  const {
    data: hotelData,
    loading: hotelLoading,
    error: hotelError,
    refetch: refetchHotel,
  } = useQuery<GetHotelContextQueryData, GetHotelContextQueryVars>(
    GET_HOTEL_CONTEXT_QUERY,
    {
      skip: !hotelId,
      variables: { hotelId },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: roomData,
    loading: roomLoading,
    error: roomError,
    refetch: refetchRoom,
  } = useQuery<GetRoomQueryData, GetRoomQueryVars>(GET_ROOM_QUERY, {
    skip: !roomId,
    variables: { roomId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const {
    data: priceLockData,
    loading: priceLockLoading,
    refetch: refetchPriceLock,
  } = useQuery<GetMyPriceLockQueryData, GetMyPriceLockQueryVars>(
    GET_MY_PRICE_LOCK_QUERY,
    {
      skip: !roomId || isStaffCreator,
      variables: { roomId },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const { data: guestCandidatesData, loading: guestCandidatesLoading } =
    useQuery<SearchMembersForBookingQueryData, SearchMembersForBookingQueryVars>(
      SEARCH_MEMBERS_FOR_BOOKING_QUERY,
      {
        skip: !isStaffCreator || debouncedGuestKeyword.length < 2,
        variables: { keyword: debouncedGuestKeyword, limit: 8 },
        fetchPolicy: "cache-and-network",
        nextFetchPolicy: "cache-and-network",
      },
    );

  const [createBooking, { loading: creating }] = useMutation<
    CreateBookingMutationData,
    CreateBookingMutationVars
  >(CREATE_BOOKING_MUTATION);

  // Effects — init from URL params
  useEffect(() => {
    if (initialGuestIdFromQuery && !targetGuestId)
      setTargetGuestId(initialGuestIdFromQuery);
  }, [initialGuestIdFromQuery, targetGuestId]);

  useEffect(() => {
    if (initialCheckInFromQuery && !checkInDate)
      setCheckInDate(initialCheckInFromQuery);
  }, [checkInDate, initialCheckInFromQuery]);

  useEffect(() => {
    if (initialCheckOutFromQuery && !checkOutDate)
      setCheckOutDate(initialCheckOutFromQuery);
  }, [checkOutDate, initialCheckOutFromQuery]);

  // Fix: router.query is empty on SSR first render — sync counts once router is ready
  useEffect(() => {
    if (!router.isReady) return;
    setAdultCount(initialAdults);
    setChildCount(initialChildren);
    setQuantity(initialQty);
    // Intentionally run only when router becomes ready (values already derived from query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Debounced guest keyword
  useEffect(() => {
    if (!isStaffCreator) return;
    const t = setTimeout(() => setDebouncedGuestKeyword(guestKeyword.trim()), 250);
    return () => clearTimeout(t);
  }, [guestKeyword, isStaffCreator]);

  // Page visibility refetch
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
    if (!becameVisible) return;
    const tasks: Array<Promise<unknown>> = [];
    if (hotelId) tasks.push(refetchHotel());
    if (roomId) {
      tasks.push(refetchRoom());
      if (!isStaffCreator) tasks.push(refetchPriceLock());
    }
    if (tasks.length > 0) void Promise.allSettled(tasks);
  }, [
    hotelId,
    isPageVisible,
    isStaffCreator,
    refetchHotel,
    refetchPriceLock,
    refetchRoom,
    roomId,
  ]);

  // Auto-cap quantity, adults, children when room data changes
  useEffect(() => {
    if (!roomData?.getRoom) return;
    const maxQty = roomData.getRoom.availableRooms;
    if (maxQty > 0 && quantity > maxQty) setQuantity(maxQty);
  }, [quantity, roomData]);

  useEffect(() => {
    if (!roomData?.getRoom) return;
    const max = roomData.getRoom.maxOccupancy * quantity;
    if (adultCount > max) setAdultCount(Math.max(1, max));
  }, [adultCount, quantity, roomData]);

  useEffect(() => {
    if (!roomData?.getRoom) return;
    const maxC = Math.max(
      0,
      roomData.getRoom.maxOccupancy * quantity - adultCount,
    );
    if (childCount > maxC) setChildCount(maxC);
  }, [adultCount, childCount, quantity, roomData]);

  // Derived values
  const hotel = hotelData?.getHotel;
  const room = roomData?.getRoom;
  const guestCandidates =
    guestCandidatesData?.searchMembersForBooking ?? [];
  const todayDate = useMemo(() => formatTodayDate(), []);

  const activePriceLock = isStaffCreator
    ? null
    : (priceLockData?.getMyPriceLock ?? null);

  const effectiveRate = useMemo(
    () =>
      resolveEffectiveNightPrice({
        basePrice: room?.basePrice ?? 0,
        allowPriceLock: !isStaffCreator,
        lockedPrice: activePriceLock?.lockedPrice,
        lastMinuteDeal: room?.lastMinuteDeal,
      }),
    [
      activePriceLock?.lockedPrice,
      isStaffCreator,
      room?.basePrice,
      room?.lastMinuteDeal,
    ],
  );

  const effectivePrice = effectiveRate.price;
  const priceSource: EffectiveRateSource = effectiveRate.source;
  const nights = diffNights(checkInDate, checkOutDate);
  const roomCapacity = room?.maxOccupancy ?? 1;
  const maxAdults = roomCapacity * quantity;
  const maxChildren = Math.max(0, maxAdults - adultCount);
  const maxQuantity =
    room?.availableRooms && room.availableRooms > 0 ? room.availableRooms : 1;

  // Full validation (pre-submit)
  const bookingValidationMessage = useMemo(
    () =>
      getBookingValidationMessage({
        hotelId,
        roomId,
        canCreateBooking,
        isStaffCreator,
        targetGuestId,
        hasHotel: Boolean(hotel),
        hasRoom: Boolean(room),
        guestCount: adultCount,
        childCount,
        quantity,
        roomStatus: room?.roomStatus,
        roomMaxOccupancy: room?.maxOccupancy,
        roomAvailableRooms: room?.availableRooms,
        checkInDate,
        checkOutDate,
        todayDate,
        nights,
      }),
    [
      adultCount,
      canCreateBooking,
      checkInDate,
      checkOutDate,
      childCount,
      hotel,
      hotelId,
      isStaffCreator,
      nights,
      quantity,
      room,
      roomId,
      targetGuestId,
      todayDate,
    ],
  );

  // Per-step validation
  const step1Valid = useMemo(() => {
    if (!checkInDate || !checkOutDate) return false;
    if (checkInDate < todayDate) return false;
    if (checkOutDate <= checkInDate) return false;
    return nights >= 1;
  }, [checkInDate, checkOutDate, nights, todayDate]);

  const step2Valid = isStaffCreator ? targetGuestId.trim().length > 0 : true;

  // Price totals for mobile pill
  const validNights = Math.max(0, nights);
  const subtotal = effectivePrice * quantity * validNights;
  const timeFees = (earlyCheckIn ? 30_000 : 0) + (lateCheckOut ? 30_000 : 0);
  const estTaxes = Math.round(subtotal * 0.1);
  const estTotal = subtotal + timeFees + estTaxes;

  // Submit
  const handleConfirm = async () => {
    setSubmitError(null);
    if (bookingValidationMessage) {
      setSubmitError(bookingValidationMessage);
      return;
    }
    if (!hotel || !room) {
      setSubmitError("Booking context is incomplete. Please refresh and try again.");
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
            adultCount,
            childCount,
            paymentMethod,
            specialRequests: specialRequests.trim() || undefined,
            earlyCheckIn,
            lateCheckOut,
            rooms: [
              {
                roomId,
                roomType: room.roomType,
                quantity,
                pricePerNight: effectivePrice,
                guestName: guestName.trim() || undefined,
              },
            ],
          },
        },
      });
      const booking = response.data?.createBooking;
      if (booking) {
        setCreatedBooking({
          code: booking.bookingCode,
          total: booking.totalPrice,
          paymentStatus: booking.paymentStatus,
        });
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  };

  // ── Missing context ──────────────────────────────────────────────────────────
  if (!hotelId || !roomId) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div>
          <p className="text-3xl">🏨</p>
          <p className="mt-3 font-semibold text-slate-800">No booking context</p>
          <p className="mt-1 text-sm text-slate-500">
            Open booking from a specific hotel room page.
          </p>
          <Link
            href="/hotels"
            className="mt-5 inline-block rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Browse Hotels
          </Link>
        </div>
      </main>
    );
  }

  // ── Confirmed screen ─────────────────────────────────────────────────────────
  if (createdBooking) {
    return (
      <>
        <style>{`
          @keyframes bookingConfirm {
            0%   { transform: scale(0.7); opacity: 0; }
            60%  { transform: scale(1.08); }
            100% { transform: scale(1); opacity: 1; }
          }
          .anim-confirm { animation: bookingConfirm 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
          @keyframes confirmFade {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .anim-cfade { animation: confirmFade 0.4s ease-out 0.3s both; }
        `}</style>
        <main className="mx-auto max-w-lg space-y-6 py-8 text-center">
          <div className="anim-confirm mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
            <Check size={36} strokeWidth={2.5} />
          </div>

          <div className="anim-cfade space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              Booking Confirmed
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">
              You&apos;re all set!
            </h1>
            <p className="text-sm text-slate-500">
              Your reservation has been created successfully.
            </p>
          </div>

          <div className="anim-cfade rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Booking Code
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-slate-900">
              {createdBooking.code}
            </p>
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-semibold text-slate-900">
                  ₩{formatNumber(createdBooking.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payment status</span>
                <span className="font-semibold capitalize text-slate-900">
                  {createdBooking.paymentStatus.toLowerCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="anim-cfade flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/bookings"
              className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              View my bookings
            </Link>
            <Link
              href={`/hotels/${hotelId}`}
              className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Back to hotel
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  const isLoading =
    hotelLoading || roomLoading || (priceLockLoading && !isStaffCreator);

  if (!hotel || !room) {
    return (
      <main className="space-y-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
        <div className="h-7 w-56 animate-pulse rounded-full bg-slate-200" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
          <div className="hidden w-80 flex-shrink-0 rounded-2xl border border-slate-200 bg-white lg:block">
            <div className="h-36 animate-pulse bg-slate-100" />
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded-full bg-slate-100"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // AGENT ownership guard — must own the hotel to create bookings here
  if (memberType === "AGENT" && hotel.memberId !== member?._id) {
    return (
      <main className="space-y-6">
        <Link
          href="/hotels/manage"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft size={14} />
          Back to my hotels
        </Link>
        <ErrorNotice
          tone="warn"
          message="You can only create bookings for hotels you own. This hotel belongs to another agent."
        />
      </main>
    );
  }

  const loadError = hotelError ?? roomError;

  // ── Wizard ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes stepSlideIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .anim-step { animation: stepSlideIn 0.22s ease-out both; }
      `}</style>

      <main className="space-y-6">
        {/* Back link */}
        <Link
          href={`/hotels/${hotelId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft size={14} />
          Back to hotel
        </Link>

        {/* Header */}
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {isStaffCreator ? "Staff Booking" : "New Booking"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {hotel?.hotelTitle ?? "Reserve Your Stay"}
          </h1>
        </header>

        {loadError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {getErrorMessage(loadError)}
          </div>
        )}

        {hotel && room && (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* ── Left: wizard ── */}
            <div className="min-w-0 flex-1 space-y-5">
              {/* Mobile summary pill */}
              <div className="lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileSummaryOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:bg-slate-50"
                >
                  <div className="text-left">
                    <p className="text-[11px] text-slate-400">
                      Estimated total
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      ₩{formatNumber(estTotal)}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform ${
                      mobileSummaryOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {mobileSummaryOpen && (
                  <div className="mt-2">
                    <PriceSummaryPanel
                      hotel={hotel}
                      room={room}
                      nights={nights}
                      quantity={quantity}
                      effectivePrice={effectivePrice}
                      priceSource={priceSource}
                      earlyCheckIn={earlyCheckIn}
                      lateCheckOut={lateCheckOut}
                    />
                  </div>
                )}
              </div>

              {/* Step progress */}
              <StepProgress current={step} />

              {/* Step content */}
              <div key={step} className="anim-step">
                {/* ── Step 1: Dates & Guests ── */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Select your dates
                      </h2>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Check-in
                          </span>
                          <input
                            type="date"
                            min={todayDate}
                            value={checkInDate}
                            onChange={(e) => {
                              setCheckInDate(e.target.value);
                              if (
                                checkOutDate &&
                                e.target.value >= checkOutDate
                              )
                                setCheckOutDate("");
                            }}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Check-out
                          </span>
                          <input
                            type="date"
                            min={checkInDate || todayDate}
                            value={checkOutDate}
                            onChange={(e) => setCheckOutDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          />
                        </label>
                      </div>
                      {nights >= 1 && (
                        <p className="mt-3 text-center text-sm font-semibold text-sky-600">
                          {nights} night{nights !== 1 ? "s" : ""}
                        </p>
                      )}
                      {checkInDate &&
                        checkOutDate &&
                        checkOutDate <= checkInDate && (
                          <p className="mt-2 text-center text-xs text-rose-500">
                            Check-out must be after check-in
                          </p>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Guests &amp; Rooms
                      </h2>
                      <p className="mb-4 text-xs text-slate-400">
                        Max {roomCapacity} guest
                        {roomCapacity !== 1 ? "s" : ""} per room ·{" "}
                        {room.availableRooms} room
                        {room.availableRooms !== 1 ? "s" : ""} available
                      </p>
                      <div className="space-y-3">
                        <Stepper
                          label="Adults"
                          hint="Age 18+"
                          value={adultCount}
                          min={1}
                          max={maxAdults}
                          onChange={setAdultCount}
                        />
                        <Stepper
                          label="Children"
                          hint="Under 18"
                          value={childCount}
                          min={0}
                          max={maxChildren}
                          onChange={setChildCount}
                        />
                        <Stepper
                          label="Rooms"
                          value={quantity}
                          min={1}
                          max={maxQuantity}
                          onChange={setQuantity}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Guest Info ── */}
                {step === 2 && (
                  <div className="space-y-4">
                    {isStaffCreator && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                        Staff booking — search and select the guest you are booking for
                      </div>
                    )}

                    {isStaffCreator && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                          Find Guest
                        </h2>
                        <input
                          value={guestKeyword}
                          onChange={(e) => {
                            setGuestKeyword(e.target.value);
                            if (!e.target.value) setTargetGuestId("");
                          }}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          placeholder="Search by nick, name, or phone…"
                        />
                        {guestCandidatesLoading && (
                          <p className="mt-2 text-xs text-slate-400">
                            Searching…
                          </p>
                        )}
                        {guestCandidates.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {guestCandidates.map((c) => (
                              <button
                                key={c._id}
                                type="button"
                                onClick={() => {
                                  setTargetGuestId(c._id);
                                  setGuestKeyword(
                                    `${c.memberNick} · ${c.memberPhone}`,
                                  );
                                }}
                                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                                  targetGuestId === c._id
                                    ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <p className="font-semibold text-slate-900">
                                  {c.memberNick}
                                </p>
                                <p className="text-slate-500">
                                  {c.memberFullName ?? "—"} · {c.memberPhone}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                        {debouncedGuestKeyword.length >= 2 &&
                          !guestCandidatesLoading &&
                          guestCandidates.length === 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs text-slate-500">
                                No members found. Enter member ID directly:
                              </p>
                              <input
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                                placeholder="Member ID"
                                value={targetGuestId}
                                onChange={(e) =>
                                  setTargetGuestId(e.target.value.trim())
                                }
                              />
                            </div>
                          )}
                        {targetGuestId && (
                          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <Check size={12} strokeWidth={3} /> Guest selected
                          </p>
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Reservation Details
                      </h2>
                      <div className="space-y-4">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Name for reservation{" "}
                            <span className="font-normal normal-case text-slate-400">
                              (optional)
                            </span>
                          </span>
                          <input
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            placeholder="Full name shown on booking"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Special requests{" "}
                            <span className="font-normal normal-case text-slate-400">
                              (optional)
                            </span>
                          </span>
                          <textarea
                            value={specialRequests}
                            onChange={(e) =>
                              setSpecialRequests(e.target.value)
                            }
                            rows={3}
                            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            placeholder="Late arrival, accessibility needs, room preference…"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Payment & Extras ── */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Payment Method
                      </h2>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {PAYMENT_METHODS_CONFIG.map((m) => (
                          <PaymentCard
                            key={m.value}
                            value={m.value}
                            label={m.label}
                            emoji={m.emoji}
                            selected={paymentMethod === m.value}
                            onSelect={() => setPaymentMethod(m.value)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Check-in / Check-out Options
                      </h2>
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setEarlyCheckIn((v) => !v)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                            earlyCheckIn
                              ? "border-sky-300 bg-sky-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              Early check-in
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              Before {hotel.checkInTime} · +₩30,000 per room
                            </p>
                          </div>
                          <div
                            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                              earlyCheckIn
                                ? "border-sky-500 bg-sky-500"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {earlyCheckIn && (
                              <Check
                                size={12}
                                className="text-white"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLateCheckOut((v) => !v)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                            lateCheckOut
                              ? "border-sky-300 bg-sky-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              Late check-out
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              After {hotel.checkOutTime} · +₩30,000 per room
                            </p>
                          </div>
                          <div
                            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                              lateCheckOut
                                ? "border-sky-500 bg-sky-500"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {lateCheckOut && (
                              <Check
                                size={12}
                                className="text-white"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                        </button>
                      </div>
                    </div>

                    {submitError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                        {submitError}
                      </div>
                    )}

                    {bookingValidationMessage && !submitError && (
                      <p className="text-center text-sm text-rose-500">
                        {bookingValidationMessage}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleConfirm()}
                      disabled={
                        creating || Boolean(bookingValidationMessage)
                      }
                      className="w-full rounded-full bg-sky-500 py-4 text-sm font-bold text-white shadow-md shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creating ? "Confirming…" : "Confirm Booking"}
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {step < 3 && (
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    disabled={
                      (step === 1 && !step1Valid) ||
                      (step === 2 && !step2Valid)
                    }
                    className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>

            {/* ── Right: sticky summary (desktop only) ── */}
            <aside className="hidden lg:block lg:w-80 lg:flex-shrink-0">
              <div className="sticky top-24">
                <PriceSummaryPanel
                  hotel={hotel}
                  room={room}
                  nights={nights}
                  quantity={quantity}
                  effectivePrice={effectivePrice}
                  priceSource={priceSource}
                  earlyCheckIn={earlyCheckIn}
                  lateCheckOut={lateCheckOut}
                />
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
};

NewBookingPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default NewBookingPage;
