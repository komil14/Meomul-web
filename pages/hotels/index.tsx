import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { HotelCard } from "@/components/hotels/hotel-card";
import { GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type { GetHotelsQueryData, GetHotelsQueryVars } from "@/types/hotel";

const PAGE_SIZE = 12;

export default function HotelsPage() {
  const [page, setPage] = useState(1);

  const { data, loading, error } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    variables: {
      input: {
        page,
        limit: PAGE_SIZE,
        sort: "createdAt",
        direction: -1,
      },
    },
    fetchPolicy: "cache-and-network",
  });

  const hotels = data?.getHotels.list ?? [];
  const total = data?.getHotels.metaCounter.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Discover</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Public Hotels</h1>
          <p className="mt-2 text-sm text-slate-600">Browse available stays across locations.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          Open dashboard
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      ) : null}

      {loading && hotels.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading hotels...</div>
      ) : null}

      {!loading && hotels.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No hotels found.
        </div>
      ) : null}

      {hotels.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => (
              <HotelCard key={hotel._id} hotel={hotel} />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages} · {total} hotels
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
