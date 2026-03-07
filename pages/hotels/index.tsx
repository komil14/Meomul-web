import { useApolloClient, useQuery } from "@apollo/client/react";
import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { HotelsActiveFilterChips } from "@/components/hotels/hotels-active-filter-chips";
import { HotelsDiscoveryToolbar } from "@/components/hotels/hotels-discovery-toolbar";
import { HotelsResultsSkeleton } from "@/components/hotels/hotels-results-skeleton";
import { HotelCard } from "@/components/hotels/hotel-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { createApolloClient } from "@/lib/apollo/client";
import { HOTELS_PAGE_SIZE } from "@/lib/hotels/hotels-filter-config";
import { useHotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";
import { useI18n } from "@/lib/i18n/provider";
import { formatHotelsPaginationSummaryLocalized } from "@/lib/hotels/hotels-i18n";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelListItem,
} from "@/types/hotel";

const HotelsFiltersDrawer = dynamic(
  () =>
    import("@/components/hotels/hotels-filters-drawer").then(
      (mod) => mod.HotelsFiltersDrawer,
    ),
  { ssr: false },
);

const HOTELS_MOTION_INTENSITY_CLASS = "motion-intensity-balanced";

interface HotelsPageProps {
  initialHotels: HotelListItem[];
  initialTotal: number;
}

export default function HotelsPage({
  initialHotels,
  initialTotal,
}: HotelsPageProps) {
  const { t } = useI18n();
  const apolloClient = useApolloClient();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const queryState = useHotelsPageQueryState();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data, previousData, loading, error } = useQuery<
    GetHotelsQueryData,
    GetHotelsQueryVars
  >(GET_HOTELS_QUERY, {
    variables: {
      input: {
        page: queryState.page,
        limit: HOTELS_PAGE_SIZE,
        sort: queryState.sortField,
        direction: queryState.sortDirection,
      },
      search: queryState.search,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const resultData = data ?? previousData;
  const hotelsData = resultData?.getHotels;
  const hotels = hotelsData?.list ?? initialHotels;
  const total = hotelsData?.metaCounter?.total ?? initialTotal;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / HOTELS_PAGE_SIZE)),
    [total],
  );

  const hasServerData = initialHotels.length > 0;
  const showInitialSkeleton =
    !isHydrated || (loading && hotels.length === 0 && !hasServerData);
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
      <Head>
        <title>{t("hotels_meta_title")}</title>
        <meta
          name="description"
          content={t("hotels_meta_desc")}
        />
      </Head>

      <HotelsFiltersDrawer
        isOpen={isFiltersOpen}
        onClose={() => {
          setIsFiltersOpen(false);
        }}
        state={queryState}
        appliedTotal={total}
      />

      <main className={`space-y-5 ${HOTELS_MOTION_INTENSITY_CLASS}`}>
        <ScrollReveal delayMs={20} className="relative z-50">
          <HotelsDiscoveryToolbar
            state={queryState}
            total={total}
            loading={loading}
            onOpenFilters={() => {
              setIsFiltersOpen(true);
            }}
          />
        </ScrollReveal>

        <ScrollReveal delayMs={25}>
          <HotelsActiveFilterChips state={queryState} />
        </ScrollReveal>

        {error ? <ErrorNotice message={getErrorMessage(error)} /> : null}

        {showInitialSkeleton ? <HotelsResultsSkeleton /> : null}

        {showEmptyState ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            {t("hotels_empty")}
          </div>
        ) : null}

        {showResults ? (
          <>
            <ScrollReveal delayMs={40}>
              <div className="relative">
                <div
                  className={`grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 transition duration-200 ${showResultsOverlay ? "opacity-75" : "opacity-100"}`}
                >
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
                      {t("hotels_refreshing")}
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={50}>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    {formatHotelsPaginationSummaryLocalized(
                      queryState.page,
                      totalPages,
                      total,
                      t,
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button
                      type="button"
                      disabled={queryState.page <= 1}
                      onClick={() => {
                        queryState.patchQuery(
                          { page: String(Math.max(1, queryState.page - 1)) },
                          false,
                        );
                      }}
                      className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5"
                    >
                      {t("hotels_prev")}
                    </button>
                    <button
                      type="button"
                      disabled={queryState.page >= totalPages}
                      onClick={() => {
                        queryState.patchQuery(
                          {
                            page: String(
                              Math.min(totalPages, queryState.page + 1),
                            ),
                          },
                          false,
                        );
                      }}
                      className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5"
                    >
                      {t("hotels_next")}
                    </button>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </>
        ) : null}
      </main>
    </>
  );
}

// ─── Server-side data ─────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<HotelsPageProps> = async (
  context,
) => {
  if (context.res) {
    context.res.setHeader(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=30, stale-while-revalidate=120"
        : "no-store",
    );
  }

  const client = createApolloClient();

  try {
    const result = await client.query<GetHotelsQueryData, GetHotelsQueryVars>({
      query: GET_HOTELS_QUERY,
      variables: {
        input: {
          page: 1,
          limit: HOTELS_PAGE_SIZE,
          sort: "hotelRank",
          direction: -1,
        },
      },
      fetchPolicy: "no-cache",
    });

    const hotelsData = result.data?.getHotels;

    return {
      props: {
        initialHotels: hotelsData?.list ?? [],
        initialTotal: hotelsData?.metaCounter?.total ?? 0,
      },
    };
  } catch {
    return {
      props: {
        initialHotels: [],
        initialTotal: 0,
      },
    };
  }
};
