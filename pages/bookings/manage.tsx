import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { StatusPills } from "@/components/ui/status-pills";
import {
  CANCEL_BOOKING_BY_OPERATOR_MUTATION,
  GET_AGENT_BOOKINGS_QUERY,
  UPDATE_BOOKING_STATUS_MUTATION,
  UPDATE_PAYMENT_STATUS_MUTATION,
} from "@/graphql/booking.gql";
import { GET_AGENT_HOTELS_QUERY, GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { usePaginationQueryState } from "@/lib/hooks/use-pagination-query-state";
import { getSessionMember } from "@/lib/auth/session";
import { confirmAction, confirmDanger, errorAlert, infoAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { formatDateKst, formatNumber } from "@/lib/utils/format";
import type {
  BookingListItem,
  BookingStatus,
  CancelBookingByOperatorMutationData,
  CancelBookingByOperatorMutationVars,
  GetAgentBookingsQueryData,
  GetAgentBookingsQueryVars,
  PaginationInput,
  PaymentStatus,
  UpdateBookingStatusMutationData,
  UpdateBookingStatusMutationVars,
  UpdatePaymentStatusMutationData,
  UpdatePaymentStatusMutationVars,
} from "@/types/booking";
import type {
  GetAgentHotelsQueryData,
  GetAgentHotelsQueryVars,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelListItem,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";

const PAGE_LIMIT = 10;
const HOTEL_LIST_LIMIT = 200;
const BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];
const PAYMENT_UPDATE_OPTIONS: PaymentStatus[] = ["PENDING", "PARTIAL", "PAID", "FAILED"];

const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["CHECKED_IN", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const parseEvidencePhotos = (value: string): string[] => {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const getStatusOptions = (currentStatus: BookingStatus): BookingStatus[] => {
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];
  return [currentStatus, ...nextStatuses];
};

interface OptimisticPatch {
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
}

const StaffBookingManagementPage: NextPageWithAuth = () => {
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const isAgent = memberType === "AGENT";
  const canAccess = memberType === "AGENT" || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const { page, statusFilter, getParam, pushQuery, replaceQuery } = usePaginationQueryState<BookingStatus>({
    pathname: "/bookings/manage",
    statusValues: BOOKING_STATUSES,
  });
  const hotelIdFromQuery = getParam("hotelId");

  const hotelListInput = useMemo<GetAgentHotelsQueryVars["input"]>(
    () => ({
      page: 1,
      limit: HOTEL_LIST_LIMIT,
      sort: "createdAt",
      direction: -1,
    }),
    [],
  );

  const { data: agentHotelsData, loading: agentHotelsLoading, error: agentHotelsError } = useQuery<
    GetAgentHotelsQueryData,
    GetAgentHotelsQueryVars
  >(GET_AGENT_HOTELS_QUERY, {
    skip: !isAgent,
    variables: {
      input: hotelListInput,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const { data: publicHotelsData, loading: publicHotelsLoading, error: publicHotelsError } = useQuery<
    GetHotelsQueryData,
    GetHotelsQueryVars
  >(GET_HOTELS_QUERY, {
    skip: !canAccess || isAgent,
    variables: {
      input: hotelListInput,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const availableHotels = useMemo<HotelListItem[]>(() => {
    if (isAgent) {
      return agentHotelsData?.getAgentHotels.list ?? [];
    }

    return publicHotelsData?.getHotels.list ?? [];
  }, [agentHotelsData?.getAgentHotels.list, isAgent, publicHotelsData?.getHotels.list]);

  const selectedHotelId = hotelIdFromQuery || availableHotels[0]?._id || "";

  useEffect(() => {
    if (hotelIdFromQuery || availableHotels.length === 0) {
      return;
    }

    replaceQuery({
      extra: { hotelId: availableHotels[0]._id },
    });
  }, [availableHotels, hotelIdFromQuery, replaceQuery]);

  const bookingInput = useMemo<PaginationInput>(
    () => ({
      page,
      limit: PAGE_LIMIT,
      sort: "createdAt",
      direction: -1,
    }),
    [page],
  );

  const {
    data: bookingsData,
    loading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery<GetAgentBookingsQueryData, GetAgentBookingsQueryVars>(GET_AGENT_BOOKINGS_QUERY, {
    skip: !selectedHotelId,
    variables: {
      hotelId: selectedHotelId,
      input: bookingInput,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [updateBookingStatus] = useMutation<UpdateBookingStatusMutationData, UpdateBookingStatusMutationVars>(
    UPDATE_BOOKING_STATUS_MUTATION,
  );
  const [updatePaymentStatus] = useMutation<UpdatePaymentStatusMutationData, UpdatePaymentStatusMutationVars>(
    UPDATE_PAYMENT_STATUS_MUTATION,
  );
  const [cancelBookingByOperator] = useMutation<
    CancelBookingByOperatorMutationData,
    CancelBookingByOperatorMutationVars
  >(CANCEL_BOOKING_BY_OPERATOR_MUTATION);

  const [statusDrafts, setStatusDrafts] = useState<Record<string, BookingStatus>>({});
  const [paymentStatusDrafts, setPaymentStatusDrafts] = useState<Record<string, PaymentStatus>>({});
  const [paidAmountDrafts, setPaidAmountDrafts] = useState<Record<string, string>>({});
  const [cancelReasonDrafts, setCancelReasonDrafts] = useState<Record<string, string>>({});
  const [cancelEvidenceDrafts, setCancelEvidenceDrafts] = useState<Record<string, string>>({});
  const [optimisticPatches, setOptimisticPatches] = useState<Record<string, OptimisticPatch>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [paymentUpdating, setPaymentUpdating] = useState<Record<string, boolean>>({});
  const [cancelUpdating, setCancelUpdating] = useState<Record<string, boolean>>({});

  const setUpdating = (
    setter: Dispatch<SetStateAction<Record<string, boolean>>>,
    bookingId: string,
    value: boolean,
  ) => {
    setter((prev) => {
      const next = { ...prev };
      if (value) {
        next[bookingId] = true;
      } else {
        delete next[bookingId];
      }
      return next;
    });
  };

  const replacePatch = (bookingId: string, patch?: OptimisticPatch) => {
    setOptimisticPatches((prev) => {
      const next = { ...prev };
      if (!patch || Object.keys(patch).length === 0) {
        delete next[bookingId];
      } else {
        next[bookingId] = patch;
      }
      return next;
    });
  };

  const applyPatch = (bookingId: string, patch: OptimisticPatch) => {
    setOptimisticPatches((prev) => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        ...patch,
      },
    }));
  };

  const clearPatchFields = (bookingId: string, fields: Array<keyof OptimisticPatch>) => {
    setOptimisticPatches((prev) => {
      const existing = prev[bookingId];
      if (!existing) {
        return prev;
      }

      const nextPatch: OptimisticPatch = { ...existing };
      fields.forEach((field) => {
        delete nextPatch[field];
      });

      const next = { ...prev };
      if (Object.keys(nextPatch).length === 0) {
        delete next[bookingId];
      } else {
        next[bookingId] = nextPatch;
      }
      return next;
    });
  };

  const sourceBookings = bookingsData?.getAgentBookings.list ?? [];
  const mergedBookings = sourceBookings.map((booking) => {
    const patch = optimisticPatches[booking._id];
    if (!patch) {
      return booking;
    }

    return {
      ...booking,
      ...patch,
    };
  });
  const visibleBookings =
    statusFilter === "ALL" ? mergedBookings : mergedBookings.filter((booking) => booking.bookingStatus === statusFilter);

  const total = bookingsData?.getAgentBookings.metaCounter.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const pushManageQuery = (next: { hotelId?: string; status?: BookingStatus | "ALL"; page?: number }) => {
    pushQuery({
      page: next.page,
      status: next.status,
      extra: { hotelId: next.hotelId ?? selectedHotelId },
    });
  };

  const handleStatusUpdate = async (booking: BookingListItem) => {
    const nextStatus = statusDrafts[booking._id] ?? booking.bookingStatus;
    if (nextStatus === booking.bookingStatus) {
      await infoAlert("No change detected", `Booking ${booking.bookingCode} already has status ${nextStatus}.`);
      return;
    }

    const confirmed = await confirmAction({
      title: `Update status for ${booking.bookingCode}?`,
      text: `${booking.bookingStatus} -> ${nextStatus}`,
      confirmText: "Update status",
    });
    if (!confirmed) {
      return;
    }

    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, { bookingStatus: nextStatus });
    setUpdating(setStatusUpdating, booking._id, true);

    try {
      await updateBookingStatus({
        variables: {
          bookingId: booking._id,
          status: nextStatus,
        },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["bookingStatus"]);
      setStatusDrafts((prev) => {
        const next = { ...prev };
        delete next[booking._id];
        return next;
      });
      await successAlert("Status updated", `Booking ${booking.bookingCode} status is now ${nextStatus}.`);
    } catch (error) {
      replacePatch(booking._id, previousPatch);
      await errorAlert("Status update failed", getErrorMessage(error));
    } finally {
      setUpdating(setStatusUpdating, booking._id, false);
    }
  };

  const handlePaymentUpdate = async (booking: BookingListItem) => {
    const nextPaymentStatus = paymentStatusDrafts[booking._id] ?? booking.paymentStatus;
    if (nextPaymentStatus === "REFUNDED") {
      await infoAlert("Use cancellation flow", "Use cancellation flow to mark bookings as refunded.");
      return;
    }

    const paidAmountRaw = paidAmountDrafts[booking._id] ?? String(booking.paidAmount);
    const nextPaidAmount = Number(paidAmountRaw);
    if (!Number.isInteger(nextPaidAmount) || nextPaidAmount < 0) {
      await errorAlert("Invalid paid amount", "Paid amount must be a non-negative integer.");
      return;
    }

    if (nextPaymentStatus === booking.paymentStatus && nextPaidAmount === booking.paidAmount) {
      await infoAlert("No change detected", `Payment values are unchanged for booking ${booking.bookingCode}.`);
      return;
    }

    const confirmed = await confirmAction({
      title: `Update payment for ${booking.bookingCode}?`,
      text: `Status: ${booking.paymentStatus} -> ${nextPaymentStatus}\nPaid: ₩ ${formatNumber(
        booking.paidAmount,
      )} -> ₩ ${formatNumber(nextPaidAmount)}`,
      confirmText: "Update payment",
    });
    if (!confirmed) {
      return;
    }

    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, { paymentStatus: nextPaymentStatus, paidAmount: nextPaidAmount });
    setUpdating(setPaymentUpdating, booking._id, true);

    try {
      await updatePaymentStatus({
        variables: {
          bookingId: booking._id,
          paymentStatus: nextPaymentStatus,
          paidAmount: nextPaidAmount,
        },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["paymentStatus", "paidAmount"]);
      setPaymentStatusDrafts((prev) => {
        const next = { ...prev };
        delete next[booking._id];
        return next;
      });
      setPaidAmountDrafts((prev) => {
        const next = { ...prev };
        delete next[booking._id];
        return next;
      });
      await successAlert("Payment updated", `Payment updated for booking ${booking.bookingCode}.`);
    } catch (error) {
      replacePatch(booking._id, previousPatch);
      await errorAlert("Payment update failed", getErrorMessage(error));
    } finally {
      setUpdating(setPaymentUpdating, booking._id, false);
    }
  };

  const handleOperatorCancel = async (booking: BookingListItem) => {
    if (booking.bookingStatus !== "PENDING" && booking.bookingStatus !== "CONFIRMED") {
      await infoAlert("Cancellation not allowed", "Only PENDING or CONFIRMED bookings can be cancelled.");
      return;
    }

    const reason = (cancelReasonDrafts[booking._id] ?? "").trim();
    if (reason.length < 5 || reason.length > 500) {
      await errorAlert("Invalid cancellation reason", "Cancellation reason must be between 5 and 500 characters.");
      return;
    }

    const confirmed = await confirmDanger({
      title: `Cancel booking ${booking.bookingCode}?`,
      text: "This action sets booking status to CANCELLED and follows operator cancellation policy.",
      warningText: "This should only be used for approved cancellation cases.",
      confirmText: "Yes, cancel booking",
    });
    if (!confirmed) {
      return;
    }

    const evidencePhotos = parseEvidencePhotos(cancelEvidenceDrafts[booking._id] ?? "");
    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, { bookingStatus: "CANCELLED" });
    setUpdating(setCancelUpdating, booking._id, true);

    try {
      await cancelBookingByOperator({
        variables: {
          bookingId: booking._id,
          reason,
          evidencePhotos: evidencePhotos.length > 0 ? evidencePhotos : undefined,
        },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["bookingStatus"]);
      setCancelReasonDrafts((prev) => {
        const next = { ...prev };
        delete next[booking._id];
        return next;
      });
      setCancelEvidenceDrafts((prev) => {
        const next = { ...prev };
        delete next[booking._id];
        return next;
      });
      await successAlert("Booking cancelled", `Booking ${booking.bookingCode} has been cancelled.`);
    } catch (error) {
      replacePatch(booking._id, previousPatch);
      await errorAlert("Cancellation failed", getErrorMessage(error));
    } finally {
      setUpdating(setCancelUpdating, booking._id, false);
    }
  };

  const hotelsLoading = canAccess && (agentHotelsLoading || publicHotelsLoading);
  const hotelsError = agentHotelsError ?? publicHotelsError;

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operations</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Staff Booking Management</h1>
          <p className="mt-2 text-sm text-slate-600">Manage booking state, payment, and cancellation per hotel.</p>
        </div>
        <Link
          href="/bookings/new"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          Create booking
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Hotel</span>
            <select
              value={selectedHotelId}
              onChange={(event) => pushManageQuery({ hotelId: event.target.value, page: 1 })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              disabled={availableHotels.length === 0}
            >
              {availableHotels.length === 0 ? <option value="">No hotels available</option> : null}
              {availableHotels.map((hotel) => (
                <option key={hotel._id} value={hotel._id}>
                  {hotel.hotelTitle} ({hotel.hotelLocation})
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="mb-2 block text-sm font-medium text-slate-700">Status Filter</p>
            <StatusPills
              label="Status"
              options={BOOKING_STATUSES}
              selected={statusFilter}
              onSelect={(nextStatus) => pushManageQuery({ status: nextStatus as BookingStatus | "ALL", page: 1 })}
            />
          </div>
        </div>
      </section>

      {hotelsLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading hotel list...</section>
      ) : null}
      {hotelsError ? <ErrorNotice message={getErrorMessage(hotelsError)} /> : null}
      {bookingsError ? <ErrorNotice message={getErrorMessage(bookingsError)} /> : null}

      {!selectedHotelId && !hotelsLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No hotel selected. Add/select a hotel to manage bookings.
        </section>
      ) : null}

      {bookingsLoading && sourceBookings.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading bookings...</section>
      ) : null}

      {!bookingsLoading && !bookingsError && selectedHotelId && visibleBookings.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No bookings found for this hotel/filter.
        </section>
      ) : null}

      {visibleBookings.length > 0 ? (
        <section className="grid gap-4">
          {visibleBookings.map((booking) => {
            const statusOptions = getStatusOptions(booking.bookingStatus);
            const selectedStatus = statusDrafts[booking._id] ?? booking.bookingStatus;
            const selectedPaymentStatus = paymentStatusDrafts[booking._id] ?? booking.paymentStatus;
            const paidAmountInput = paidAmountDrafts[booking._id] ?? String(booking.paidAmount);
            const paymentOptions = PAYMENT_UPDATE_OPTIONS.includes(selectedPaymentStatus)
              ? PAYMENT_UPDATE_OPTIONS
              : [selectedPaymentStatus, ...PAYMENT_UPDATE_OPTIONS];
            const canUpdateStatus = statusOptions.length > 1 && selectedStatus !== booking.bookingStatus;
            const paymentLocked = booking.bookingStatus === "CANCELLED" || booking.bookingStatus === "NO_SHOW";
            const canUpdatePayment =
              !paymentLocked &&
              (selectedPaymentStatus !== booking.paymentStatus || Number(paidAmountInput) !== booking.paidAmount);
            const canCancel = booking.bookingStatus === "PENDING" || booking.bookingStatus === "CONFIRMED";

            return (
              <article key={booking._id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Booking</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{booking.bookingCode}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDateKst(booking.checkInDate)} - {formatDateKst(booking.checkOutDate)}
                    </p>
                    {memberType !== "ADMIN_OPERATOR" ? (
                      <p className="mt-1">
                        <Link href={`/bookings/${booking._id}`} className="text-xs font-semibold text-slate-700 underline underline-offset-4">
                          View details
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm text-slate-700">
                    <p>Total: ₩ {formatNumber(booking.totalPrice)}</p>
                    <p>Paid: ₩ {formatNumber(booking.paidAmount)}</p>
                    <p className="font-mono text-xs text-slate-500">Guest: {booking.guestId}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Booking Status</p>
                    <select
                      value={selectedStatus}
                      onChange={(event) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [booking._id]: event.target.value as BookingStatus,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        void handleStatusUpdate(booking);
                      }}
                      disabled={!canUpdateStatus || Boolean(statusUpdating[booking._id])}
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {statusUpdating[booking._id] ? "Updating..." : "Update status"}
                    </button>
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Payment Status</p>
                    <select
                      value={selectedPaymentStatus}
                      onChange={(event) =>
                        setPaymentStatusDrafts((prev) => ({
                          ...prev,
                          [booking._id]: event.target.value as PaymentStatus,
                        }))
                      }
                      disabled={paymentLocked}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-60"
                    >
                      {paymentOptions.map((paymentStatus) => (
                        <option key={paymentStatus} value={paymentStatus}>
                          {paymentStatus}
                        </option>
                      ))}
                    </select>
                    <input
                      value={paidAmountInput}
                      onChange={(event) =>
                        setPaidAmountDrafts((prev) => ({
                          ...prev,
                          [booking._id]: event.target.value.replace(/[^\d]/g, ""),
                        }))
                      }
                      inputMode="numeric"
                      disabled={paymentLocked}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-60"
                      placeholder="Paid amount"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handlePaymentUpdate(booking);
                      }}
                      disabled={!canUpdatePayment || paymentLocked || Boolean(paymentUpdating[booking._id])}
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {paymentUpdating[booking._id] ? "Updating..." : "Update payment"}
                    </button>
                    {paymentLocked ? (
                      <p className="text-xs text-slate-500">Payment updates are blocked for CANCELLED/NO_SHOW bookings.</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Operator Cancellation</p>
                  <textarea
                    value={cancelReasonDrafts[booking._id] ?? ""}
                    onChange={(event) =>
                      setCancelReasonDrafts((prev) => ({
                        ...prev,
                        [booking._id]: event.target.value,
                      }))
                    }
                    className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                    placeholder="Cancellation reason (required)"
                    disabled={!canCancel}
                  />
                  <textarea
                    value={cancelEvidenceDrafts[booking._id] ?? ""}
                    onChange={(event) =>
                      setCancelEvidenceDrafts((prev) => ({
                        ...prev,
                        [booking._id]: event.target.value,
                      }))
                    }
                    className="min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                    placeholder="Evidence URLs (optional, one per line)"
                    disabled={!canCancel}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleOperatorCancel(booking);
                    }}
                    disabled={!canCancel || Boolean(cancelUpdating[booking._id])}
                    className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelUpdating[booking._id] ? "Cancelling..." : "Cancel booking"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-600">
          Page {page} / {totalPages} · Total records: {formatNumber(total)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => pushManageQuery({ page: page - 1 })}
            disabled={page <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => pushManageQuery({ page: page + 1 })}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </footer>
    </main>
  );
};

StaffBookingManagementPage.auth = {
  roles: ["AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default StaffBookingManagementPage;
