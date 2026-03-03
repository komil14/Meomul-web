import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_MY_BOOKINGS_QUERY } from "@/graphql/booking.gql";
import { GET_HOTEL_CARD_QUERY } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import { CalendarDays, ChevronRight } from "lucide-react";
import type {
  BookingListItem,
  BookingStatus,
  GetMyBookingsQueryData,
  GetMyBookingsQueryVars,
  PaginationInput,
} from "@/types/booking";
import type { NextPageWithAuth } from "@/types/page";

// ─── Constants & maps ─────────────────────────────────────────────────────────

const PAGE_LIMIT = 10;
const BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];

const STATUS_BADGE: Record<BookingStatus, string> = {
  PENDING:     "bg-amber-50 text-amber-700",
  CONFIRMED:   "bg-sky-50 text-sky-700",
  CHECKED_IN:  "bg-emerald-50 text-emerald-700",
  CHECKED_OUT: "bg-slate-100 text-slate-600",
  CANCELLED:   "bg-rose-50 text-rose-600",
  NO_SHOW:     "bg-zinc-100 text-zinc-600",
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING:     "Pending",
  CONFIRMED:   "Confirmed",
  CHECKED_IN:  "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED:   "Cancelled",
  NO_SHOW:     "No show",
};

const PAYMENT_BADGE: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700",
  PARTIAL:  "bg-violet-50 text-violet-700",
  PAID:     "bg-emerald-50 text-emerald-700",
  FAILED:   "bg-rose-50 text-rose-600",
  REFUNDED: "bg-slate-100 text-slate-600",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING:  "Unpaid",
  PARTIAL:  "Partial",
  PAID:     "Paid",
  FAILED:   "Failed",
  REFUNDED: "Refunded",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GetHotelCardData {
  getHotel: { _id: string; hotelTitle: string; hotelImages: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── BookingCard ──────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: BookingListItem }) {
  const { data } = useQuery<GetHotelCardData>(GET_HOTEL_CARD_QUERY, {
    variables: { hotelId: booking.hotelId },
    fetchPolicy: "cache-first",
  });

  const hotel = data?.getHotel;
  const cover = hotel?.hotelImages[0];
  const statusClass = STATUS_BADGE[booking.bookingStatus] ?? "bg-slate-100 text-slate-600";
  const statusLabel = STATUS_LABEL[booking.bookingStatus] ?? booking.bookingStatus;
  const paymentClass = PAYMENT_BADGE[booking.paymentStatus] ?? "bg-slate-100 text-slate-600";
  const paymentLabel = PAYMENT_LABEL[booking.paymentStatus] ?? booking.paymentStatus;

  return (
    <Link
      href={`/bookings/${booking._id}`}
      className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3.5 transition hover:border-slate-200 hover:bg-slate-50"
    >
      {/* Hotel thumbnail */}
      <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {cover && (
          <Image src={cover} alt={hotel?.hotelTitle ?? ""} fill sizes="80px" className="object-cover" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-800">
            {hotel?.hotelTitle ?? `Hotel #${booking.hotelId.slice(-6)}`}
          </p>
          <div className="flex flex-shrink-0 gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
              {statusLabel}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paymentClass}`}>
              {paymentLabel}
            </span>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <CalendarDays size={11} />
          <span>{formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono">#{booking.bookingCode}</span>
          <span>·</span>
          <span className="font-medium text-slate-600">₩{booking.totalPrice.toLocaleString()}</span>
        </div>
      </div>

      <ChevronRight size={14} className="flex-shrink-0 text-slate-300" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MyBookingsPage: NextPageWithAuth = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "ALL">("ALL");

  const paginationInput = useMemo<PaginationInput>(
    () => ({ page, limit: PAGE_LIMIT, sort: "createdAt", direction: -1 }),
    [page],
  );

  const { data, loading, error } = useQuery<GetMyBookingsQueryData, GetMyBookingsQueryVars>(
    GET_MY_BOOKINGS_QUERY,
    {
      variables: { input: paginationInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const allBookings = data?.getMyBookings.list ?? [];
  const bookings =
    statusFilter === "ALL"
      ? allBookings
      : allBookings.filter((b) => b.bookingStatus === statusFilter);
  const total = data?.getMyBookings.metaCounter.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const handleStatusChange = (status: BookingStatus | "ALL") => {
    setStatusFilter(status);
    setPage(1);
  };

  return (
    <main className="mx-auto max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
        <Link
          href="/bookings/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          New booking
        </Link>
      </div>

      {error && <ErrorNotice message={getErrorMessage(error)} />}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", ...BOOKING_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatusChange(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              statusFilter === s
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {s === "ALL" ? "All" : (STATUS_LABEL[s] ?? s)}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && bookings.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3.5">
              <div className="h-14 w-20 flex-shrink-0 animate-pulse rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-50" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && bookings.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarDays size={32} className="text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {statusFilter === "ALL" ? "No bookings yet" : `No ${STATUS_LABEL[statusFilter as BookingStatus]} bookings`}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {statusFilter === "ALL"
              ? "Your reservations will appear here once you book a hotel."
              : "Try a different filter or check back later."}
          </p>
          {statusFilter === "ALL" && (
            <Link
              href="/hotels"
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            >
              Browse hotels
            </Link>
          )}
        </div>
      )}

      {/* Booking list */}
      {bookings.length > 0 && (
        <>
          <p className="text-xs text-slate-400">{total} booking{total !== 1 ? "s" : ""} total</p>
          <div className="space-y-2">
            {bookings.map((b) => (
              <BookingCard key={b._id} booking={b} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages || loading}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};

MyBookingsPage.auth = {
  roles: ["USER", "AGENT", "ADMIN"],
};

export default MyBookingsPage;
