import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { GET_MY_BOOKINGS_QUERY } from "@/graphql/booking.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  BookingListItem,
  BookingStatus,
  GetMyBookingsQueryData,
  GetMyBookingsQueryVars,
  PaginationInput,
} from "@/types/booking";
import type { NextPageWithAuth } from "@/types/page";

const PAGE_LIMIT = 10;
const BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];

const statusToneClass: Record<BookingStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-800",
  CHECKED_IN: "border-indigo-200 bg-indigo-50 text-indigo-800",
  CHECKED_OUT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
  NO_SHOW: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

const paymentToneClass: Record<BookingListItem["paymentStatus"], string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  PARTIAL: "border-violet-200 bg-violet-50 text-violet-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-800",
  REFUNDED: "border-slate-200 bg-slate-100 text-slate-700",
};

const parsePage = (value: string | string[] | undefined): number => {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
};

const parseStatus = (value: string | string[] | undefined): BookingStatus | "ALL" => {
  if (typeof value !== "string") {
    return "ALL";
  }

  if (BOOKING_STATUSES.includes(value as BookingStatus)) {
    return value as BookingStatus;
  }

  return "ALL";
};

const formatDate = (value: string): string => new Date(value).toLocaleDateString();

const MyBookingsPage: NextPageWithAuth = () => {
  const router = useRouter();
  const page = parsePage(router.query.page);
  const statusFilter = parseStatus(router.query.status);

  const paginationInput = useMemo<PaginationInput>(
    () => ({
      page,
      limit: PAGE_LIMIT,
      sort: "createdAt",
      direction: -1,
    }),
    [page],
  );

  const { data, loading, error } = useQuery<GetMyBookingsQueryData, GetMyBookingsQueryVars>(GET_MY_BOOKINGS_QUERY, {
    variables: {
      input: paginationInput,
    },
    fetchPolicy: "cache-and-network",
  });

  const allBookings = data?.getMyBookings.list ?? [];
  const bookings =
    statusFilter === "ALL" ? allBookings : allBookings.filter((booking) => booking.bookingStatus === statusFilter);
  const total = data?.getMyBookings.metaCounter.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const pushQuery = (nextPage: number, nextStatus: BookingStatus | "ALL") => {
    const query: Record<string, string> = {};
    if (nextPage > 1) {
      query.page = String(nextPage);
    }
    if (nextStatus !== "ALL") {
      query.status = nextStatus;
    }

    void router.push({ pathname: "/bookings", query }, undefined, { shallow: true });
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bookings</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">My Bookings</h1>
          <p className="mt-2 text-sm text-slate-600">Track your reservation statuses and payment progress.</p>
        </div>
        <Link
          href="/bookings/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          New booking
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-medium text-slate-600">Status:</span>
          <button
            type="button"
            onClick={() => pushQuery(1, "ALL")}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              statusFilter === "ALL" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
            }`}
          >
            ALL
          </button>
          {BOOKING_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => pushQuery(1, status)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                statusFilter === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {getErrorMessage(error)}
        </section>
      ) : null}

      {loading && allBookings.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading bookings...</section>
      ) : null}

      {!loading && !error && bookings.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No bookings found for this filter.
        </section>
      ) : null}

      {bookings.length > 0 ? (
        <section className="grid gap-3">
          {bookings.map((booking) => (
            <article key={booking._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Booking Code</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{booking.bookingCode}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusToneClass[booking.bookingStatus]}`}>
                    {booking.bookingStatus}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentToneClass[booking.paymentStatus]}`}>
                    {booking.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                <p>
                  Total: <span className="font-semibold">₩ {booking.totalPrice.toLocaleString()}</span>
                </p>
                <p>
                  Paid: <span className="font-semibold">₩ {booking.paidAmount.toLocaleString()}</span>
                </p>
                <p>
                  Guest ID: <span className="font-mono text-xs">{booking.guestId}</span>
                </p>
                <p>
                  Created: <span className="font-semibold">{formatDate(booking.createdAt)}</span>
                </p>
              </div>
              <div className="mt-3">
                <Link href={`/bookings/${booking._id}`} className="text-sm font-semibold text-slate-700 underline underline-offset-4">
                  View details
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-600">
          Page {page} / {totalPages} · Total records: {total.toLocaleString()}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => pushQuery(page - 1, statusFilter)}
            disabled={page <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => pushQuery(page + 1, statusFilter)}
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

MyBookingsPage.auth = {
  roles: ["USER", "AGENT", "ADMIN"],
};

export default MyBookingsPage;
