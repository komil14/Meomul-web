import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useToast } from "@/components/ui/toast-provider";
import {
  CANCEL_BOOKING_BY_OPERATOR_MUTATION,
  CANCEL_BOOKING_MUTATION,
  GET_BOOKING_QUERY,
} from "@/graphql/booking.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
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

const CANCELLABLE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

const formatDate = (value: string): string => new Date(value).toLocaleString();

const parseEvidencePhotos = (value: string): string[] => {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const BookingDetailPage: NextPageWithAuth = () => {
  const router = useRouter();
  const toast = useToast();
  const member = useMemo(() => getSessionMember(), []);
  const bookingId = typeof router.query.bookingId === "string" ? router.query.bookingId : "";

  const [reason, setReason] = useState("");
  const [evidenceRaw, setEvidenceRaw] = useState("");

  const { data, loading, error, refetch } = useQuery<GetBookingQueryData, GetBookingQueryVars>(GET_BOOKING_QUERY, {
    skip: !bookingId,
    variables: { bookingId },
    fetchPolicy: "cache-and-network",
  });

  const [cancelBooking, { loading: cancellingAsGuest }] = useMutation<CancelBookingMutationData, CancelBookingMutationVars>(
    CANCEL_BOOKING_MUTATION,
  );
  const [cancelBookingByOperator, { loading: cancellingAsOperator }] = useMutation<
    CancelBookingByOperatorMutationData,
    CancelBookingByOperatorMutationVars
  >(CANCEL_BOOKING_BY_OPERATOR_MUTATION);

  const booking = data?.getBooking;
  const memberType = member?.memberType;
  const isStaff = memberType === "AGENT" || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const isGuestOwner = Boolean(member && booking && member._id === booking.guestId);
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
      toast.error("Cancellation reason must be between 5 and 500 characters.");
      return;
    }

    if (!isCancellable) {
      toast.info("Only PENDING/CONFIRMED bookings can be cancelled.");
      return;
    }

    const evidencePhotos = parseEvidencePhotos(evidenceRaw);

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
        toast.error("You do not have permission to cancel this booking.");
        return;
      }

      await refetch();
      setReason("");
      setEvidenceRaw("");
      toast.success(`Booking ${booking.bookingCode} cancelled.`);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
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

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {getErrorMessage(error)}
        </section>
      ) : null}

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
              <p>Total: <span className="font-semibold">₩ {booking.totalPrice.toLocaleString()}</span></p>
              <p>Paid: <span className="font-semibold">₩ {booking.paidAmount.toLocaleString()}</span></p>
              <p>Nights: <span className="font-semibold">{booking.nights}</span></p>
              <p>Check-in: <span className="font-semibold">{formatDate(booking.checkInDate)}</span></p>
              <p>Check-out: <span className="font-semibold">{formatDate(booking.checkOutDate)}</span></p>
              <p>Created: <span className="font-semibold">{formatDate(booking.createdAt)}</span></p>
              <p>Guest ID: <span className="font-mono text-xs">{booking.guestId}</span></p>
              <p>Hotel ID: <span className="font-mono text-xs">{booking.hotelId}</span></p>
              <p>
                Refund:{" "}
                <span className="font-semibold">
                  {booking.refundAmount != null ? `₩ ${booking.refundAmount.toLocaleString()}` : "-"}
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
                  <p>Cancelled at: {formatDate(booking.cancellationDate)}</p>
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
                  <p className="text-slate-700">Price/Night: ₩ {room.pricePerNight.toLocaleString()}</p>
                  {room.guestName ? <p className="text-slate-700">Guest Name: {room.guestName}</p> : null}
                </div>
              ))}
            </div>
          </section>

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
