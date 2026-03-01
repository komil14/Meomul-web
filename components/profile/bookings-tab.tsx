import { useQuery } from "@apollo/client/react";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_MY_BOOKINGS_QUERY } from "@/graphql/booking.gql";
import { GET_HOTEL_CARD_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import { CalendarDays, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRoom {
  roomType: string;
  quantity: number;
  guestName: string;
}

interface BookingListItem {
  _id: string;
  bookingCode: string;
  bookingStatus: string;
  paymentStatus: string;
  paidAmount: number;
  totalPrice: number;
  checkInDate: string;
  checkOutDate: string;
  createdAt: string;
  hotelId: string;
  rooms: BookingRoom[];
}

interface GetMyBookingsData {
  getMyBookings: {
    list: BookingListItem[];
    metaCounter: { total: number }[];
  };
}

interface GetHotelCardData {
  getHotel: {
    _id: string;
    hotelTitle: string;
    hotelImages: string[];
  };
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING:     "bg-amber-50 text-amber-700",
  CONFIRMED:   "bg-sky-50 text-sky-700",
  CHECKED_IN:  "bg-emerald-50 text-emerald-700",
  CHECKED_OUT: "bg-slate-100 text-slate-600",
  CANCELLED:   "bg-rose-50 text-rose-600",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:     "Pending",
  CONFIRMED:   "Confirmed",
  CHECKED_IN:  "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED:   "Cancelled",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── BookingRow ───────────────────────────────────────────────────────────────

function BookingRow({ booking }: { booking: BookingListItem }) {
  const { data } = useQuery<GetHotelCardData>(GET_HOTEL_CARD_QUERY, {
    variables: { hotelId: booking.hotelId },
    fetchPolicy: "cache-first",
  });

  const hotel = data?.getHotel;
  const cover = hotel?.hotelImages[0];
  const statusClass = STATUS_BADGE[booking.bookingStatus] ?? "bg-slate-100 text-slate-600";
  const statusLabel = STATUS_LABEL[booking.bookingStatus] ?? booking.bookingStatus;

  return (
    <Link
      href={`/bookings/${booking._id}`}
      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200 hover:bg-slate-50"
    >
      {/* Hotel thumbnail */}
      <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {cover && (
          <Image src={cover} alt={hotel?.hotelTitle ?? ""} fill sizes="64px" className="object-cover" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-slate-800">
            {hotel?.hotelTitle ?? `Hotel #${booking.hotelId.slice(-6)}`}
          </p>
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <CalendarDays size={11} />
          <span>{formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-400">#{booking.bookingCode}</span>
          <span>·</span>
          <span className="font-medium text-slate-600">₩{booking.totalPrice.toLocaleString()}</span>
        </div>
      </div>

      <ChevronRight size={14} className="flex-shrink-0 text-slate-300" />
    </Link>
  );
}

// ─── BookingsTab ──────────────────────────────────────────────────────────────

const LIMIT = 10;

export function BookingsTab() {
  const member = useMemo(() => getSessionMember(), []);
  const [page, setPage] = useState(1);

  const { data, loading, error } = useQuery<GetMyBookingsData>(GET_MY_BOOKINGS_QUERY, {
    skip: !member,
    variables: { input: { page, limit: LIMIT, direction: -1 } },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const bookings = data?.getMyBookings.list ?? [];
  const total = data?.getMyBookings.metaCounter[0]?.total ?? 0;
  const hasMore = page * LIMIT < total;

  return (
    <div className="space-y-3">
      {error && <ErrorNotice message={getErrorMessage(error)} />}

      {/* Loading skeleton */}
      {loading && bookings.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
              <div className="h-12 w-16 flex-shrink-0 animate-pulse rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-slate-100" />
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
          <p className="mt-3 text-sm font-medium text-slate-700">No bookings yet</p>
          <p className="mt-1 text-xs text-slate-400">Your stays will appear here once you book a hotel.</p>
          <Link
            href="/hotels"
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
          >
            Browse hotels
          </Link>
        </div>
      )}

      {/* Booking list */}
      {bookings.length > 0 && (
        <>
          <p className="text-xs text-slate-400">{total} booking{total !== 1 ? "s" : ""} total</p>
          {bookings.map((b) => (
            <BookingRow key={b._id} booking={b} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 py-2.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
