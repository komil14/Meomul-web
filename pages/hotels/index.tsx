import { useApolloClient, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HotelsActiveFilterChips } from "@/components/hotels/hotels-active-filter-chips";
import { HotelsDiscoveryToolbar } from "@/components/hotels/hotels-discovery-toolbar";
import { HotelsFiltersDrawer } from "@/components/hotels/hotels-filters-drawer";
import { HotelsMobileResultsBar } from "@/components/hotels/hotels-mobile-results-bar";
import { HotelsResultsSkeleton } from "@/components/hotels/hotels-results-skeleton";
import { HotelCard } from "@/components/hotels/hotel-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { HOTELS_PAGE_SIZE } from "@/lib/hotels/hotels-filter-config";
import { useHotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";
import { getErrorMessage } from "@/lib/utils/error";
import type { GetHotelsQueryData, GetHotelsQueryVars } from "@/types/hotel";

const HOTELS_MOTION_INTENSITY_CLASS = "motion-intensity-balanced";

export default function HotelsPage() {
  const apolloClient = useApolloClient();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const queryState = useHotelsPageQueryState();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data, previousData, loading, error } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    variables: {
      input: {
        page: queryState.page,
        limit: HOTELS_PAGE_SIZE,
        sort: queryState.sortField,
        direction: queryState.sortDirection,
      },
      search: queryState.search,
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    returnPartialData: true,
  });

  const resultData = data ?? previousData;
  const hotels = resultData?.getHotels.list ?? [];
  const total = resultData?.getHotels.metaCounter.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / HOTELS_PAGE_SIZE)), [total]);

  const showInitialSkeleton = !isHydrated || (loading && hotels.length === 0);
  const showEmptyState = isHydrated && !loading && hotels.length === 0;
  const showResults = isHydrated && hotels.length > 0;
  const showResultsOverlay = isHydrated && loading && hotels.length > 0;

  useEffect(() => {
    if (!isHydrated || loading) {
      return;
    }

    const nextPage = queryState.page + 1;
    if (nextPage > totalPages) {
      return;
    }

    void apolloClient.query<GetHotelsQueryData, GetHotelsQueryVars>({
      query: GET_HOTELS_QUERY,
      variables: {
        input: {
          page: nextPage,
          limit: HOTELS_PAGE_SIZE,
          sort: queryState.sortField,
          direction: queryState.sortDirection,
        },
        search: queryState.search,
      },
      fetchPolicy: "cache-first",
    });
  }, [
    apolloClient,
    isHydrated,
    loading,
    queryState.page,
    queryState.search,
    queryState.sortDirection,
    queryState.sortField,
    totalPages,
  ]);

  return (
    <>
      <HotelsFiltersDrawer
        isOpen={isFiltersOpen}
        onClose={() => {
          setIsFiltersOpen(false);
        }}
        state={queryState}
      />

      <main className={`space-y-6 ${HOTELS_MOTION_INTENSITY_CLASS}`}>
        <ScrollReveal delayMs={20}>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Discover</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Public Hotels</h1>
              <p className="mt-2 text-sm text-slate-600">Search quickly, compare confidently, and book without friction.</p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Open dashboard
            </Link>
          </header>
        </ScrollReveal>

        <ScrollReveal delayMs={30}>
          <HotelsDiscoveryToolbar
            state={queryState}
            total={total}
            loading={loading}
            onOpenFilters={() => {
              setIsFiltersOpen(true);
            }}
          />
        </ScrollReveal>

        <ScrollReveal delayMs={35}>
          <HotelsActiveFilterChips state={queryState} />
        </ScrollReveal>

        <HotelsMobileResultsBar
          total={total}
          loading={loading}
          activeFilterCount={queryState.activeFilterCount}
          onOpenFilters={() => {
            setIsFiltersOpen(true);
          }}
        />

        {error ? <ErrorNotice message={getErrorMessage(error)} /> : null}

        {showInitialSkeleton ? <HotelsResultsSkeleton /> : null}

        {showEmptyState ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            No hotels found for current filters.
          </div>
        ) : null}

        {showResults ? (
          <>
            <ScrollReveal delayMs={40}>
              <div className="relative">
                <div className={`grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 transition duration-200 ${showResultsOverlay ? "opacity-75" : "opacity-100"}`}>
                {hotels.map((hotel, index) => (
                  <HotelCard
                    key={hotel._id}
                    hotel={hotel}
                    imagePriority={index < 3}
                    imageSizes="(max-width: 479px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 24rem"
                  />
                ))}
              </div>

                {showResultsOverlay ? (
                  <div className="pointer-events-none absolute inset-0 flex items-start justify-center rounded-3xl bg-white/24 p-3 backdrop-blur-[1.5px]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
                      <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
                      Refreshing results
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={50}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
                <p className="text-sm text-slate-600">
                  Page {queryState.page} of {totalPages} · {total} hotels
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={queryState.page <= 1}
                    onClick={() => {
                      queryState.patchQuery({ page: String(Math.max(1, queryState.page - 1)) }, false);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={queryState.page >= totalPages}
                    onClick={() => {
                      queryState.patchQuery({ page: String(Math.min(totalPages, queryState.page + 1)) }, false);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </ScrollReveal>
          </>
        ) : null}
      </main>
    </>
  );
}
