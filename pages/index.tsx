import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HotelCard } from "@/components/hotels/hotel-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_RECOMMENDED_HOTELS_QUERY, GET_TRENDING_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { canUsePersonalizedRecommendations } from "@/lib/hotels/detail-page-helpers";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetRecommendedHotelsQueryData,
  GetRecommendedHotelsQueryVars,
  GetTrendingHotelsQueryData,
  GetTrendingHotelsQueryVars,
} from "@/types/hotel";

const HOME_HOTEL_LIMIT = 8;

export default function HomePage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);

  useEffect(() => {
    setIsHydrated(true);
    setMember(getSessionMember());
  }, []);

  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const canUseRecommendedHotels = canUsePersonalizedRecommendations(memberType);

  const {
    data: recommendedData,
    loading: recommendedLoading,
    error: recommendedError,
  } = useQuery<GetRecommendedHotelsQueryData, GetRecommendedHotelsQueryVars>(GET_RECOMMENDED_HOTELS_QUERY, {
    skip: !isHydrated || !canUseRecommendedHotels,
    variables: { limit: HOME_HOTEL_LIMIT },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: trendingData,
    loading: trendingLoading,
    error: trendingError,
  } = useQuery<GetTrendingHotelsQueryData, GetTrendingHotelsQueryVars>(GET_TRENDING_HOTELS_QUERY, {
    skip: !isHydrated,
    variables: { limit: HOME_HOTEL_LIMIT },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const recommendedHotels = recommendedData?.getRecommendedHotels ?? [];
  const trendingHotels = trendingData?.getTrendingHotels ?? [];

  return (
    <main className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Meomul Discovery</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Find your next stay faster</h1>
        <p className="mt-4 max-w-3xl text-sm text-slate-600 sm:text-base">
          Your homepage now combines personalized recommendations with market-wide trending hotels.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/hotels" className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
            Browse all hotels
          </Link>
          {isUser ? (
            <Link
              href="/settings/preferences"
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-500"
            >
              Update preferences
            </Link>
          ) : null}
        </div>
      </section>

      {canUseRecommendedHotels ? (
        <section className="space-y-4">
          <header className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">For You</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Personalized recommendations</h2>
            </div>
          </header>

          {recommendedError ? <ErrorNotice message={getErrorMessage(recommendedError)} /> : null}
          {recommendedLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
              Loading personalized hotels...
            </div>
          ) : null}
          {!recommendedLoading && recommendedHotels.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
              We need a little more activity to personalize deeply. Trending hotels are shown below.
            </div>
          ) : null}
          {recommendedHotels.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommendedHotels.map((hotel) => (
                <HotelCard key={hotel._id} hotel={hotel} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Trending</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Popular right now</h2>
          </div>
        </header>

        {trendingError ? <ErrorNotice message={getErrorMessage(trendingError)} /> : null}
        {trendingLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            Loading trending hotels...
          </div>
        ) : null}
        {!trendingLoading && trendingHotels.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            No trending hotels available yet.
          </div>
        ) : null}
        {trendingHotels.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trendingHotels.map((hotel) => (
              <HotelCard key={hotel._id} hotel={hotel} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
