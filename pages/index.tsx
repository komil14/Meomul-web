import { useQuery } from "@apollo/client/react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { EditorialGuidesSection } from "@/components/homepage/editorial-guides-section";
import { HeroSection } from "@/components/homepage/hero-section";
import { LastMinuteDealsSection } from "@/components/homepage/last-minute-deals-section";
import { RecentlyViewedSection } from "@/components/homepage/recently-viewed-section";
import { RecommendedSection } from "@/components/homepage/recommended-section";
import { SubscriptionPlansSection } from "@/components/homepage/subscription-plans-section";
import { TestimonialsSection } from "@/components/homepage/testimonials-section";
import { TrendingSection } from "@/components/homepage/trending-section";
import { ValuePillarsSection } from "@/components/homepage/value-pillars-section";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  GET_HOME_FEED_QUERY,
  GET_RECOMMENDED_HOTELS_V2_QUERY,
} from "@/graphql/hotel.gql";
import { createApolloClient } from "@/lib/apollo/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import type {
  GetHomeFeedQueryData,
  GetHomeFeedQueryVars,
  GetRecommendedHotelsV2QueryData,
  GetRecommendedHotelsV2QueryVars,
  HotelListItem,
  HotelLocation,
  RecommendationExplanationDto,
} from "@/types/hotel";
import type {
  EditorialGuideCard,
  HomePageProps,
  HeroSlide,
  RecommendedCard,
  ValuePillar,
} from "@/types/homepage";
import styles from "@/styles/home-landing-ovastin.module.css";

// ─── Constants ─────────────────────────────────────────────────────────────────

const HERO_LIMIT = 5;
const RECOMMENDED_GRID_LIMIT = 6;
const TRENDING_RAIL_LIMIT = 10;
const TESTIMONIAL_LIMIT = 6;
const LAST_MINUTE_DEALS_LIMIT = 8;
const REVIEW_LIMIT = 5;

const GENERIC_RECOMMENDATION_SIGNALS = new Set<string>([
  "Strong match for your saved travel preferences",
  "Good match based on your core preferences",
  "Balanced pick based on your recent browsing behavior",
  "High-quality fallback aligned with your general taste",
  "Popular with guests right now",
  "Strong overall activity and engagement",
]);

// ─── Utilities ─────────────────────────────────────────────────────────────────

const createFallbackSlide = (index: number): HeroSlide => ({
  _id: `fallback-${index}`,
  title: "Premium Curated Stay",
  location: "SEOUL",
  hotelType: "HOTEL",
  rating: 4.8,
  likes: 0,
  imageUrl: "",
});

const toHeroSlides = (hotels: HotelListItem[]): HeroSlide[] => {
  const slides = hotels.slice(0, HERO_LIMIT).map((hotel) => ({
    _id: hotel._id,
    title: hotel.hotelTitle,
    location: hotel.hotelLocation,
    hotelType: hotel.hotelType,
    rating: Number.isFinite(hotel.hotelRating) ? hotel.hotelRating : 0,
    likes: Number.isFinite(hotel.hotelLikes) ? hotel.hotelLikes : 0,
    imageUrl: resolveMediaUrl(hotel.hotelImages[0]),
  }));
  if (slides.length >= HERO_LIMIT) return slides;
  const fallbacks = Array.from({ length: HERO_LIMIT - slides.length }, (_, i) =>
    createFallbackSlide(i),
  );
  return [...slides, ...fallbacks];
};

const uniqueHotelsById = (hotels: HotelListItem[]): HotelListItem[] => {
  const seen = new Set<string>();
  return hotels.filter((hotel) => {
    if (seen.has(hotel._id)) return false;
    seen.add(hotel._id);
    return true;
  });
};

const pickRecommendationSignal = (explanation: RecommendationExplanationDto): string => {
  const specific = explanation.signals.find((s) => !GENERIC_RECOMMENDATION_SIGNALS.has(s));
  if (specific) return specific;
  if (explanation.likedSimilar) return "Similar to hotels you previously liked";
  if (explanation.matchedLocation) return "Matches your preferred location";
  if (explanation.matchedPurposes.length > 0)
    return `Fits your trip purpose: ${explanation.matchedPurposes.slice(0, 2).join(", ")}`;
  if (explanation.matchedType) return "Matches your preferred hotel type";
  if (explanation.matchedPrice) return "Within your usual budget range";
  return (
    explanation.signals[0] ??
    "Popular with guests for consistent service quality and strong recent ratings."
  );
};

const toIsoLocalDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (value: Date, amount: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const getNextWeekendRange = (today: Date) => {
  const day = today.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const checkIn = addDays(today, daysUntilSaturday);
  return { checkIn: toIsoLocalDate(checkIn), checkOut: toIsoLocalDate(addDays(checkIn, 2)) };
};

const getNextBusinessRange = (today: Date) => {
  const day = today.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  const checkIn = addDays(today, daysUntilMonday);
  return { checkIn: toIsoLocalDate(checkIn), checkOut: toIsoLocalDate(addDays(checkIn, 3)) };
};

const buildHotelsFilteredHref = (input: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/hotels?${query}` : "/hotels";
};

const formatReviewCountLabel = (count: number): string => {
  if (!Number.isFinite(count) || count <= 0) return "No reviews yet";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k verified reviews`;
  return `${count.toLocaleString()} verified reviews`;
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage({
  initialTopHotels,
  initialHotelInventoryTotal,
  initialTrendingHotels,
  initialFeaturedReviews,
  initialFeaturedRatingsSummary,
  initialTestimonials,
  initialLastMinuteDeals,
  serverTodayIso,
  initialLoadError,
}: HomePageProps) {
  const [hasAccessToken, setHasAccessToken] = useState(false);

  const { data: recommendedData, loading: recommendedLoading } = useQuery<
    GetRecommendedHotelsV2QueryData,
    GetRecommendedHotelsV2QueryVars
  >(GET_RECOMMENDED_HOTELS_V2_QUERY, {
    variables: { limit: RECOMMENDED_GRID_LIMIT },
    skip: !hasAccessToken,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    setHasAccessToken(Boolean(getAccessToken()));
  }, []);

  // ─── Derived data ────────────────────────────────────────────────────────────

  const heroSlides = useMemo(() => toHeroSlides(initialTopHotels), [initialTopHotels]);

  const recommendationSignals = useMemo(() => {
    const map = new Map<string, string>();
    const explanations = hasAccessToken
      ? (recommendedData?.getRecommendedHotelsV2.explanations ?? [])
      : [];
    explanations.forEach((exp) => {
      const signal = pickRecommendationSignal(exp);
      if (signal) map.set(exp.hotelId, signal);
    });
    return map;
  }, [hasAccessToken, recommendedData?.getRecommendedHotelsV2.explanations]);

  const recommendedCards = useMemo<RecommendedCard[]>(() => {
    const personalized = hasAccessToken
      ? (recommendedData?.getRecommendedHotelsV2.list ?? [])
      : [];
    const merged = uniqueHotelsById([
      ...personalized,
      ...initialTrendingHotels,
      ...initialTopHotels,
    ]).slice(0, RECOMMENDED_GRID_LIMIT);
    return merged.map((hotel) => ({
      _id: hotel._id,
      title: hotel.hotelTitle,
      location: hotel.hotelLocation,
      hotelType: hotel.hotelType,
      rating: hotel.hotelRating ?? 0,
      likes: hotel.hotelLikes ?? 0,
      imageUrl: resolveMediaUrl(hotel.hotelImages[0]),
      signal:
        recommendationSignals.get(hotel._id) ??
        "Popular with guests for consistent service quality and strong recent ratings.",
    }));
  }, [
    hasAccessToken,
    initialTopHotels,
    initialTrendingHotels,
    recommendedData?.getRecommendedHotelsV2.list,
    recommendationSignals,
  ]);

  const recommendedRows = useMemo(
    () =>
      [recommendedCards.slice(0, 3), recommendedCards.slice(3, 6)].filter((r) => r.length > 0),
    [recommendedCards],
  );

  const trendingHotels = useMemo(() => {
    const personalized = hasAccessToken
      ? (recommendedData?.getRecommendedHotelsV2.list ?? [])
      : [];
    return uniqueHotelsById([
      ...initialTrendingHotels,
      ...personalized,
      ...initialTopHotels,
    ]).slice(0, TRENDING_RAIL_LIMIT);
  }, [
    hasAccessToken,
    initialTopHotels,
    initialTrendingHotels,
    recommendedData?.getRecommendedHotelsV2.list,
  ]);

  const valuePillars = useMemo<ValuePillar[]>(() => {
    const averageRating =
      initialTopHotels.length > 0
        ? initialTopHotels.reduce((sum, h) => sum + (h.hotelRating ?? 0), 0) /
          initialTopHotels.length
        : 0;
    const trendingLikes = trendingHotels.reduce((sum, h) => sum + (h.hotelLikes ?? 0), 0);
    const reviewCount =
      initialFeaturedRatingsSummary?.totalReviews ?? initialFeaturedReviews.length;
    const meta = hasAccessToken ? recommendedData?.getRecommendedHotelsV2.meta : undefined;
    const personalizationDetail = hasAccessToken
      ? meta
        ? `${meta.matchedLocationCount} location matches and ${meta.strictStageCount + meta.relaxedStageCount} strict-fit picks in your feed.`
        : "Profile-aware recommendations are active and adapt to your booking behavior."
      : "Sign in to unlock profile-aware recommendations based on onboarding + behavior signals.";

    return [
      {
        title: "Destination coverage",
        metric:
          initialHotelInventoryTotal > 0
            ? `${initialHotelInventoryTotal.toLocaleString()} hotels`
            : "Curated inventory",
        detail: "Active stays across major Korea destinations, ranked daily by quality and guest demand.",
      },
      {
        title: "Guest trust layer",
        metric: reviewCount > 0 ? formatReviewCountLabel(reviewCount) : "Live review scoring",
        detail: "Review scores and helpful feedback continuously shape ranking, visibility, and recommendations.",
      },
      {
        title: "Demand intelligence",
        metric: trendingLikes > 0 ? `${trendingLikes.toLocaleString()} demand signals` : "Real-time demand feed",
        detail:
          averageRating > 0
            ? `Top stays currently average ★ ${averageRating.toFixed(1)} based on recent guest interactions.`
            : "Trending, likes, and viewing patterns surface high-intent stays before they sell out.",
      },
      {
        title: "Personalized matching",
        metric: hasAccessToken ? "Onboarding + behavior" : "Ready when you sign in",
        detail: personalizationDetail,
      },
    ];
  }, [
    hasAccessToken,
    initialFeaturedReviews.length,
    initialFeaturedRatingsSummary,
    initialHotelInventoryTotal,
    initialTopHotels,
    recommendedData?.getRecommendedHotelsV2.meta,
    trendingHotels,
  ]);

  const editorialGuideCards = useMemo<EditorialGuideCard[]>(() => {
    const baseDate = new Date(`${serverTodayIso}T00:00:00`);
    const weekendRange = getNextWeekendRange(baseDate);
    const businessRange = getNextBusinessRange(baseDate);
    const imageCandidates = uniqueHotelsById([...initialTopHotels, ...trendingHotels]);

    const pickImage = (location: HotelLocation, fallbackIndex: number): string => {
      const match = imageCandidates.find(
        (h) => h.hotelLocation === location && h.hotelImages[0],
      );
      if (match?.hotelImages[0]) return resolveMediaUrl(match.hotelImages[0]);
      return heroSlides[fallbackIndex % Math.max(1, heroSlides.length)]?.imageUrl ?? "";
    };

    const guides: Omit<EditorialGuideCard, "href" | "imageUrl">[] = [
      {
        id: "guide-jeju-weekend",
        eyebrow: "Weekend Escape",
        title: "Best stays for a Jeju weekend",
        description: "Short recharge plan with resort and pension picks optimized for 2-night stays.",
        location: "JEJU",
        purpose: "STAYCATION",
        checkIn: weekendRange.checkIn,
        checkOut: weekendRange.checkOut,
        guests: "2",
        types: "RESORT,PENSION",
      },
      {
        id: "guide-seoul-business",
        eyebrow: "Business Route",
        title: "Seoul hotels for business trips",
        description: "Central hotels with strong workspace amenities and smooth weekday availability.",
        location: "SEOUL",
        purpose: "BUSINESS",
        checkIn: businessRange.checkIn,
        checkOut: businessRange.checkOut,
        guests: "1",
        types: "HOTEL",
      },
      {
        id: "guide-busan-romantic",
        eyebrow: "Couple Stay",
        title: "Busan romantic stay shortlist",
        description: "Ocean-facing and premium rooms popular for two-person romantic getaways.",
        location: "BUSAN",
        purpose: "ROMANTIC",
        checkIn: weekendRange.checkIn,
        checkOut: weekendRange.checkOut,
        guests: "2",
        types: "HOTEL,RESORT",
      },
      {
        id: "guide-gangneung-family",
        eyebrow: "Family Friendly",
        title: "Gangneung family-ready stays",
        description: "Larger rooms and practical family setups for easier multi-guest planning.",
        location: "GANGNEUNG",
        purpose: "FAMILY",
        checkIn: weekendRange.checkIn,
        checkOut: weekendRange.checkOut,
        guests: "4",
        types: "RESORT,PENSION,HOTEL",
      },
    ];

    return guides.map((guide, index) => ({
      ...guide,
      href: buildHotelsFilteredHref({
        location: guide.location,
        purpose: guide.purpose,
        checkIn: guide.checkIn,
        checkOut: guide.checkOut,
        guests: guide.guests,
        types: guide.types,
        sort: "RECOMMENDED",
      }),
      imageUrl: pickImage(guide.location, index),
    }));
  }, [heroSlides, initialTopHotels, serverTodayIso, trendingHotels]);

  // ─── SEO ─────────────────────────────────────────────────────────────────────

  const canonicalBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";
  const canonicalUrl = `${canonicalBaseUrl}/`;
  const primaryHotel = initialTopHotels[0];
  const metaTitle = primaryHotel
    ? `${primaryHotel.hotelTitle} and curated stays across Korea | Meomul`
    : "Meomul | Book the right stay for every trip";
  const metaDescription =
    "Discover verified hotels, real guest reviews, live deals, and personalized recommendations across Korea.";
  const homepageStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Meomul",
    url: canonicalUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonicalBaseUrl}/hotels?text={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Meomul" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageStructuredData) }}
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.shell}>
          {initialLoadError && <ErrorNotice message={initialLoadError} />}

          <HeroSection
            slides={heroSlides}
            featuredReviews={initialFeaturedReviews}
            ratingsSummary={initialFeaturedRatingsSummary}
          />
          <RecentlyViewedSection />
          <RecommendedSection
            cards={recommendedCards}
            rows={recommendedRows}
            isPersonalizing={hasAccessToken && recommendedLoading}
          />
          <TrendingSection hotels={trendingHotels} />
          <ValuePillarsSection pillars={valuePillars} />
          <LastMinuteDealsSection deals={initialLastMinuteDeals} />
          <TestimonialsSection testimonials={initialTestimonials} />
          <SubscriptionPlansSection />
          <EditorialGuidesSection cards={editorialGuideCards} />
        </div>
      </main>
    </>
  );
}

// ─── Server-side data ─────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<HomePageProps> = async (context) => {
  if (context.res) {
    context.res.setHeader(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : "no-store",
    );
  }

  const client = createApolloClient();
  const fallbackToday = new Date();
  const serverTodayIso = `${fallbackToday.getFullYear()}-${`${fallbackToday.getMonth() + 1}`.padStart(2, "0")}-${`${fallbackToday.getDate()}`.padStart(2, "0")}`;

  try {
    const result = await client.query<GetHomeFeedQueryData, GetHomeFeedQueryVars>({
      query: GET_HOME_FEED_QUERY,
      variables: {
        input: {
          heroLimit: HERO_LIMIT,
          trendingLimit: TRENDING_RAIL_LIMIT,
          dealsLimit: LAST_MINUTE_DEALS_LIMIT,
          testimonialsLimit: TESTIMONIAL_LIMIT,
          featuredReviewLimit: REVIEW_LIMIT,
          recommendationLimit: RECOMMENDED_GRID_LIMIT,
        },
      },
      fetchPolicy: "no-cache",
    });

    const feed = result.data?.getHomeFeed;

    return {
      props: {
        initialTopHotels: feed?.topHotels ?? [],
        initialHotelInventoryTotal: feed?.hotelInventoryTotal ?? 0,
        initialTrendingHotels: feed?.trendingHotels ?? [],
        initialFeaturedReviews: feed?.featuredReviews ?? [],
        initialFeaturedRatingsSummary: feed?.featuredRatingsSummary ?? null,
        initialTestimonials:
          feed?.testimonials.map((entry) => ({
            hotelId: entry.hotelId,
            hotelTitle: entry.hotelTitle,
            review: entry.review,
          })) ?? [],
        initialLastMinuteDeals:
          feed?.lastMinuteDeals.map((deal) => ({
            ...deal,
            imageUrl: resolveMediaUrl(deal.imageUrl),
            validUntil: String(deal.validUntil),
          })) ?? [],
        serverTodayIso,
        initialLoadError: null,
      },
    };
  } catch {
    return {
      props: {
        initialTopHotels: [],
        initialHotelInventoryTotal: 0,
        initialTrendingHotels: [],
        initialFeaturedReviews: [],
        initialFeaturedRatingsSummary: null,
        initialTestimonials: [],
        initialLastMinuteDeals: [],
        serverTodayIso,
        initialLoadError: "Failed to load homepage data right now.",
      },
    };
  }
};
