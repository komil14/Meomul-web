import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  CANCEL_BOOKING_BY_OPERATOR_MUTATION,
  GET_AGENT_BOOKINGS_QUERY,
  GET_ALL_BOOKINGS_ADMIN_QUERY,
  UPDATE_BOOKING_STATUS_MUTATION,
  UPDATE_PAYMENT_STATUS_MUTATION,
} from "@/graphql/booking.gql";
import { GET_AGENT_HOTELS_QUERY, GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { usePaginationQueryState } from "@/lib/hooks/use-pagination-query-state";
import { getSessionMember } from "@/lib/auth/session";
import {
  confirmAction,
  confirmDanger,
  errorAlert,
  infoAlert,
  successAlert,
} from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { formatDateKst, formatNumber } from "@/lib/utils/format";
import type {
  BookingListItem,
  BookingStatus,
  CancelBookingByOperatorMutationData,
  CancelBookingByOperatorMutationVars,
  GetAgentBookingsQueryData,
  GetAgentBookingsQueryVars,
  GetAllBookingsAdminQueryData,
  GetAllBookingsAdminQueryVars,
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
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  Search,
  X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 15;
const HOTEL_LIST_LIMIT = 100;
const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];
const PAYMENT_UPDATE_OPTIONS: PaymentStatus[] = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "FAILED",
];

const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["CHECKED_IN", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// ─── Style Maps ───────────────────────────────────────────────────────────────

const BOOKING_STATUS_STYLE: Record<
  BookingStatus,
  { label: string; cls: string }
> = {
  PENDING: {
    label: "Pending",
    cls: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  CONFIRMED: {
    label: "Confirmed",
    cls: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  CHECKED_IN: {
    label: "Checked In",
    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  CHECKED_OUT: {
    label: "Checked Out",
    cls: "bg-slate-100 text-slate-600 border border-slate-200",
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "bg-rose-50 text-rose-600 border border-rose-200",
  },
  NO_SHOW: {
    label: "No Show",
    cls: "bg-orange-50 text-orange-600 border border-orange-200",
  },
};

const PAYMENT_STATUS_STYLE: Record<
  PaymentStatus,
  { label: string; dot: string }
> = {
  PENDING: { label: "Pending", dot: "bg-amber-400" },
  PARTIAL: { label: "Partial", dot: "bg-blue-400" },
  PAID: { label: "Paid", dot: "bg-emerald-400" },
  FAILED: { label: "Failed", dot: "bg-rose-400" },
  REFUNDED: { label: "Refunded", dot: "bg-slate-300" },
};

const NEXT_ACTION: Record<
  BookingStatus,
  { label: string; cls: string } | null
> = {
  PENDING: {
    label: "Confirm →",
    cls: "bg-sky-500 text-white hover:bg-sky-600",
  },
  CONFIRMED: {
    label: "Check-in →",
    cls: "bg-emerald-500 text-white hover:bg-emerald-600",
  },
  CHECKED_IN: {
    label: "Check-out →",
    cls: "bg-slate-700 text-white hover:bg-slate-800",
  },
  CHECKED_OUT: null,
  CANCELLED: null,
  NO_SHOW: null,
};

const STATUS_FILTER_STYLE: Record<BookingStatus | "ALL", { dot: string }> = {
  ALL: { dot: "" },
  PENDING: { dot: "bg-amber-400" },
  CONFIRMED: { dot: "bg-sky-400" },
  CHECKED_IN: { dot: "bg-emerald-400" },
  CHECKED_OUT: { dot: "bg-slate-400" },
  CANCELLED: { dot: "bg-rose-400" },
  NO_SHOW: { dot: "bg-orange-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseEvidencePhotos = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const nightsBetween = (checkIn: string, checkOut: string): number =>
  Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
  );

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptimisticPatch {
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
}

type ModalState = {
  type: "status" | "payment" | "cancel";
  bookingId: string;
} | null;

// ─── Sub-components ───────────────────────────────────────────────────────────

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const StaffBookingManagementPage: NextPageWithAuth = () => {
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const isAgent = memberType === "AGENT";
  const isAdmin = memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const canAccess = isAgent || isAdmin;

  const { page, statusFilter, getParam, pushQuery, replaceQuery } =
    usePaginationQueryState<BookingStatus>({
      pathname: "/bookings/manage",
      statusValues: BOOKING_STATUSES,
    });
  const hotelIdFromQuery = getParam("hotelId");

  // ─── Modal / draft state ──────────────────────────────────────────────────

  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [statusDraft, setStatusDraft] = useState<BookingStatus | null>(null);
  const [paymentStatusDraft, setPaymentStatusDraft] =
    useState<PaymentStatus | null>(null);
  const [paidAmountDraft, setPaidAmountDraft] = useState<string>("");
  const [cancelReasonDraft, setCancelReasonDraft] = useState<string>("");
  const [cancelEvidenceDraft, setCancelEvidenceDraft] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Admin-specific filters
  const [adminHotelFilter, setAdminHotelFilter] = useState<string>("ALL");
  const [codeSearch, setCodeSearch] = useState<string>("");

  // Optimistic patches
  const [optimisticPatches, setOptimisticPatches] = useState<
    Record<string, OptimisticPatch>
  >({});

  // ─── Optimistic patch helpers (same logic as before) ──────────────────────

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
      [bookingId]: { ...prev[bookingId], ...patch },
    }));
  };

  const clearPatchFields = (
    bookingId: string,
    fields: Array<keyof OptimisticPatch>,
  ) => {
    setOptimisticPatches((prev) => {
      const existing = prev[bookingId];
      if (!existing) return prev;
      const nextPatch: OptimisticPatch = { ...existing };
      fields.forEach((f) => delete nextPatch[f]);
      const next = { ...prev };
      if (Object.keys(nextPatch).length === 0) delete next[bookingId];
      else next[bookingId] = nextPatch;
      return next;
    });
  };

  // ─── Hotel list inputs ────────────────────────────────────────────────────

  const hotelListInput = useMemo<GetAgentHotelsQueryVars["input"]>(
    () => ({
      page: 1,
      limit: HOTEL_LIST_LIMIT,
      sort: "createdAt",
      direction: -1,
    }),
    [],
  );

  // ─── Hotel queries ────────────────────────────────────────────────────────

  const {
    data: agentHotelsData,
    loading: agentHotelsLoading,
    error: agentHotelsError,
  } = useQuery<GetAgentHotelsQueryData, GetAgentHotelsQueryVars>(
    GET_AGENT_HOTELS_QUERY,
    {
      skip: !isAgent,
      variables: { input: hotelListInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: publicHotelsData,
    loading: publicHotelsLoading,
    error: publicHotelsError,
  } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    skip: !isAdmin,
    variables: { input: hotelListInput },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const availableHotels = useMemo<HotelListItem[]>(
    () =>
      isAgent
        ? (agentHotelsData?.getAgentHotels.list ?? [])
        : (publicHotelsData?.getHotels.list ?? []),
    [agentHotelsData, isAgent, publicHotelsData],
  );

  const hotelsMap = useMemo<Map<string, HotelListItem>>(() => {
    const map = new Map<string, HotelListItem>();
    for (const h of availableHotels) map.set(h._id, h);
    return map;
  }, [availableHotels]);

  // Agent: selected hotel from URL param; "ALL" shows cross-hotel summary
  const selectedHotelId = isAgent ? hotelIdFromQuery || "ALL" : "";

  useEffect(() => {
    if (!isAgent || hotelIdFromQuery) return;
    // Default to "ALL" — no auto-redirect needed
  }, [hotelIdFromQuery, isAgent]);

  // ─── Booking queries ──────────────────────────────────────────────────────

  const bookingInput = useMemo<PaginationInput>(
    () => ({ page, limit: PAGE_LIMIT, sort: "createdAt", direction: -1 }),
    [page],
  );

  const {
    data: agentBookingsData,
    loading: agentBookingsLoading,
    error: agentBookingsError,
    refetch: refetchAgentBookings,
  } = useQuery<GetAgentBookingsQueryData, GetAgentBookingsQueryVars>(
    GET_AGENT_BOOKINGS_QUERY,
    {
      skip: !isAgent || !selectedHotelId || selectedHotelId === "ALL",
      variables: { hotelId: selectedHotelId, input: bookingInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: adminBookingsData,
    loading: adminBookingsLoading,
    error: adminBookingsError,
    refetch: refetchAdminBookings,
  } = useQuery<GetAllBookingsAdminQueryData, GetAllBookingsAdminQueryVars>(
    GET_ALL_BOOKINGS_ADMIN_QUERY,
    {
      skip: !isAdmin,
      variables: {
        input: bookingInput,
        statusFilter: statusFilter === "ALL" ? undefined : statusFilter,
      },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const refetchBookings = isAdmin ? refetchAdminBookings : refetchAgentBookings;

  // ─── Mutations ────────────────────────────────────────────────────────────

  const [updateBookingStatus] = useMutation<
    UpdateBookingStatusMutationData,
    UpdateBookingStatusMutationVars
  >(UPDATE_BOOKING_STATUS_MUTATION, {
    refetchQueries: ["getAgentBookings", "getAllBookingsAdmin"],
  });

  const [updatePaymentStatus] = useMutation<
    UpdatePaymentStatusMutationData,
    UpdatePaymentStatusMutationVars
  >(UPDATE_PAYMENT_STATUS_MUTATION, {
    refetchQueries: ["getAgentBookings", "getAllBookingsAdmin"],
  });

  const [cancelBookingByOperator] = useMutation<
    CancelBookingByOperatorMutationData,
    CancelBookingByOperatorMutationVars
  >(CANCEL_BOOKING_BY_OPERATOR_MUTATION, {
    refetchQueries: ["getAgentBookings", "getAllBookingsAdmin"],
  });

  // ─── Derived data ─────────────────────────────────────────────────────────

  const sourceBookings: BookingListItem[] = isAdmin
    ? (adminBookingsData?.getAllBookingsAdmin.list ?? [])
    : (agentBookingsData?.getAgentBookings.list ?? []);

  const mergedBookings = sourceBookings.map((b) => {
    const patch = optimisticPatches[b._id];
    return patch ? { ...b, ...patch } : b;
  });

  const visibleBookings = useMemo(() => {
    let list = mergedBookings;
    // Agent: server filters by status already. Admin: server also filters by status.
    // Agent: additionally client-filter from URL statusFilter on top of server data
    if (isAgent && statusFilter !== "ALL") {
      list = list.filter((b) => b.bookingStatus === statusFilter);
    }
    // Admin: client-side hotel filter
    if (isAdmin && adminHotelFilter !== "ALL") {
      list = list.filter((b) => b.hotelId === adminHotelFilter);
    }
    // Booking code search
    if (codeSearch.trim()) {
      const q = codeSearch.trim().toUpperCase();
      list = list.filter((b) => b.bookingCode.toUpperCase().includes(q));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mergedBookings,
    statusFilter,
    isAgent,
    isAdmin,
    adminHotelFilter,
    codeSearch,
  ]);

  const total = isAdmin
    ? (adminBookingsData?.getAllBookingsAdmin.metaCounter.total ?? 0)
    : (agentBookingsData?.getAgentBookings.metaCounter.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const bookingsLoading = isAdmin ? adminBookingsLoading : agentBookingsLoading;
  const bookingsError = isAdmin ? adminBookingsError : agentBookingsError;
  const hotelsLoading = isAgent ? agentHotelsLoading : publicHotelsLoading;
  const hotelsError = agentHotelsError ?? publicHotelsError;

  const activeBooking = activeModal
    ? (mergedBookings.find((b) => b._id === activeModal.bookingId) ?? null)
    : null;

  // ─── Modal helpers ────────────────────────────────────────────────────────

  const openModal = (
    type: "status" | "payment" | "cancel",
    bookingId: string,
  ) => {
    const b = mergedBookings.find((x) => x._id === bookingId);
    if (!b) return;
    if (type === "status") {
      setStatusDraft(null); // user selects in modal
    } else if (type === "payment") {
      setPaymentStatusDraft(b.paymentStatus);
      setPaidAmountDraft(String(b.paidAmount));
    } else {
      setCancelReasonDraft("");
      setCancelEvidenceDraft("");
    }
    setActiveModal({ type, bookingId });
  };

  const closeModal = () => {
    setActiveModal(null);
    setStatusDraft(null);
    setPaymentStatusDraft(null);
    setPaidAmountDraft("");
    setCancelReasonDraft("");
    setCancelEvidenceDraft("");
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (
    booking: BookingListItem,
    nextStatus: BookingStatus,
  ) => {
    if (nextStatus === booking.bookingStatus) {
      await infoAlert("No change", `Status is already ${nextStatus}.`);
      return;
    }
    const confirmed = await confirmAction({
      title: `Update status for ${booking.bookingCode}?`,
      text: `${booking.bookingStatus} → ${nextStatus}`,
      confirmText: "Update status",
    });
    if (!confirmed) return;

    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, { bookingStatus: nextStatus });
    setSubmitting(true);
    try {
      await updateBookingStatus({
        variables: { bookingId: booking._id, status: nextStatus },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["bookingStatus"]);
      closeModal();
      await successAlert(
        "Status updated",
        `${booking.bookingCode} is now ${nextStatus}.`,
      );
    } catch (err) {
      replacePatch(booking._id, previousPatch);
      await errorAlert("Update failed", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentUpdate = async (booking: BookingListItem) => {
    const nextPaymentStatus = paymentStatusDraft ?? booking.paymentStatus;
    if (nextPaymentStatus === "REFUNDED") {
      await infoAlert(
        "Use cancellation flow",
        "Use the cancel action to mark as refunded.",
      );
      return;
    }
    const nextPaidAmount = Number(paidAmountDraft);
    if (!Number.isInteger(nextPaidAmount) || nextPaidAmount < 0) {
      await errorAlert(
        "Invalid amount",
        "Paid amount must be a non-negative integer.",
      );
      return;
    }
    if (
      nextPaymentStatus === booking.paymentStatus &&
      nextPaidAmount === booking.paidAmount
    ) {
      await infoAlert("No change", "Payment values are unchanged.");
      return;
    }

    const confirmed = await confirmAction({
      title: `Update payment for ${booking.bookingCode}?`,
      text: `Status: ${booking.paymentStatus} → ${nextPaymentStatus}\nPaid: ₩${formatNumber(booking.paidAmount)} → ₩${formatNumber(nextPaidAmount)}`,
      confirmText: "Update payment",
    });
    if (!confirmed) return;

    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, {
      paymentStatus: nextPaymentStatus,
      paidAmount: nextPaidAmount,
    });
    setSubmitting(true);
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
      closeModal();
      await successAlert(
        "Payment updated",
        `Payment updated for ${booking.bookingCode}.`,
      );
    } catch (err) {
      replacePatch(booking._id, previousPatch);
      await errorAlert("Update failed", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOperatorCancel = async (booking: BookingListItem) => {
    if (
      booking.bookingStatus !== "PENDING" &&
      booking.bookingStatus !== "CONFIRMED"
    ) {
      await infoAlert(
        "Not cancellable",
        "Only PENDING or CONFIRMED bookings can be cancelled.",
      );
      return;
    }
    const reason = cancelReasonDraft.trim();
    if (reason.length < 5 || reason.length > 500) {
      await errorAlert(
        "Invalid reason",
        "Cancellation reason must be 5–500 characters.",
      );
      return;
    }
    const confirmed = await confirmDanger({
      title: `Cancel booking ${booking.bookingCode}?`,
      text: "This sets booking status to CANCELLED and follows operator cancellation policy.",
      warningText: "Only use this for approved cancellation cases.",
      confirmText: "Yes, cancel booking",
    });
    if (!confirmed) return;

    const evidencePhotos = parseEvidencePhotos(cancelEvidenceDraft);
    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, { bookingStatus: "CANCELLED" });
    setSubmitting(true);
    try {
      await cancelBookingByOperator({
        variables: {
          bookingId: booking._id,
          reason,
          evidencePhotos:
            evidencePhotos.length > 0 ? evidencePhotos : undefined,
        },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["bookingStatus"]);
      closeModal();
      await successAlert(
        "Cancelled",
        `Booking ${booking.bookingCode} has been cancelled.`,
      );
    } catch (err) {
      replacePatch(booking._id, previousPatch);
      await errorAlert("Cancellation failed", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const pushManageQuery = (next: {
    hotelId?: string;
    status?: BookingStatus | "ALL";
    page?: number;
  }) => {
    pushQuery({
      page: next.page,
      status: next.status,
      extra: isAgent ? { hotelId: next.hotelId ?? selectedHotelId } : undefined,
    });
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rowFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* ── Action Modals ── */}
      {activeModal && activeBooking && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={closeModal}
          />
          <div
            className="fixed inset-x-4 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
            style={{
              animation: "modalSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            {/* Modal drag handle (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-200" />
            </div>

            {/* ── Status Modal ── */}
            {activeModal.type === "status" && (
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Update Booking Status
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {activeBooking.bookingCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm text-slate-500">Current:</span>
                  <BookingStatusBadge status={activeBooking.bookingStatus} />
                </div>

                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Advance to
                </p>
                <div className="space-y-2">
                  {STATUS_TRANSITIONS[activeBooking.bookingStatus].length ===
                  0 ? (
                    <p className="text-sm text-slate-500">
                      No further status transitions available.
                    </p>
                  ) : (
                    STATUS_TRANSITIONS[activeBooking.bookingStatus].map(
                      (nextStatus) => {
                        const style = BOOKING_STATUS_STYLE[nextStatus];
                        return (
                          <button
                            key={nextStatus}
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              void handleStatusUpdate(activeBooking, nextStatus)
                            }
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${style.cls}`}
                          >
                            <span>{style.label}</span>
                            <span className="text-xs opacity-70">→</span>
                          </button>
                        );
                      },
                    )
                  )}
                </div>
              </div>
            )}

            {/* ── Payment Modal ── */}
            {activeModal.type === "payment" && (
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Update Payment
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {activeBooking.bookingCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Payment Status
                    </label>
                    <select
                      value={paymentStatusDraft ?? activeBooking.paymentStatus}
                      onChange={(e) =>
                        setPaymentStatusDraft(e.target.value as PaymentStatus)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none ring-sky-400 transition focus:ring-2"
                    >
                      {(PAYMENT_UPDATE_OPTIONS.includes(
                        activeBooking.paymentStatus,
                      )
                        ? PAYMENT_UPDATE_OPTIONS
                        : [
                            activeBooking.paymentStatus,
                            ...PAYMENT_UPDATE_OPTIONS,
                          ]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {PAYMENT_STATUS_STYLE[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Paid Amount (₩)
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition focus-within:border-slate-300 focus-within:bg-white">
                      <span className="text-sm font-semibold text-slate-400">
                        ₩
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={paidAmountDraft}
                        onChange={(e) =>
                          setPaidAmountDraft(
                            e.target.value.replace(/[^\d]/g, ""),
                          )
                        }
                        className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
                        placeholder="0"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Total: ₩{formatNumber(activeBooking.totalPrice)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handlePaymentUpdate(activeBooking)}
                  className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {submitting ? "Updating…" : "Update Payment"}
                </button>
              </div>
            )}

            {/* ── Cancel Modal ── */}
            {activeModal.type === "cancel" && (
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Cancel Booking
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {activeBooking.bookingCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <AlertTriangle
                    size={15}
                    className="mt-0.5 flex-shrink-0 text-rose-500"
                  />
                  <p className="text-sm text-rose-700">
                    This action is irreversible. Only cancel for approved cases
                    following operator cancellation policy.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Cancellation Reason{" "}
                      <span className="font-normal text-slate-400">
                        ({cancelReasonDraft.length}/500 chars, min 5)
                      </span>
                    </label>
                    <textarea
                      value={cancelReasonDraft}
                      onChange={(e) => setCancelReasonDraft(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Describe the reason for cancellation…"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-400 transition focus:border-slate-300 focus:bg-white focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Evidence URLs{" "}
                      <span className="font-normal text-slate-400">
                        (optional, one per line)
                      </span>
                    </label>
                    <textarea
                      value={cancelEvidenceDraft}
                      onChange={(e) => setCancelEvidenceDraft(e.target.value)}
                      rows={2}
                      placeholder="https://example.com/evidence.jpg"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-400 transition focus:border-slate-300 focus:bg-white focus:ring-2"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting || cancelReasonDraft.trim().length < 5}
                  onClick={() => void handleOperatorCancel(activeBooking)}
                  className="mt-5 w-full rounded-2xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {submitting ? "Cancelling…" : "Cancel Booking"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Page ── */}
      <main className="space-y-5">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Operations
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Booking Management
            </h1>
          </div>
          <Link
            href="/bookings/new"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <SquarePen size={14} className="text-slate-500" />
            New Booking
          </Link>
        </header>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Agent: hotel selector */}
          {isAgent &&
            (hotelsLoading ? (
              <div className="h-9 w-48 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <select
                value={selectedHotelId}
                onChange={(e) =>
                  pushManageQuery({ hotelId: e.target.value, page: 1 })
                }
                disabled={availableHotels.length === 0}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none ring-sky-400 transition focus:ring-2"
              >
                <option value="ALL">All Hotels</option>
                {availableHotels.length === 0 && (
                  <option value="">No hotels</option>
                )}
                {availableHotels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.hotelTitle}
                  </option>
                ))}
              </select>
            ))}

          {/* Admin: hotel filter (client-side) */}
          {isAdmin && (
            <select
              value={adminHotelFilter}
              onChange={(e) => {
                setAdminHotelFilter(e.target.value);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none ring-sky-400 transition focus:ring-2"
            >
              <option value="ALL">All hotels</option>
              {availableHotels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.hotelTitle}
                </option>
              ))}
            </select>
          )}

          {/* Booking code search */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-slate-300">
            <Search size={13} className="flex-shrink-0 text-slate-400" />
            <input
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              placeholder="Search code…"
              className="w-28 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
            />
            {codeSearch && (
              <button
                type="button"
                onClick={() => setCodeSearch("")}
                className="flex-shrink-0 text-slate-400 transition hover:text-slate-600"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", ...BOOKING_STATUSES] as const).map((s) => {
              const isSelected = statusFilter === s;
              const dot =
                s !== "ALL" ? STATUS_FILTER_STYLE[s as BookingStatus].dot : "";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    pushManageQuery({
                      status: s as BookingStatus | "ALL",
                      page: 1,
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {dot && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-white/70" : dot
                      }`}
                    />
                  )}
                  {s === "ALL"
                    ? "All"
                    : BOOKING_STATUS_STYLE[s as BookingStatus].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Errors */}
        {hotelsError && <ErrorNotice message={getErrorMessage(hotelsError)} />}
        {bookingsError && (
          <ErrorNotice message={getErrorMessage(bookingsError)} />
        )}

        {/* Agent "All Hotels" summary view */}
        {isAgent && selectedHotelId === "ALL" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Hotels Overview
            </p>
            {hotelsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : availableHotels.length === 0 ? (
              <p className="text-sm text-slate-400">No hotels found.</p>
            ) : (
              <div className="space-y-3">
                {availableHotels.map((h) => (
                  <div
                    key={h._id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {h.hotelTitle}
                      </p>
                      <p className="text-xs text-slate-500">
                        {h.hotelLocation} · {h.hotelType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        pushManageQuery({ hotelId: h._id, page: 1 })
                      }
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      View bookings →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking table */}
        {(!isAgent || selectedHotelId !== "ALL") && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Code
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Guest / Room
                    </th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Hotel
                      </th>
                    )}
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Dates
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {/* Loading skeletons */}
                  {bookingsLoading &&
                    sourceBookings.length === 0 &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: isAdmin ? 7 : 6 }).map(
                          (__, j) => (
                            <td key={j} className="px-5 py-4">
                              <div className="h-3.5 w-full animate-pulse rounded-full bg-slate-100" />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}

                  {/* Empty state row */}
                  {!bookingsLoading &&
                    !bookingsError &&
                    visibleBookings.length === 0 && (
                      <tr>
                        <td
                          colSpan={isAdmin ? 7 : 6}
                          className="px-5 py-16 text-center"
                        >
                          <p className="font-semibold text-slate-700">
                            No bookings found
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {!selectedHotelId && isAgent
                              ? "Select a hotel to view bookings"
                              : "Try adjusting the status filter or search"}
                          </p>
                        </td>
                      </tr>
                    )}

                  {/* Booking rows */}
                  {visibleBookings.map((b, i) => {
                    const guestName =
                      b.rooms[0]?.guestName ||
                      `Guest ···${b.guestId.slice(-6).toUpperCase()}`;
                    const roomSummary = b.rooms
                      .map((r) => `${r.quantity}× ${r.roomType}`)
                      .join(", ");
                    const nights = nightsBetween(b.checkInDate, b.checkOutDate);
                    const hotelName =
                      hotelsMap.get(b.hotelId)?.hotelTitle ??
                      `Hotel ···${b.hotelId.slice(-4)}`;
                    const nextAction = NEXT_ACTION[b.bookingStatus];
                    const paymentLocked =
                      b.bookingStatus === "CANCELLED" ||
                      b.bookingStatus === "NO_SHOW";
                    const canCancel =
                      b.bookingStatus === "PENDING" ||
                      b.bookingStatus === "CONFIRMED";

                    return (
                      <tr
                        key={b._id}
                        className="group transition hover:bg-slate-50/50"
                        style={{
                          animation: "rowFadeIn 0.2s ease-out both",
                          animationDelay: `${i * 20}ms`,
                        }}
                      >
                        {/* Code */}
                        <td className="px-5 py-3.5">
                          {memberType !== "ADMIN_OPERATOR" ? (
                            <Link
                              href={`/bookings/${b._id}`}
                              className="font-mono text-xs font-semibold text-sky-600 hover:underline"
                            >
                              {b.bookingCode}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {b.bookingCode}
                            </span>
                          )}
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {new Date(b.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </td>

                        {/* Guest / Room */}
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-slate-900">
                            {guestName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {roomSummary}
                          </p>
                        </td>

                        {/* Hotel (admin only) */}
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            <p className="text-sm text-slate-700">
                              {hotelName}
                            </p>
                          </td>
                        )}

                        {/* Dates */}
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-slate-700">
                            {formatDateKst(b.checkInDate)} →{" "}
                            {formatDateKst(b.checkOutDate)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {nights} night{nights !== 1 ? "s" : ""}
                          </p>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-3.5 text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            ₩{formatNumber(b.totalPrice)}
                          </p>
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <PaymentStatusBadge status={b.paymentStatus} />
                          </div>
                          {b.paidAmount > 0 && (
                            <p className="text-[10px] text-slate-400">
                              Paid: ₩{formatNumber(b.paidAmount)}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <BookingStatusBadge status={b.bookingStatus} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Status advance */}
                            {nextAction && (
                              <button
                                type="button"
                                onClick={() => openModal("status", b._id)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${nextAction.cls}`}
                              >
                                {nextAction.label}
                              </button>
                            )}
                            {/* No-show (for CONFIRMED with no next action button) */}
                            {b.bookingStatus === "CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() => openModal("status", b._id)}
                                className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 transition hover:bg-orange-100"
                              >
                                ⋯
                              </button>
                            )}
                            {/* Payment */}
                            {!paymentLocked && (
                              <button
                                type="button"
                                onClick={() => openModal("payment", b._id)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                              >
                                ₩ Pay
                              </button>
                            )}
                            {/* Cancel */}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => openModal("cancel", b._id)}
                                className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-500">
                  Page{" "}
                  <span className="font-semibold text-slate-700">{page}</span> /{" "}
                  <span className="font-semibold text-slate-700">
                    {totalPages}
                  </span>{" "}
                  · {formatNumber(total)} total
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => pushManageQuery({ page: page - 1 })}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => pushManageQuery({ page: page + 1 })}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
};

StaffBookingManagementPage.auth = {
  roles: ["AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default StaffBookingManagementPage;
