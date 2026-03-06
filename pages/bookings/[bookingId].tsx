import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  CANCEL_BOOKING_BY_OPERATOR_MUTATION,
  CANCEL_BOOKING_MUTATION,
  GET_BOOKING_QUERY,
} from "@/graphql/booking.gql";
import {
  CREATE_REVIEW_MUTATION,
  GET_MY_REVIEWS_QUERY,
} from "@/graphql/review.gql";
import { GET_HOTEL_CARD_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { confirmDanger, errorAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { formatNumber } from "@/lib/utils/format";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  MapPin,
  MessageSquare,
  Moon,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import type {
  BookingStatus,
  CancelBookingByOperatorMutationData,
  CancelBookingByOperatorMutationVars,
  CancelBookingMutationData,
  CancelBookingMutationVars,
  GetBookingQueryData,
  GetBookingQueryVars,
} from "@/types/booking";
import type { NextPageWithAuth } from "@/types/page";

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<BookingStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-700",
  CHECKED_IN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CHECKED_OUT: "border-slate-200 bg-slate-50 text-slate-600",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-600",
  NO_SHOW: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

const PAYMENT_BADGE: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  PARTIAL: "border-violet-200 bg-violet-50 text-violet-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-600",
  REFUNDED: "border-slate-200 bg-slate-50 text-slate-600",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  AT_HOTEL: "Pay at hotel",
  CREDIT_CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  KAKAOPAY: "Kakao Pay",
  NAVERPAY: "Naver Pay",
  TOSS: "Toss",
};

const CANCELLABLE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface GetHotelCardData {
  getHotel: {
    _id: string;
    hotelTitle: string;
    hotelImages: string[];
    hotelLocation?: string;
  };
}

interface ReviewDto {
  _id: string;
  bookingId: string;
  overallRating: number;
  cleanlinessRating: number;
  locationRating: number;
  valueRating: number;
  serviceRating: number;
  amenitiesRating: number;
  reviewTitle?: string | null;
  reviewText: string;
  createdAt: string;
}

interface GetMyReviewsData {
  getMyReviews: { list: ReviewDto[] };
}

interface CreateReviewMutationData {
  createReview: ReviewDto;
}

interface CreateReviewMutationVars {
  input: {
    bookingId: string;
    overallRating: number;
    cleanlinessRating: number;
    locationRating: number;
    valueRating: number;
    serviceRating: number;
    amenitiesRating: number;
    reviewTitle?: string;
    reviewText: string;
  };
}

// ─── Star picker ─────────────────────────────────────────────────────────────

function StarPicker({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState(0);
  const sz = size === "sm" ? 14 : 20;
  return (
    <div>
      {label && (
        <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      )}
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition"
            aria-label={`${star} star`}
          >
            <Star
              size={sz}
              className={`${(hover || value) >= star ? "fill-amber-400 text-amber-400" : "text-slate-200"} transition`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── StarDisplay ─────────────────────────────────────────────────────────────

function StarDisplay({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label && <p className="mb-1 text-xs text-slate-400">{label}</p>}
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={13}
            className={
              value >= star ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const parseEvidencePhotos = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

// ─── Status timeline ─────────────────────────────────────────────────────────

const NORMAL_FLOW: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
];

function StatusTimeline({ current }: { current: BookingStatus }) {
  const isCancelled = current === "CANCELLED" || current === "NO_SHOW";
  const currentIdx = NORMAL_FLOW.indexOf(current);

  return (
    <div className="flex items-center gap-0">
      {NORMAL_FLOW.map((step, i) => {
        const isCompleted = !isCancelled && currentIdx > i;
        const isCurrent = !isCancelled && currentIdx === i;
        const label = STATUS_LABEL[step];

        return (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              {isCompleted ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
              ) : isCurrent ? (
                <div className="relative flex h-[18px] w-[18px] items-center justify-center">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-sky-400/30" />
                  <Circle size={18} className="fill-sky-500 text-sky-500" />
                </div>
              ) : isCancelled && i === 0 ? (
                <XCircle size={18} className="text-rose-400" />
              ) : (
                <Circle size={18} className="text-slate-200" />
              )}
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.06em] ${
                  isCompleted
                    ? "text-emerald-600"
                    : isCurrent
                      ? "text-sky-600"
                      : "text-slate-300"
                }`}
              >
                {label}
              </span>
            </div>
            {i < NORMAL_FLOW.length - 1 && (
              <div
                className={`mx-1 h-px flex-1 ${
                  !isCancelled && currentIdx > i
                    ? "bg-emerald-300"
                    : "bg-slate-100"
                }`}
              />
            )}
          </div>
        );
      })}
      {isCancelled && (
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <XCircle size={18} className="text-rose-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-rose-500">
            {STATUS_LABEL[current]}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Detail row helper ───────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
        <Icon size={14} className="text-slate-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium text-slate-800">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const BookingDetailPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const bookingId =
    typeof router.query.bookingId === "string" ? router.query.bookingId : "";

  // Cancellation state
  const [reason, setReason] = useState("");
  const [evidenceRaw, setEvidenceRaw] = useState("");

  // Review state — postedReview covers the current session after submission
  const [postedReview, setPostedReview] = useState<ReviewDto | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [locationRating, setLocationRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [amenitiesRating, setAmenitiesRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");

  const { data, loading, error, refetch } = useQuery<
    GetBookingQueryData,
    GetBookingQueryVars
  >(GET_BOOKING_QUERY, {
    skip: !bookingId,
    variables: { bookingId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const booking = data?.getBooking;

  const { data: hotelData } = useQuery<GetHotelCardData>(GET_HOTEL_CARD_QUERY, {
    variables: { hotelId: booking?.hotelId },
    skip: !booking?.hotelId,
    fetchPolicy: "cache-first",
  });

  // Fetch user's reviews to detect a pre-existing review for this booking
  // (covers the case where the user reviewed in a prior session and postedReview is null)
  const isEligibleForReview =
    memberType === "USER" &&
    Boolean(member && booking && member._id === booking.guestId) &&
    booking?.bookingStatus === "CHECKED_OUT";

  const { data: myReviewsData } = useQuery<GetMyReviewsData>(
    GET_MY_REVIEWS_QUERY,
    {
      skip: !isEligibleForReview,
      variables: {
        input: { page: 1, limit: 100, sort: "createdAt", direction: -1 },
      },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  );

  const existingReview = useMemo(
    () =>
      myReviewsData?.getMyReviews.list.find(
        (r) => r.bookingId === booking?._id,
      ) ?? null,
    [myReviewsData, booking],
  );

  const [cancelBooking, { loading: cancellingAsGuest }] = useMutation<
    CancelBookingMutationData,
    CancelBookingMutationVars
  >(CANCEL_BOOKING_MUTATION, {
    refetchQueries: ["getBooking", "getMyBookings"],
  });

  const [cancelBookingByOperator, { loading: cancellingAsOperator }] =
    useMutation<
      CancelBookingByOperatorMutationData,
      CancelBookingByOperatorMutationVars
    >(CANCEL_BOOKING_BY_OPERATOR_MUTATION, {
      refetchQueries: ["getBooking", "getMyBookings", "getAgentBookings"],
    });

  const [createReview, { loading: submittingReview }] = useMutation<
    CreateReviewMutationData,
    CreateReviewMutationVars
  >(CREATE_REVIEW_MUTATION, {
    refetchQueries: ["getMyReviews", "getBooking"],
  });

  const hotel = hotelData?.getHotel;
  const isStaff =
    memberType === "AGENT" ||
    memberType === "ADMIN" ||
    memberType === "ADMIN_OPERATOR";
  const isGuestOwner = Boolean(
    member && booking && member._id === booking.guestId,
  );
  // Review can only be written if: guest owner, USER role, checked-out, AND no existing review (any session)
  const displayedReview = existingReview ?? postedReview;
  const canWriteReview = isEligibleForReview && !displayedReview;
  const isCancellable = Boolean(
    booking && CANCELLABLE_STATUSES.includes(booking.bookingStatus),
  );
  const canCancelAsGuest = isGuestOwner && isCancellable;
  const canCancelAsOperator = Boolean(
    booking && !isGuestOwner && isStaff && isCancellable,
  );
  const cancelLoading = cancellingAsGuest || cancellingAsOperator;

  const submitReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!booking) return;
    if (overallRating === 0) {
      await errorAlert(
        "Rating required",
        "Please select an overall rating before submitting.",
      );
      return;
    }
    if (reviewText.trim().length < 10) {
      await errorAlert(
        "Review too short",
        "Your review must be at least 10 characters.",
      );
      return;
    }
    try {
      const result = await createReview({
        variables: {
          input: {
            bookingId: booking._id,
            overallRating,
            cleanlinessRating: cleanlinessRating || overallRating,
            locationRating: locationRating || overallRating,
            valueRating: valueRating || overallRating,
            serviceRating: serviceRating || overallRating,
            amenitiesRating: amenitiesRating || overallRating,
            reviewTitle: reviewTitle.trim() || undefined,
            reviewText: reviewText.trim(),
          },
        },
      });
      setPostedReview(result.data?.createReview ?? null);
      setShowReviewForm(false);
      await successAlert(
        "Review submitted!",
        "Thank you for sharing your experience.",
      );
    } catch (err) {
      await errorAlert("Failed to submit review", getErrorMessage(err));
    }
  };

  const submitCancellation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!booking) return;

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 500) {
      await errorAlert(
        "Invalid reason",
        "Reason must be between 5 and 500 characters.",
      );
      return;
    }

    const confirmed = await confirmDanger({
      title: `Cancel booking ${booking.bookingCode}?`,
      text: "This will move the booking to CANCELLED status.",
      warningText: "This cannot be undone.",
      confirmText: "Yes, cancel booking",
    });
    if (!confirmed) return;

    const evidencePhotos = parseEvidencePhotos(evidenceRaw);
    try {
      if (canCancelAsGuest) {
        await cancelBooking({
          variables: {
            bookingId: booking._id,
            reason: trimmedReason,
            evidencePhotos:
              evidencePhotos.length > 0 ? evidencePhotos : undefined,
          },
        });
      } else {
        await cancelBookingByOperator({
          variables: {
            bookingId: booking._id,
            reason: trimmedReason,
            evidencePhotos:
              evidencePhotos.length > 0 ? evidencePhotos : undefined,
          },
        });
      }
      await refetch();
      setReason("");
      setEvidenceRaw("");
      await successAlert(
        "Booking cancelled",
        `Booking ${booking.bookingCode} has been cancelled.`,
      );
    } catch (err) {
      await errorAlert("Cancellation failed", getErrorMessage(err));
    }
  };

  if (!bookingId) {
    return (
      <main>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
          Missing booking ID.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={14} />
        Back to bookings
      </Link>

      {error && <ErrorNotice message={getErrorMessage(error)} />}

      {loading && !booking && (
        <div className="space-y-4">
          <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}

      {booking && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ════════════════ Left column ════════════════ */}
          <div className="space-y-5">
            {/* ── Hotel hero card ────────────────────────────────────────── */}
            <div className="motion-fade-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_-4px_rgba(15,23,42,0.08)]">
              {hotel?.hotelImages[0] && (
                <div className="relative h-48 w-full sm:h-56">
                  <Image
                    src={hotel.hotelImages[0]}
                    alt={hotel.hotelTitle}
                    fill
                    sizes="(max-width: 1024px) 100vw, 660px"
                    className="object-cover"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  {/* Floating hotel name */}
                  <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                    <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-white drop-shadow-sm sm:text-2xl">
                      {hotel?.hotelTitle ??
                        `Hotel #${booking.hotelId.slice(-6)}`}
                    </p>
                    {hotel?.hotelLocation && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                        <MapPin size={11} />
                        <span>{hotel.hotelLocation}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!hotel?.hotelImages[0] && (
                <div className="px-5 pt-5">
                  <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">
                    {hotel?.hotelTitle ?? `Hotel #${booking.hotelId.slice(-6)}`}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-500">
                    {booking.bookingCode}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${STATUS_BADGE[booking.bookingStatus] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}
                  >
                    {STATUS_LABEL[booking.bookingStatus] ??
                      booking.bookingStatus}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${PAYMENT_BADGE[booking.paymentStatus] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}
                  >
                    {PAYMENT_LABEL[booking.paymentStatus] ??
                      booking.paymentStatus}
                  </span>
                </div>
                {hotel && (
                  <Link
                    href={`/hotels/${hotel._id}`}
                    className="flex-shrink-0 text-xs font-semibold text-slate-500 underline underline-offset-2 transition hover:text-slate-900"
                  >
                    View hotel
                  </Link>
                )}
              </div>
            </div>

            {/* ── Status timeline ────────────────────────────────────────── */}
            <div className="motion-fade-up motion-delay-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Booking progress
              </p>
              <StatusTimeline current={booking.bookingStatus} />
            </div>

            {/* ── Booking details ────────────────────────────────────────── */}
            <div className="motion-fade-up motion-delay-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Reservation details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow icon={CalendarDays} label="Check-in">
                  {formatDate(booking.checkInDate)}
                </DetailRow>
                <DetailRow icon={CalendarDays} label="Check-out">
                  {formatDate(booking.checkOutDate)}
                </DetailRow>
                <DetailRow icon={Moon} label="Duration">
                  {booking.nights} night{booking.nights !== 1 ? "s" : ""}
                </DetailRow>
                <DetailRow icon={Users} label="Guests">
                  {booking.adultCount} adult
                  {booking.adultCount !== 1 ? "s" : ""}
                  {booking.childCount > 0 &&
                    `, ${booking.childCount} child${booking.childCount !== 1 ? "ren" : ""}`}
                </DetailRow>
                {booking.paymentMethod && (
                  <DetailRow icon={CreditCard} label="Payment method">
                    {PAYMENT_METHOD_LABEL[booking.paymentMethod] ??
                      booking.paymentMethod}
                  </DetailRow>
                )}
                <DetailRow icon={Clock} label="Booked on">
                  {formatDate(booking.createdAt)}
                </DetailRow>
              </div>

              {booking.specialRequests && (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Special requests
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {booking.specialRequests}
                  </p>
                </div>
              )}
            </div>

            {/* ── Booked rooms ───────────────────────────────────────────── */}
            <div className="motion-fade-up motion-delay-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Rooms
              </p>
              <div className="space-y-2.5">
                {booking.rooms.map((room) => (
                  <div
                    key={`${room.roomId}-${room.roomType}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {room.roomType}
                      </p>
                      {room.guestName && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          Guest: {room.guestName}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-700">
                        ₩{formatNumber(room.pricePerNight)}
                        <span className="text-xs font-normal text-slate-400">
                          /night
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        × {room.quantity} room{room.quantity !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Cancellation info (read-only) ─────────────────────────── */}
            {booking.cancellationReason && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">
                  Cancellation
                </p>
                <p className="mt-2 text-sm text-rose-800">
                  {booking.cancellationReason}
                </p>
                {booking.cancellationDate && (
                  <p className="mt-1.5 text-xs text-rose-400">
                    Cancelled on {formatDate(booking.cancellationDate)}
                    {booking.cancellationFlow &&
                      ` · ${booking.cancellationFlow.toLowerCase()} flow`}
                  </p>
                )}
              </div>
            )}

            {/* ── Existing or just-posted review (read-only) ────────────── */}
            {displayedReview && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">
                    Your review
                  </p>
                  <StarDisplay value={displayedReview.overallRating} />
                </div>
                {displayedReview.reviewTitle && (
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    {displayedReview.reviewTitle}
                  </p>
                )}
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {displayedReview.reviewText}
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <StarDisplay
                    value={displayedReview.cleanlinessRating}
                    label="Cleanliness"
                  />
                  <StarDisplay
                    value={displayedReview.locationRating}
                    label="Location"
                  />
                  <StarDisplay
                    value={displayedReview.valueRating}
                    label="Value"
                  />
                  <StarDisplay
                    value={displayedReview.serviceRating}
                    label="Service"
                  />
                  <StarDisplay
                    value={displayedReview.amenitiesRating}
                    label="Amenities"
                  />
                </div>
              </div>
            )}

            {/* ── Write a review prompt ──────────────────────────────────── */}
            {canWriteReview && !showReviewForm && (
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-900">
                    How was your stay?
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Share your experience to help other travelers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(true)}
                  className="flex-shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Write a review
                </button>
              </div>
            )}

            {/* ── Review form ────────────────────────────────────────────── */}
            {canWriteReview && showReviewForm && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Write a review
                </p>
                <form onSubmit={submitReview} className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      Overall rating <span className="text-rose-500">*</span>
                    </p>
                    <StarPicker
                      value={overallRating}
                      onChange={setOverallRating}
                      size="md"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      Rate specific aspects{" "}
                      <span className="text-xs font-normal text-slate-400">
                        (optional)
                      </span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <StarPicker
                        label="Cleanliness"
                        value={cleanlinessRating}
                        onChange={setCleanlinessRating}
                        size="sm"
                      />
                      <StarPicker
                        label="Location"
                        value={locationRating}
                        onChange={setLocationRating}
                        size="sm"
                      />
                      <StarPicker
                        label="Value"
                        value={valueRating}
                        onChange={setValueRating}
                        size="sm"
                      />
                      <StarPicker
                        label="Service"
                        value={serviceRating}
                        onChange={setServiceRating}
                        size="sm"
                      />
                      <StarPicker
                        label="Amenities"
                        value={amenitiesRating}
                        onChange={setAmenitiesRating}
                        size="sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Title{" "}
                      <span className="text-xs font-normal text-slate-400">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      maxLength={100}
                      placeholder="Summarize your stay"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Your review <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      placeholder="Tell us about your experience (at least 10 characters)"
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                    <p className="mt-0.5 text-right text-xs text-slate-400">
                      {reviewText.length}/1000
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                    >
                      {submittingReview ? "Submitting..." : "Submit review"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Cancellation form ──────────────────────────────────────── */}
            {(canCancelAsGuest || canCancelAsOperator) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">
                  Cancel booking
                </p>
                <form onSubmit={submitCancellation} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Reason for cancellation (5–500 characters)"
                      required
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Evidence photos{" "}
                      <span className="text-xs font-normal text-slate-400">
                        (optional, one URL per line)
                      </span>
                    </label>
                    <textarea
                      value={evidenceRaw}
                      onChange={(e) => setEvidenceRaw(e.target.value)}
                      rows={2}
                      placeholder="https://..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={cancelLoading}
                    className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {cancelLoading ? "Cancelling..." : "Cancel booking"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* ════════════════ Right column (Price sidebar) ════════════════ */}
          <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {/* ── Price breakdown ────────────────────────────────────────── */}
            <div className="motion-fade-up motion-delay-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Price breakdown
              </p>
              <div className="space-y-2 text-sm">
                {booking.subtotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Subtotal ({booking.nights} night
                      {booking.nights !== 1 ? "s" : ""})
                    </span>
                    <span>₩{formatNumber(booking.subtotal)}</span>
                  </div>
                )}
                {booking.earlyCheckInFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Early check-in</span>
                    <span>+₩{formatNumber(booking.earlyCheckInFee)}</span>
                  </div>
                )}
                {booking.lateCheckOutFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Late check-out</span>
                    <span>+₩{formatNumber(booking.lateCheckOutFee)}</span>
                  </div>
                )}
                {booking.weekendSurcharge > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Weekend surcharge</span>
                    <span>+₩{formatNumber(booking.weekendSurcharge)}</span>
                  </div>
                )}
                {booking.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>−₩{formatNumber(booking.discount)}</span>
                  </div>
                )}
                {booking.taxes > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>+₩{formatNumber(booking.taxes)}</span>
                  </div>
                )}
                {booking.serviceFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service fee</span>
                    <span>+₩{formatNumber(booking.serviceFee)}</span>
                  </div>
                )}

                <div className="my-2 border-t border-slate-100" />

                <div className="flex justify-between font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">
                  <span>Total</span>
                  <span>₩{formatNumber(booking.totalPrice)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Paid</span>
                  <span>₩{formatNumber(booking.paidAmount)}</span>
                </div>
                {booking.paidAmount < booking.totalPrice &&
                  booking.bookingStatus !== "CANCELLED" &&
                  booking.bookingStatus !== "NO_SHOW" &&
                  booking.paymentStatus !== "REFUNDED" && (
                    <div className="flex justify-between font-medium text-amber-600">
                      <span>Remaining</span>
                      <span>
                        ₩{formatNumber(booking.totalPrice - booking.paidAmount)}
                      </span>
                    </div>
                  )}
                {booking.refundAmount != null && booking.refundAmount > 0 && (
                  <div className="flex justify-between font-medium text-emerald-600">
                    <span>Refund</span>
                    <span>₩{formatNumber(booking.refundAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Quick info card ────────────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Quick info
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking code</span>
                  <span className="font-mono font-medium text-slate-800">
                    {booking.bookingCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-slate-800">
                    {STATUS_LABEL[booking.bookingStatus]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment</span>
                  <span className="font-medium text-slate-800">
                    {PAYMENT_LABEL[booking.paymentStatus] ??
                      booking.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Check-in</span>
                  <span className="font-medium text-slate-800">
                    {formatDateShort(booking.checkInDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Check-out</span>
                  <span className="font-medium text-slate-800">
                    {formatDateShort(booking.checkOutDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

BookingDetailPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default BookingDetailPage;
