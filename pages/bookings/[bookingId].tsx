import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  CANCEL_BOOKING_BY_OPERATOR_MUTATION,
  CANCEL_BOOKING_MUTATION,
  GET_BOOKING_QUERY,
} from "@/graphql/booking.gql";
import { CREATE_REVIEW_MUTATION } from "@/graphql/review.gql";
import { getSessionMember } from "@/lib/auth/session";
import { confirmDanger, errorAlert, infoAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { formatDateTimeKst, formatNumber } from "@/lib/utils/format";
import { Star } from "lucide-react";
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
      {label && <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>}
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

const CANCELLABLE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

const parseEvidencePhotos = (value: string): string[] => {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const BookingDetailPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const bookingId = typeof router.query.bookingId === "string" ? router.query.bookingId : "";

  const [reason, setReason] = useState("");
  const [evidenceRaw, setEvidenceRaw] = useState("");

  // ── Review form state ──
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [locationRating, setLocationRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [amenitiesRating, setAmenitiesRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");

  const { data, loading, error, refetch } = useQuery<GetBookingQueryData, GetBookingQueryVars>(GET_BOOKING_QUERY, {
    skip: !bookingId,
    variables: { bookingId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [cancelBooking, { loading: cancellingAsGuest }] = useMutation<CancelBookingMutationData, CancelBookingMutationVars>(
    CANCEL_BOOKING_MUTATION,
  );
  const [cancelBookingByOperator, { loading: cancellingAsOperator }] = useMutation<
    CancelBookingByOperatorMutationData,
    CancelBookingByOperatorMutationVars
  >(CANCEL_BOOKING_BY_OPERATOR_MUTATION);
  const [createReview, { loading: submittingReview }] = useMutation(CREATE_REVIEW_MUTATION);

  const booking = data?.getBooking;
  const memberType = member?.memberType;
  const isStaff = memberType === "AGENT" || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const isGuestOwner = Boolean(member && booking && member._id === booking.guestId);
  const canWriteReview = isGuestOwner && memberType === "USER" && booking?.bookingStatus === "CHECKED_OUT" && !reviewSubmitted;

  const submitReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!booking) return;
    if (overallRating === 0) {
      await errorAlert("Rating required", "Please select an overall rating before submitting.");
      return;
    }
    if (reviewText.trim().length < 10) {
      await errorAlert("Review too short", "Your review must be at least 10 characters.");
      return;
    }
    try {
      await createReview({
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
      setReviewSubmitted(true);
      setShowReviewForm(false);
      await successAlert("Review submitted!", "Thank you for sharing your experience.");
    } catch (err) {
      await errorAlert("Failed to submit review", getErrorMessage(err));
    }
  };
  const canCancelAsGuest = isGuestOwner;
  const canCancelAsOperator = Boolean(booking && !isGuestOwner && isStaff);
  const isCancellable = Boolean(booking && CANCELLABLE_STATUSES.includes(booking.bookingStatus));
  const cancelLoading = cancellingAsGuest || cancellingAsOperator;

  const submitCancellation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!booking) {
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 500) {
      await errorAlert("Invalid cancellation reason", "Reason must be between 5 and 500 characters.");
      return;
    }

    if (!isCancellable) {
      await infoAlert("Cancellation not allowed", "Only PENDING or CONFIRMED bookings can be cancelled.");
      return;
    }

    const evidencePhotos = parseEvidencePhotos(evidenceRaw);
    const confirmed = await confirmDanger({
      title: `Cancel booking ${booking.bookingCode}?`,
      text: "This action will move the booking to CANCELLED and apply cancellation rules.",
      warningText: "You cannot undo this from the current UI.",
      confirmText: "Yes, cancel booking",
    });
    if (!confirmed) {
      return;
    }

    try {
      if (canCancelAsGuest) {
        await cancelBooking({
          variables: {
            bookingId: booking._id,
            reason: trimmedReason,
            evidencePhotos: evidencePhotos.length > 0 ? evidencePhotos : undefined,
          },
        });
      } else if (canCancelAsOperator) {
        await cancelBookingByOperator({
          variables: {
            bookingId: booking._id,
            reason: trimmedReason,
            evidencePhotos: evidencePhotos.length > 0 ? evidencePhotos : undefined,
          },
        });
      } else {
        await errorAlert("Permission denied", "You do not have permission to cancel this booking.");
        return;
      }

      await refetch();
      setReason("");
      setEvidenceRaw("");
      await successAlert("Booking cancelled", `Booking ${booking.bookingCode} has been cancelled.`);
    } catch (mutationError) {
      await errorAlert("Cancellation failed", getErrorMessage(mutationError));
    }
  };

  if (!bookingId) {
    return (
      <main className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Missing booking id.
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/bookings" className="text-slate-600 underline underline-offset-4">
          My bookings
        </Link>
        <Link href="/bookings/manage" className="text-slate-600 underline underline-offset-4">
          Manage bookings
        </Link>
      </div>

      {error ? <ErrorNotice message={getErrorMessage(error)} /> : null}

      {loading && !booking ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Loading booking...
        </section>
      ) : null}

      {booking ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Booking Detail</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{booking.bookingCode}</h1>

            <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
              <p>Status: <span className="font-semibold">{booking.bookingStatus}</span></p>
              <p>Payment: <span className="font-semibold">{booking.paymentStatus}</span></p>
              <p>Payment Method: <span className="font-semibold">{booking.paymentMethod}</span></p>
              <p>Total: <span className="font-semibold">₩ {formatNumber(booking.totalPrice)}</span></p>
              <p>Paid: <span className="font-semibold">₩ {formatNumber(booking.paidAmount)}</span></p>
              <p>Nights: <span className="font-semibold">{booking.nights}</span></p>
              <p>Check-in: <span className="font-semibold">{formatDateTimeKst(booking.checkInDate)}</span></p>
              <p>Check-out: <span className="font-semibold">{formatDateTimeKst(booking.checkOutDate)}</span></p>
              <p>Created: <span className="font-semibold">{formatDateTimeKst(booking.createdAt)}</span></p>
              <p>Guest ID: <span className="font-mono text-xs">{booking.guestId}</span></p>
              <p>Hotel ID: <span className="font-mono text-xs">{booking.hotelId}</span></p>
              <p>
                Refund:{" "}
                <span className="font-semibold">
                  {booking.refundAmount != null ? `₩ ${formatNumber(booking.refundAmount)}` : "-"}
                </span>
              </p>
            </div>

            {booking.specialRequests ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Special requests: {booking.specialRequests}
              </div>
            ) : null}

            {booking.cancellationReason ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <p>
                  Cancellation flow: <span className="font-semibold">{booking.cancellationFlow ?? "N/A"}</span>
                </p>
                <p>Reason: {booking.cancellationReason}</p>
                {booking.cancellationDate ? (
                  <p>Cancelled at: {formatDateTimeKst(booking.cancellationDate)}</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Booked Rooms</h2>
            <div className="mt-3 grid gap-2">
              {booking.rooms.map((room) => (
                <div key={`${room.roomId}-${room.roomType}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-900">{room.roomType}</p>
                  <p className="text-slate-700">Quantity: {room.quantity}</p>
                  <p className="text-slate-700">Price/Night: ₩ {formatNumber(room.pricePerNight)}</p>
                  {room.guestName ? <p className="text-slate-700">Guest Name: {room.guestName}</p> : null}
                </div>
              ))}
            </div>
          </section>

          {/* ── Write a review ── */}
          {canWriteReview && !showReviewForm && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">How was your stay?</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Share your experience to help other travelers.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(true)}
                  className="flex-shrink-0 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
                >
                  Write a review
                </button>
              </div>
            </section>
          )}

          {canWriteReview && showReviewForm && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Write a Review</h2>
              <form onSubmit={submitReview} className="space-y-5">
                {/* Overall rating */}
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Overall rating <span className="text-rose-500">*</span></p>
                  <StarPicker value={overallRating} onChange={setOverallRating} size="md" />
                </div>

                {/* Dimension ratings */}
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-700">Rate specific aspects <span className="text-slate-400 font-normal text-xs">(optional)</span></p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StarPicker label="Cleanliness" value={cleanlinessRating} onChange={setCleanlinessRating} size="sm" />
                    <StarPicker label="Location" value={locationRating} onChange={setLocationRating} size="sm" />
                    <StarPicker label="Value" value={valueRating} onChange={setValueRating} size="sm" />
                    <StarPicker label="Service" value={serviceRating} onChange={setServiceRating} size="sm" />
                    <StarPicker label="Amenities" value={amenitiesRating} onChange={setAmenitiesRating} size="sm" />
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Title <span className="text-slate-400 font-normal text-xs">(optional)</span></span>
                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      maxLength={100}
                      placeholder="Summarize your stay"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </label>
                </div>

                {/* Content */}
                <div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Your review <span className="text-rose-500">*</span></span>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      placeholder="Tell us about your experience (at least 10 characters)"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 resize-none"
                    />
                    <span className="mt-0.5 block text-right text-xs text-slate-400">{reviewText.length}/1000</span>
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
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
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Cancellation</h2>
            {!isCancellable ? (
              <p className="mt-2 text-sm text-slate-600">This booking cannot be cancelled in its current status.</p>
            ) : null}
            {isCancellable && !canCancelAsGuest && !canCancelAsOperator ? (
              <p className="mt-2 text-sm text-slate-600">You do not have cancellation permission for this booking.</p>
            ) : null}
            {isCancellable && (canCancelAsGuest || canCancelAsOperator) ? (
              <form onSubmit={submitCancellation} className="mt-3 space-y-3">
                <p className="text-sm text-slate-600">
                  Flow: <span className="font-semibold">{canCancelAsGuest ? "GUEST" : "OPERATOR"}</span>
                </p>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Reason</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                    placeholder="Reason for cancellation"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Evidence URLs (optional)</span>
                  <textarea
                    value={evidenceRaw}
                    onChange={(event) => setEvidenceRaw(event.target.value)}
                    className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                    placeholder="https://...\nhttps://..."
                  />
                </label>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLoading ? "Cancelling..." : "Cancel booking"}
                </button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
};

BookingDetailPage.auth = {
  roles: ["USER", "AGENT", "ADMIN"],
};

export default BookingDetailPage;
