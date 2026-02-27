import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { HotelCard } from "@/components/hotels/hotel-card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_RECOMMENDED_HOTELS_V2_QUERY, GET_TRENDING_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { canUsePersonalizedRecommendations } from "@/lib/hotels/detail-page-helpers";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetRecommendedHotelsV2QueryData,
  GetRecommendedHotelsV2QueryVars,
  GetTrendingHotelsQueryData,
  GetTrendingHotelsQueryVars,
  RecommendationMetaDto,
} from "@/types/hotel";

const HOME_HOTEL_LIMIT = 8;
const ONBOARDING_REFRESH_QUERY_VALUE = "complete";
const HOME_MOTION_INTENSITY_CLASS = "motion-intensity-balanced";

export default function HomePage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);
  const [forceRecommendationRefresh, setForceRecommendationRefresh] = useState(false);
  const [showOnboardingRefreshNotice, setShowOnboardingRefreshNotice] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    setMember(getSessionMember());
  }, []);

  useEffect(() => {
    if (!isHydrated || !router.isReady) {
      return;
    }

    const onboardingFlag = typeof router.query.onboarding === "string" ? router.query.onboarding : null;
    if (onboardingFlag !== ONBOARDING_REFRESH_QUERY_VALUE) {
      return;
    }

    setShowOnboardingRefreshNotice(true);
    setForceRecommendationRefresh(true);

    const restQuery = { ...router.query };
    delete restQuery.onboarding;
    void router.replace(
      {
        pathname: router.pathname,
        query: restQuery,
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [isHydrated, router]);

  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const canUseRecommendedHotels = canUsePersonalizedRecommendations(memberType);

  const {
    data: recommendedData,
    loading: recommendedLoading,
    error: recommendedError,
  } = useQuery<GetRecommendedHotelsV2QueryData, GetRecommendedHotelsV2QueryVars>(GET_RECOMMENDED_HOTELS_V2_QUERY, {
    skip: !isHydrated || !canUseRecommendedHotels,
    variables: { limit: HOME_HOTEL_LIMIT },
    fetchPolicy: forceRecommendationRefresh ? "network-only" : "cache-first",
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

  useEffect(() => {
    if (!forceRecommendationRefresh || recommendedLoading) {
      return;
    }

    setForceRecommendationRefresh(false);
  }, [forceRecommendationRefresh, recommendedLoading]);

  const recommendedHotels = recommendedData?.getRecommendedHotelsV2.list ?? [];
  const recommendationMeta = recommendedData?.getRecommendedHotelsV2.meta ?? null;
  const recommendationSourceLabel = useMemo(() => {
    if (!recommendationMeta) {
      return null;
    }

    return recommendationMeta.profileSource === "onboarding" ? "Onboarding-led" : "Behavior-led";
  }, [recommendationMeta]);
  const recommendationBlendText = useMemo(() => {
    if (!recommendationMeta) {
      return null;
    }

    const onboardingPercent = Math.round(recommendationMeta.onboardingWeight * 100);
    const behaviorPercent = Math.round(recommendationMeta.behaviorWeight * 100);
    return `Blend: onboarding ${onboardingPercent}% · behavior ${behaviorPercent}%`;
  }, [recommendationMeta]);
  const trendingHotels = trendingData?.getTrendingHotels ?? [];

  const getRecommendedTrackingContext = (
    meta: RecommendationMetaDto | null,
  ): {
    source: string;
    section: string;
    profileSource?: "onboarding" | "computed";
    onboardingWeight?: number;
    behaviorWeight?: number;
  } => ({
    source: "recommended_v2",
    section: "home_recommended",
    profileSource: meta?.profileSource,
    onboardingWeight: meta?.onboardingWeight,
    behaviorWeight: meta?.behaviorWeight,
  });

  return (
    <main className={`space-y-10 ${HOME_MOTION_INTENSITY_CLASS}`}>
      <ScrollReveal delayMs={20}>
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
      </ScrollReveal>

      {showOnboardingRefreshNotice ? (
        <ScrollReveal delayMs={30}>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-800">Preferences saved and recommendations refreshed.</p>
            <p className="mt-1 text-xs text-emerald-700">
              Your onboarding answers now drive the first recommendation stage on this page.
            </p>
          </section>
        </ScrollReveal>
      ) : null}

      {canUseRecommendedHotels ? (
        <ScrollReveal delayMs={40}>
          <section className="space-y-4">
            <header className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">For You</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Personalized recommendations</h2>
                {recommendationMeta ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-slate-700">
                      {recommendationSourceLabel}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-slate-700">
                      {recommendationMeta.matchedLocationCount} location match
                      {recommendationMeta.matchedLocationCount === 1 ? "" : "es"}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-slate-700">
                      {recommendationMeta.fallbackCount} fallback
                    </span>
                    {recommendationBlendText ? (
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-slate-700">
                        {recommendationBlendText}
                      </span>
                    ) : null}
                  </div>
                ) : null}
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
                {recommendedHotels.map((hotel, index) => (
                  <HotelCard
                    key={hotel._id}
                    hotel={hotel}
                    trackingContext={getRecommendedTrackingContext(recommendationMeta)}
                    imagePriority={index < 2}
                    imageSizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 25vw, 18rem"
                  />
                ))}
              </div>
            ) : null}
          </section>
        </ScrollReveal>
      ) : null}

      <ScrollReveal delayMs={50}>
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
              {trendingHotels.map((hotel, index) => (
                <HotelCard
                  key={hotel._id}
                  hotel={hotel}
                  trackingContext={{ source: "trending", section: "home_trending" }}
                  imagePriority={index < 2}
                  imageSizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 25vw, 18rem"
                />
              ))}
            </div>
          ) : null}
        </section>
      </ScrollReveal>
    </main>
  );
}
