import { useQuery } from "@apollo/client/react";
import type { GetServerSideProps } from "next";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  GET_HOME_LAST_MINUTE_DEALS_QUERY,
  GET_HOME_TESTIMONIALS_QUERY,
  GET_HOTELS_QUERY,
  GET_HOTEL_REVIEWS_QUERY,
  GET_RECOMMENDED_HOTELS_V2_QUERY,
  GET_TRENDING_HOTELS_QUERY,
} from "@/graphql/hotel.gql";
import { createApolloClient } from "@/lib/apollo/client";
import { getAccessToken } from "@/lib/auth/session";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import {
  clearRecentlyViewedHotels,
  readRecentlyViewedHotels,
  type RecentlyViewedHotelEntry,
} from "@/lib/hotels/recently-viewed";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import type {
  GetHotelReviewsQueryData,
  GetHotelReviewsQueryVars,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  GetHomeLastMinuteDealsQueryData,
  GetHomeLastMinuteDealsQueryVars,
  GetHomeTestimonialsQueryData,
  GetHomeTestimonialsQueryVars,
  GetRecommendedHotelsV2QueryData,
  GetRecommendedHotelsV2QueryVars,
  GetTrendingHotelsQueryData,
  GetTrendingHotelsQueryVars,
  HotelLocation,
  HotelListItem,
  PaginationInput,
  ReviewRatingsSummaryDto,
  ReviewDto,
  RoomType,
  StayPurpose,
} from "@/types/hotel";
import styles from "@/styles/home-landing-ovastin.module.css";

const HERO_LIMIT = 5;
const HERO_ROTATION_MS = 4000;
const REVIEW_LIMIT = 5;
const RECOMMENDED_GRID_LIMIT = 6;
const TRENDING_RAIL_LIMIT = 10;
const TESTIMONIAL_LIMIT = 6;
const LAST_MINUTE_DEALS_LIMIT = 8;

const HERO_QUERY_INPUT: PaginationInput = {
  page: 1,
  limit: HERO_LIMIT,
  sort: "hotelRank",
  direction: -1,
};

const REVIEW_QUERY_INPUT: PaginationInput = {
  page: 1,
  limit: REVIEW_LIMIT,
  sort: "createdAt",
  direction: -1,
};

interface HeroSlide {
  _id: string;
  title: string;
  location: string;
  hotelType: string;
  rating: number;
  likes: number;
  imageUrl: string;
}

interface RecommendedCard {
  _id: string;
  title: string;
  location: string;
  hotelType: string;
  rating: number;
  likes: number;
  imageUrl: string;
  signal: string;
}

interface TestimonialReviewEntry {
  review: ReviewDto;
  hotelId: string;
  hotelTitle: string;
}

interface LastMinuteDealCard {
  roomId: string;
  hotelId: string;
  hotelTitle: string;
  hotelLocation: string;
  roomName: string;
  roomType: RoomType | string;
  imageUrl: string;
  basePrice: number;
  dealPrice: number;
  discountPercent: number;
  validUntil: string;
}

interface EditorialGuideCard {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  location: HotelLocation;
  purpose: StayPurpose;
  checkIn: string;
  checkOut: string;
  guests: string;
  types?: string;
  href: string;
  imageUrl: string;
}

interface HomePageProps {
  initialTopHotels: HotelListItem[];
  initialHotelInventoryTotal: number;
  initialTrendingHotels: HotelListItem[];
  initialFeaturedReviews: ReviewDto[];
  initialFeaturedRatingsSummary: ReviewRatingsSummaryDto | null;
  initialTestimonials: TestimonialReviewEntry[];
  initialLastMinuteDeals: LastMinuteDealCard[];
  serverTodayIso: string;
  initialLoadError: string | null;
}

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

  if (slides.length >= HERO_LIMIT) {
    return slides;
  }

  const fallbackSlides = Array.from(
    { length: HERO_LIMIT - slides.length },
    (_, index) => createFallbackSlide(index),
  );
  return [...slides, ...fallbackSlides];
};

const uniqueHotelsById = (hotels: HotelListItem[]): HotelListItem[] => {
  const seenIds = new Set<string>();
  const uniqueHotels: HotelListItem[] = [];

  hotels.forEach((hotel) => {
    if (seenIds.has(hotel._id)) {
      return;
    }
    seenIds.add(hotel._id);
    uniqueHotels.push(hotel);
  });

  return uniqueHotels;
};

const formatRatingStars = (rating: number): string => {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"★".repeat(safeRating)}${"☆".repeat(5 - safeRating)}`;
};

const formatReviewCountLabel = (count: number): string => {
  if (!Number.isFinite(count) || count <= 0) {
    return "No reviews yet";
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k verified reviews`;
  }

  return `${count.toLocaleString()} verified reviews`;
};

const toReviewerInitial = (review: ReviewDto, index: number): string => {
  const nickname = review.reviewerNick?.trim();
  if (nickname) {
    return nickname.charAt(0).toUpperCase();
  }

  return `${(index + 1) % 10}`;
};

const toTestimonialQuote = (review: ReviewDto): string => {
  const source =
    review.reviewText?.trim() ||
    review.reviewTitle?.trim() ||
    "Great stay experience.";
  if (source.length <= 160) {
    return source;
  }
  return `${source.slice(0, 157).trimEnd()}...`;
};

const toStayPeriodLabel = (review: ReviewDto): string => {
  const date = review.stayDate?.slice(0, 10);
  if (!date) {
    return "Verified stay";
  }
  return `Stayed ${date}`;
};

const formatDealExpiryLabel = (validUntil: string): string => {
  const expiresAt = new Date(validUntil);
  if (Number.isNaN(expiresAt.getTime())) {
    return "Ends soon";
  }

  return `Ends ${expiresAt.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  })}`;
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

const getNextWeekendRange = (today: Date): { checkIn: string; checkOut: string } => {
  const day = today.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const checkInDate = addDays(today, daysUntilSaturday);
  const checkOutDate = addDays(checkInDate, 2);
  return {
    checkIn: toIsoLocalDate(checkInDate),
    checkOut: toIsoLocalDate(checkOutDate),
  };
};

const getNextBusinessRange = (today: Date): { checkIn: string; checkOut: string } => {
  const day = today.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  const checkInDate = addDays(today, daysUntilMonday);
  const checkOutDate = addDays(checkInDate, 3);
  return {
    checkIn: toIsoLocalDate(checkInDate),
    checkOut: toIsoLocalDate(checkOutDate),
  };
};

const buildHotelsFilteredHref = (
  input: Record<string, string | undefined>,
): string => {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `/hotels?${query}` : "/hotels";
};

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
  const [isMounted, setIsMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);
  const [activeRecommendedCard, setActiveRecommendedCard] = useState(1);
  const [activeTestimonialCard, setActiveTestimonialCard] = useState(0);
  const [recentlyViewedHotels, setRecentlyViewedHotels] = useState<
    RecentlyViewedHotelEntry[]
  >([]);
  const testimonialsRailRef = useRef<HTMLDivElement | null>(null);

  const topHotels = useMemo(() => initialTopHotels, [initialTopHotels]);
  const heroSlides = useMemo(
    () => toHeroSlides(topHotels),
    [topHotels],
  );
  const featuredReviewsLoading = false;

  const { data: recommendedHotelsData } = useQuery<
    GetRecommendedHotelsV2QueryData,
    GetRecommendedHotelsV2QueryVars
  >(GET_RECOMMENDED_HOTELS_V2_QUERY, {
    variables: { limit: RECOMMENDED_GRID_LIMIT },
    skip: !hasAccessToken,
    errorPolicy: "ignore",
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    setIsMounted(true);
    setHasAccessToken(Boolean(getAccessToken()));
    setRecentlyViewedHotels(readRecentlyViewedHotels());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = (): void => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    syncPreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreference);
    } else {
      mediaQuery.addListener(syncPreference);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", syncPreference);
      } else {
        mediaQuery.removeListener(syncPreference);
      }
    };
  }, []);

  const handleClearRecentlyViewed = useCallback(() => {
    clearRecentlyViewedHotels();
    setRecentlyViewedHotels([]);
  }, []);

  useEffect(() => {
    setActiveSlide(0);
  }, [heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1 || isSliderPaused || prefersReducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, HERO_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [heroSlides.length, isSliderPaused, prefersReducedMotion]);

  const activeSlideData = heroSlides[activeSlide] ?? heroSlides[0];
  const activeSlideHref = activeSlideData?._id.startsWith("fallback-")
    ? "/hotels"
    : `/hotels/${activeSlideData?._id ?? ""}`;
  const featuredReviews = useMemo(() => initialFeaturedReviews, [
    initialFeaturedReviews,
  ]);
  const ratingsSummary = initialFeaturedRatingsSummary ?? undefined;
  const reviewCount = ratingsSummary?.totalReviews ?? featuredReviews.length;
  const reviewRating = ratingsSummary?.overallRating ?? activeSlideData?.rating ?? 0;
  const reviewStars = formatRatingStars(reviewRating);

  const recommendationSignalsByHotelId = useMemo(() => {
    const signalMap = new Map<string, string>();
    const explanations = hasAccessToken
      ? (recommendedHotelsData?.getRecommendedHotelsV2.explanations ?? [])
      : [];
    explanations.forEach((explanation) => {
      const topSignal = explanation.signals?.[0];
      if (topSignal) {
        signalMap.set(explanation.hotelId, topSignal);
      }
    });
    return signalMap;
  }, [hasAccessToken, recommendedHotelsData?.getRecommendedHotelsV2.explanations]);

  const recommendedCards = useMemo<RecommendedCard[]>(() => {
    const personalized = hasAccessToken
      ? (recommendedHotelsData?.getRecommendedHotelsV2.list ?? [])
      : [];
    const trending = initialTrendingHotels;
    const merged = uniqueHotelsById([
      ...personalized,
      ...trending,
      ...topHotels,
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
        recommendationSignalsByHotelId.get(hotel._id) ??
        "Popular with guests for consistent service quality and strong recent ratings.",
    }));
  }, [
    hasAccessToken,
    initialTrendingHotels,
    recommendedHotelsData?.getRecommendedHotelsV2.list,
    recommendationSignalsByHotelId,
    topHotels,
  ]);

  const recommendedRows = useMemo(
    () =>
      [recommendedCards.slice(0, 3), recommendedCards.slice(3, 6)].filter(
        (row) => row.length > 0,
      ),
    [recommendedCards],
  );

  const trendingRailCards = useMemo(() => {
    const trendingHotels = initialTrendingHotels;
    const recommendationHotels = hasAccessToken
      ? (recommendedHotelsData?.getRecommendedHotelsV2.list ?? [])
      : [];
    return uniqueHotelsById([
      ...trendingHotels,
      ...recommendationHotels,
      ...topHotels,
    ]).slice(0, TRENDING_RAIL_LIMIT);
  }, [
    hasAccessToken,
    initialTrendingHotels,
    recommendedHotelsData?.getRecommendedHotelsV2.list,
    topHotels,
  ]);
  const recentViewedCards = useMemo(
    () => recentlyViewedHotels.slice(0, 6),
    [recentlyViewedHotels],
  );
  const lastMinuteDeals = useMemo(
    () => initialLastMinuteDeals,
    [initialLastMinuteDeals],
  );
  const editorialGuideCards = useMemo<EditorialGuideCard[]>(() => {
    const baseDate = new Date(`${serverTodayIso}T00:00:00`);
    const weekendRange = getNextWeekendRange(baseDate);
    const businessRange = getNextBusinessRange(baseDate);
    const imageCandidates = uniqueHotelsById([
      ...topHotels,
      ...trendingRailCards,
    ]);

    const pickImageByLocation = (
      location: HotelLocation,
      fallbackIndex: number,
    ): string => {
      const matchedHotel = imageCandidates.find(
        (hotel) => hotel.hotelLocation === location && hotel.hotelImages[0],
      );

      if (matchedHotel?.hotelImages[0]) {
        return resolveMediaUrl(matchedHotel.hotelImages[0]);
      }

      const fallbackSlideImage =
        heroSlides[fallbackIndex % Math.max(1, heroSlides.length)]?.imageUrl ??
        "";
      return fallbackSlideImage;
    };

    const guides: Omit<EditorialGuideCard, "href" | "imageUrl">[] = [
      {
        id: "guide-jeju-weekend",
        eyebrow: "Weekend Escape",
        title: "Best stays for a Jeju weekend",
        description:
          "Short recharge plan with resort and pension picks optimized for 2-night stays.",
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
        description:
          "Central hotels with strong workspace amenities and smooth weekday availability.",
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
        description:
          "Ocean-facing and premium rooms popular for two-person romantic getaways.",
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
        description:
          "Larger rooms and practical family setups for easier multi-guest planning.",
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
      imageUrl: pickImageByLocation(guide.location, index),
    }));
  }, [heroSlides, serverTodayIso, topHotels, trendingRailCards]);

  const valuePillars = useMemo(() => {
    const hotelInventoryTotal = initialHotelInventoryTotal;
    const averageHeroRating =
      topHotels.length > 0
        ? topHotels.reduce(
            (sum, hotel) => sum + (hotel.hotelRating ?? 0),
            0,
          ) / topHotels.length
        : 0;
    const trendingLikes = trendingRailCards.reduce(
      (sum, hotel) => sum + (hotel.hotelLikes ?? 0),
      0,
    );
    const recommendationMeta = hasAccessToken
      ? recommendedHotelsData?.getRecommendedHotelsV2.meta
      : undefined;

    const personalizationDetail = hasAccessToken
      ? recommendationMeta
        ? `${recommendationMeta.matchedLocationCount} location matches and ${recommendationMeta.strictStageCount + recommendationMeta.relaxedStageCount} strict-fit picks in your feed.`
        : "Profile-aware recommendations are active and adapt to your booking behavior."
      : "Sign in to unlock profile-aware recommendations based on onboarding + behavior signals.";

    return [
      {
        title: "Destination coverage",
        metric:
          hotelInventoryTotal > 0
            ? `${hotelInventoryTotal.toLocaleString()} hotels`
            : "Curated inventory",
        detail:
          "Active stays across major Korea destinations, ranked daily by quality and guest demand.",
      },
      {
        title: "Guest trust layer",
        metric:
          reviewCount > 0
            ? `${reviewCount.toLocaleString()}k+ verified reviews`
            : "Live review scoring",
        detail:
          "Review scores and helpful feedback continuously shape ranking, visibility, and recommendations.",
      },
      {
        title: "Demand intelligence",
        metric:
          trendingLikes > 0
            ? `${trendingLikes.toLocaleString()} demand signals`
            : "Real-time demand feed",
        detail:
          averageHeroRating > 0
            ? `Top stays currently average ★ ${averageHeroRating.toFixed(1)} based on recent guest interactions.`
            : "Trending, likes, and viewing patterns surface high-intent stays before they sell out.",
      },
      {
        title: "Personalized matching",
        metric: hasAccessToken
          ? "Onboarding + behavior"
          : "Ready when you sign in",
        detail: personalizationDetail,
      },
    ];
  }, [
    initialHotelInventoryTotal,
    hasAccessToken,
    recommendedHotelsData?.getRecommendedHotelsV2.meta,
    reviewCount,
    topHotels,
    trendingRailCards,
  ]);

  useEffect(() => {
    if (recommendedCards.length === 0) {
      return;
    }
    if (activeRecommendedCard >= recommendedCards.length) {
      setActiveRecommendedCard(Math.max(0, recommendedCards.length - 1));
    }
  }, [activeRecommendedCard, recommendedCards.length]);

  const testimonialReviews = useMemo(
    () => initialTestimonials,
    [initialTestimonials],
  );
  const loopedTestimonialReviews = useMemo(() => {
    if (testimonialReviews.length <= 1) {
      return testimonialReviews;
    }
    return [...testimonialReviews, ...testimonialReviews];
  }, [testimonialReviews]);

  const handleTestimonialsScroll = useCallback(() => {
    const rail = testimonialsRailRef.current;
    if (!rail) {
      return;
    }

    const cards = Array.from(
      rail.querySelectorAll<HTMLElement>("[data-testimonial-index]"),
    );
    if (cards.length === 0) {
      return;
    }

    const railScrollLeft = rail.scrollLeft;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card) => {
      const index = Number(card.dataset.testimonialIndex ?? "0");
      const distance = Math.abs(card.offsetLeft - railScrollLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const normalizedIndex =
      testimonialReviews.length > 0
        ? nearestIndex % testimonialReviews.length
        : 0;

    setActiveTestimonialCard((current) =>
      current === normalizedIndex ? current : normalizedIndex,
    );
  }, [testimonialReviews.length]);

  useEffect(() => {
    if (testimonialReviews.length === 0) {
      setActiveTestimonialCard(0);
      return;
    }
    if (activeTestimonialCard >= testimonialReviews.length) {
      setActiveTestimonialCard(Math.max(0, testimonialReviews.length - 1));
    }
  }, [activeTestimonialCard, testimonialReviews.length]);

  useEffect(() => {
    const rail = testimonialsRailRef.current;
    if (!isMounted || !rail) {
      return;
    }

    rail.scrollLeft = 0;
  }, [isMounted, loopedTestimonialReviews.length]);

  useEffect(() => {
    const rail = testimonialsRailRef.current;
    if (
      !isMounted ||
      !rail ||
      testimonialReviews.length <= 1 ||
      prefersReducedMotion
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (rail.matches(":hover")) {
        return;
      }

      rail.scrollLeft += 1.2;
      const loopBoundary = rail.scrollWidth / 2;
      if (loopBoundary > 0 && rail.scrollLeft >= loopBoundary) {
        rail.scrollLeft -= loopBoundary;
      }
    }, 16);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isMounted, prefersReducedMotion, testimonialReviews.length]);

  return (
    <>
      <Script
        src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js"
        strategy="afterInteractive"
      />
      <Script id="ovastin-font-loader" strategy="afterInteractive">
        {`if (window.WebFont) { window.WebFont.load({ google: { families: ["Plus Jakarta Sans:300,400,500,600,700"] } }); }`}
      </Script>

      <main className={styles.page}>
        <div className={styles.shell}>
          {initialLoadError ? (
            <ErrorNotice message={initialLoadError} />
          ) : null}

          <section className={styles.hero}>
            <div className={styles.heroLeft}>
              <div className={styles.subtitle}>
                <span>Smart Hotel Stays Start Here</span>
              </div>

              <h1 className={styles.title}>
                Book the Right Stay for Every Trip
              </h1>

              <div className={styles.primaryRow}>
                <Link href="/hotels" className={styles.serviceButton}>
                  <span>Explore Hotels</span>
                  <span className={styles.serviceButtonArrow}>↗</span>
                </Link>

                <div className={styles.reviewWrap}>
                  <div className={styles.reviewLabel}>★ Guest Reviews</div>
                  <div className={styles.reviewBottom}>
                    <div className={styles.avatarStack}>
                      {featuredReviews.length > 0
                        ? featuredReviews
                            .slice(0, REVIEW_LIMIT)
                            .map((review, index) => {
                              const reviewerImageUrl = resolveMediaUrl(
                                review.reviewerImage,
                              );

                              return (
                                <div
                                  key={`review-avatar-${review._id}`}
                                  className={styles.avatarItem}
                                >
                                  {reviewerImageUrl ? (
                                    <Image
                                      src={reviewerImageUrl}
                                      alt={
                                        review.reviewerNick ?? "Guest reviewer"
                                      }
                                      fill
                                      sizes="22px"
                                      className={styles.avatarImage}
                                    />
                                  ) : (
                                    <span className={styles.avatarFallback}>
                                      {toReviewerInitial(review, index)}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                        : heroSlides
                            .slice(0, REVIEW_LIMIT)
                            .map((slide, index) => (
                              <div
                                key={`review-fallback-avatar-${slide._id}-${index}`}
                                className={styles.avatarItem}
                              >
                                {slide.imageUrl ? (
                                  <Image
                                    src={slide.imageUrl}
                                    alt={slide.title}
                                    fill
                                    sizes="22px"
                                    className={styles.avatarImage}
                                  />
                                ) : (
                                  <span className={styles.avatarFallback}>
                                    {index + 1}
                                  </span>
                                )}
                              </div>
                            ))}
                    </div>
                    <div className={styles.reviewMeta}>
                      <div className={styles.stars}>
                        {featuredReviewsLoading ? "★★★★★" : reviewStars}
                      </div>
                      <div>
                        {featuredReviewsLoading
                          ? "Loading reviews..."
                          : formatReviewCountLabel(reviewCount)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.bottomRow}>
                <p className={styles.description}>
                  Compare real ratings, room types, and date-based availability
                  to book with confidence on Meomul.
                </p>
                <Link href={activeSlideHref} className={styles.watchBubble}>
                  {activeSlideData?.imageUrl ? (
                    <Image
                      src={activeSlideData.imageUrl}
                      alt={activeSlideData.title}
                      fill
                      sizes="120px"
                      className={styles.watchImage}
                    />
                  ) : (
                    <div className={styles.watchFallback} />
                  )}
                  <div className={styles.watchOverlay}>
                    <span>Preview</span>
                    <span>▶</span>
                  </div>
                </Link>
              </div>
            </div>

            <div
              className={styles.heroRight}
              onMouseEnter={() => setIsSliderPaused(true)}
              onMouseLeave={() => setIsSliderPaused(false)}
            >
              <div className={styles.sliderViewport}>
                {heroSlides.map((slide, index) => {
                  const isActive = index === activeSlide;
                  const slideHref = slide._id.startsWith("fallback-")
                    ? "/hotels"
                    : `/hotels/${slide._id}`;

                  return (
                    <Link
                      key={`${slide._id}-${index}`}
                      href={slideHref}
                      className={`${styles.slide} ${isActive ? styles.slideActive : ""}`}
                      aria-hidden={!isActive}
                      tabIndex={isActive ? 0 : -1}
                    >
                      {slide.imageUrl ? (
                        <Image
                          src={slide.imageUrl}
                          alt={slide.title}
                          fill
                          priority={index === 0}
                          sizes="(max-width: 767px) 100vw, (max-width: 991px) 720px, 900px"
                          className={styles.slideImage}
                        />
                      ) : (
                        <div className={styles.slideFallback} />
                      )}
                      <div className={styles.slideShade} />
                      <div className={styles.slideMeta}>
                        <div className={styles.slideTags}>
                          <span>
                            {formatHotelLocationLabel(slide.location)}
                          </span>
                          <span>{slide.hotelType}</span>
                        </div>
                        <h3>{slide.title}</h3>
                        <p>
                          ⭐ {slide.rating.toFixed(1)} ·{" "}
                          {slide.likes.toLocaleString()} likes
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className={styles.dots}>
                {heroSlides.map((slide, index) => (
                  <button
                    key={`dot-${slide._id}-${index}`}
                    type="button"
                    className={`${styles.dot} ${index === activeSlide ? styles.dotActive : ""}`}
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Show slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {isMounted && recentViewedCards.length > 0 ? (
            <section className={styles.trendingSection}>
              <div className={styles.trendingHeader}>
                <div>
                  <p className={styles.trendingEyebrow}>Recently Viewed</p>
                  <h2 className={styles.trendingTitle}>
                    Pick up where you left off
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={styles.trendingLink}
                    onClick={handleClearRecentlyViewed}
                  >
                    Clear history
                  </button>
                  <Link href="/hotels" className={styles.trendingLink}>
                    Browse all stays <span aria-hidden>↗</span>
                  </Link>
                </div>
              </div>

              <div className={styles.trendingRail} role="list">
                {recentViewedCards.map((hotel) => (
                  <article
                    key={`recent-hotel-${hotel.hotelId}`}
                    className={styles.trendingCard}
                    role="listitem"
                  >
                    <Link
                      href={`/hotels/${hotel.hotelId}`}
                      className={styles.trendingCardLink}
                    >
                      {hotel.imageUrl ? (
                        <Image
                          src={hotel.imageUrl}
                          alt={hotel.hotelTitle}
                          fill
                          sizes="(max-width: 640px) 88vw, (max-width: 1180px) 46vw, 28vw"
                          className={styles.trendingCardImage}
                        />
                      ) : (
                        <div className={styles.trendingCardFallback} />
                      )}
                      <div className={styles.trendingCardShade} />
                      <div className={styles.trendingCardContent}>
                        <h3>{hotel.hotelTitle}</h3>
                        <p className={styles.trendingMeta}>
                          {formatHotelLocationLabel(hotel.hotelLocation)} ·{" "}
                          {hotel.hotelType}
                        </p>
                        <div className={styles.trendingStats}>
                          <span>★ {hotel.hotelRating.toFixed(1)}</span>
                          <span>{hotel.hotelLikes.toLocaleString()} likes</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {editorialGuideCards.length > 0 ? (
            <section className={styles.guidesSection}>
              <div className={styles.guidesHeader}>
                <p className={styles.guidesEyebrow}>Editorial Guides</p>
                <h2 className={styles.guidesTitle}>
                  Start with a trip plan, not a blank search
                </h2>
                <p className={styles.guidesDescription}>
                  Curated routes into pre-filtered results so guests can move
                  from idea to booking faster.
                </p>
              </div>

              <div className={styles.guidesGrid}>
                {editorialGuideCards.map((guide) => (
                  <article key={guide.id} className={styles.guideCard}>
                    <Link href={guide.href} className={styles.guideCardLink}>
                      {guide.imageUrl ? (
                        <Image
                          src={guide.imageUrl}
                          alt={guide.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1180px) 50vw, 25vw"
                          className={styles.guideCardImage}
                        />
                      ) : (
                        <div className={styles.guideCardFallback} />
                      )}
                      <div className={styles.guideCardShade} />
                      <div className={styles.guideCardContent}>
                        <p className={styles.guideCardEyebrow}>
                          {guide.eyebrow}
                        </p>
                        <h3>{guide.title}</h3>
                        <p className={styles.guideCardDescription}>
                          {guide.description}
                        </p>
                        <p className={styles.guideCardMeta}>
                          {formatHotelLocationLabel(guide.location)} ·{" "}
                          {guide.checkIn} - {guide.checkOut} · {guide.guests}{" "}
                          guest{guide.guests === "1" ? "" : "s"}
                        </p>
                        <span className={styles.guideCardCta}>
                          Open plan <span aria-hidden>↗</span>
                        </span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {recommendedCards.length > 0 ? (
            <section className={styles.signatureSection}>
              <div className={styles.signatureHeader}>
                <p className={styles.signatureEyebrow}>Recommended Stays</p>
                <h2 className={styles.signatureTitle}>Recommendations</h2>
                <p className={styles.signatureDescription}>
                  Curated from your travel profile, live guest behavior, and
                  top-performing hotels across the platform.
                </p>
              </div>

              <div className={styles.signatureRows}>
                {recommendedRows.map((row, rowIndex) => (
                  <div
                    key={`recommended-row-${rowIndex}`}
                    className={styles.signatureRow}
                  >
                    {row.map((hotel, colIndex) => {
                      const globalIndex = rowIndex * 3 + colIndex;
                      const isActive = globalIndex === activeRecommendedCard;

                      return (
                        <article
                          key={`recommended-hotel-${hotel._id}`}
                          className={`${styles.signatureCard} ${isActive ? styles.signatureCardActive : ""}`}
                          onMouseEnter={() =>
                            setActiveRecommendedCard(globalIndex)
                          }
                          onFocus={() => setActiveRecommendedCard(globalIndex)}
                        >
                          <Link
                            href={`/hotels/${hotel._id}`}
                            className={styles.signatureCardLink}
                          >
                            {hotel.imageUrl ? (
                              <Image
                                src={hotel.imageUrl}
                                alt={hotel.title}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1180px) 50vw, 33vw"
                                className={styles.signatureCardImage}
                              />
                            ) : (
                              <div className={styles.signatureCardFallback} />
                            )}

                            <div className={styles.signatureCardShade} />
                            <div className={styles.signatureCardContent}>
                              <h3>{hotel.title}</h3>
                              <p className={styles.signatureCardMeta}>
                                {formatHotelLocationLabel(hotel.location)} ·{" "}
                                {hotel.hotelType} · ★ {hotel.rating.toFixed(1)}
                              </p>
                              <p className={styles.signatureCardSignal}>
                                {hotel.signal}
                              </p>
                              <span className={styles.signatureCardCta}>
                                View details
                                <span aria-hidden>↗</span>
                              </span>
                            </div>
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {trendingRailCards.length > 0 ? (
            <section className={styles.trendingSection}>
              <div className={styles.trendingHeader}>
                <div>
                  <p className={styles.trendingEyebrow}>Trending Now</p>
                  <h2 className={styles.trendingTitle}>
                    Stays guests are booking right now
                  </h2>
                </div>
                <Link href="/hotels" className={styles.trendingLink}>
                  Browse all stays <span aria-hidden>↗</span>
                </Link>
              </div>

              <div className={styles.trendingRail} role="list">
                {trendingRailCards.map((hotel) => (
                  <article
                    key={`trending-hotel-${hotel._id}`}
                    className={styles.trendingCard}
                    role="listitem"
                  >
                    <Link
                      href={`/hotels/${hotel._id}`}
                      className={styles.trendingCardLink}
                    >
                      {hotel.hotelImages[0] ? (
                        <Image
                          src={resolveMediaUrl(hotel.hotelImages[0])}
                          alt={hotel.hotelTitle}
                          fill
                          sizes="(max-width: 640px) 88vw, (max-width: 1180px) 46vw, 28vw"
                          className={styles.trendingCardImage}
                        />
                      ) : (
                        <div className={styles.trendingCardFallback} />
                      )}
                      <div className={styles.trendingCardShade} />
                      <div className={styles.trendingCardContent}>
                        <h3>{hotel.hotelTitle}</h3>
                        <p className={styles.trendingMeta}>
                          {formatHotelLocationLabel(hotel.hotelLocation)} ·{" "}
                          {hotel.hotelType}
                        </p>
                        <div className={styles.trendingStats}>
                          <span>★ {hotel.hotelRating.toFixed(1)}</span>
                          <span>{hotel.hotelLikes.toLocaleString()} likes</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {valuePillars.length > 0 ? (
            <section className={styles.valueSection}>
              <div className={styles.valueHeader}>
                <p className={styles.valueEyebrow}>Why guests choose Meomul</p>
                <h2 className={styles.valueTitle}>
                  Built for decision speed and booking confidence
                </h2>
              </div>

              <div className={styles.valueGrid}>
                {valuePillars.map((pillar) => (
                  <article key={pillar.title} className={styles.valueCard}>
                    <p className={styles.valueCardTitle}>{pillar.title}</p>
                    <p className={styles.valueCardMetric}>{pillar.metric}</p>
                    <p className={styles.valueCardDetail}>{pillar.detail}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {lastMinuteDeals.length > 0 ? (
            <section className={styles.dealsSection}>
              <div className={styles.dealsHeader}>
                <div>
                  <p className={styles.dealsEyebrow}>Last Minute Deals</p>
                  <h2 className={styles.dealsTitle}>Rooms with active limited-time pricing</h2>
                </div>
                <Link href="/hotels" className={styles.dealsLink}>
                  Browse all stays <span aria-hidden>↗</span>
                </Link>
              </div>

              <div className={styles.dealsRail} role="list">
                {lastMinuteDeals.map((deal) => (
                  <article key={`deal-room-${deal.roomId}`} className={styles.dealCard} role="listitem">
                    <Link href={`/rooms/${deal.roomId}`} className={styles.dealCardLink}>
                      {deal.imageUrl ? (
                        <Image
                          src={deal.imageUrl}
                          alt={`${deal.roomName} at ${deal.hotelTitle}`}
                          fill
                          sizes="(max-width: 640px) 88vw, (max-width: 1180px) 46vw, 28vw"
                          className={styles.dealCardImage}
                        />
                      ) : (
                        <div className={styles.dealCardFallback} />
                      )}
                      <div className={styles.dealCardShade} />
                      <div className={styles.dealBadge}>-{deal.discountPercent}%</div>
                      <div className={styles.dealCardContent}>
                        <p className={styles.dealHotelMeta}>
                          {formatHotelLocationLabel(deal.hotelLocation)} · {deal.hotelTitle}
                        </p>
                        <h3>{deal.roomName}</h3>
                        <p className={styles.dealRoomMeta}>{deal.roomType} room</p>
                        <div className={styles.dealPriceRow}>
                          <span className={styles.dealPrice}>₩ {deal.dealPrice.toLocaleString()}</span>
                          <span className={styles.dealOriginalPrice}>₩ {deal.basePrice.toLocaleString()}</span>
                        </div>
                        <p className={styles.dealExpiry}>{formatDealExpiryLabel(deal.validUntil)}</p>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {testimonialReviews.length > 0 ? (
            <section className={styles.testimonialsSection}>
              <div className={styles.testimonialsHeader}>
                <div className={styles.testimonialsTopRow}>
                  <p className={styles.testimonialsEyebrow}>
                    <span>Testimonials</span>
                  </p>
                </div>
                <h2 className={styles.testimonialsTitle}>
                  Trusted by guests booking through Meomul
                </h2>
                <p className={styles.testimonialsDescription}>
                  Real verified stays from our live booking flow, with review
                  quality reflected directly in hotel ranking.
                </p>
              </div>

              <div
                ref={testimonialsRailRef}
                className={styles.testimonialsRail}
                role="list"
                onScroll={handleTestimonialsScroll}
              >
                {loopedTestimonialReviews.map((entry, index) => {
                  const review = entry.review;
                  const normalizedIndex =
                    testimonialReviews.length > 0
                      ? index % testimonialReviews.length
                      : index;
                  const isActive = normalizedIndex === activeTestimonialCard;
                  const isAccentCard = !isActive && (index + 1) % 4 === 0;
                  const filledStars = Math.max(
                    0,
                    Math.min(5, Math.round(review.overallRating || 0)),
                  );
                  const reviewerImageUrl = resolveMediaUrl(
                    review.reviewerImage,
                  );
                  const reviewerName =
                    review.reviewerNick?.trim() || "Verified guest";
                  const featuredHotelTitle = entry.hotelTitle || "Meomul stay";

                  return (
                    <article
                      key={`testimonial-${review._id}-${entry.hotelId}-${index}`}
                      className={`${styles.testimonialCard} ${isActive ? styles.testimonialCardActive : ""} ${isAccentCard ? styles.testimonialCardAccent : ""}`}
                      role="listitem"
                      data-testimonial-index={index}
                      onMouseEnter={() =>
                        setActiveTestimonialCard(normalizedIndex)
                      }
                      onClick={() => setActiveTestimonialCard(normalizedIndex)}
                      onFocus={() => setActiveTestimonialCard(normalizedIndex)}
                    >
                      <header className={styles.testimonialCardHeader}>
                        <div className={styles.testimonialAvatar}>
                          {reviewerImageUrl ? (
                            <Image
                              src={reviewerImageUrl}
                              alt={reviewerName}
                              fill
                              sizes="56px"
                              className={styles.testimonialAvatarImage}
                            />
                          ) : (
                            <span className={styles.testimonialAvatarFallback}>
                              {toReviewerInitial(review, index)}
                            </span>
                          )}
                        </div>
                        <div className={styles.testimonialReviewer}>
                          <h3>{reviewerName}</h3>
                          <p>
                            {toStayPeriodLabel(review)} · {featuredHotelTitle}
                          </p>
                        </div>
                      </header>

                      <div className={styles.testimonialDivider} />

                      <div
                        className={styles.testimonialStars}
                        aria-label={`Rated ${filledStars} out of 5`}
                      >
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <span
                            key={`review-star-${review._id}-${starIndex}`}
                            className={
                              starIndex < filledStars
                                ? styles.testimonialStarFilled
                                : styles.testimonialStarEmpty
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>

                      <p className={styles.testimonialQuote}>
                        &ldquo;{toTestimonialQuote(review)}&rdquo;
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<HomePageProps> = async (
  context,
) => {
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
    const [hotelsResult, trendingResult, dealsResult, testimonialsResult] =
      await Promise.all([
        client.query<GetHotelsQueryData, GetHotelsQueryVars>({
          query: GET_HOTELS_QUERY,
          variables: { input: HERO_QUERY_INPUT },
          fetchPolicy: "no-cache",
        }),
        client.query<GetTrendingHotelsQueryData, GetTrendingHotelsQueryVars>({
          query: GET_TRENDING_HOTELS_QUERY,
          variables: { limit: TRENDING_RAIL_LIMIT },
          fetchPolicy: "no-cache",
        }),
        client.query<
          GetHomeLastMinuteDealsQueryData,
          GetHomeLastMinuteDealsQueryVars
        >({
          query: GET_HOME_LAST_MINUTE_DEALS_QUERY,
          variables: { limit: LAST_MINUTE_DEALS_LIMIT },
          fetchPolicy: "no-cache",
        }),
        client.query<GetHomeTestimonialsQueryData, GetHomeTestimonialsQueryVars>(
          {
            query: GET_HOME_TESTIMONIALS_QUERY,
            variables: { limit: TESTIMONIAL_LIMIT },
            fetchPolicy: "no-cache",
          },
        ),
      ]);

    const initialTopHotels = hotelsResult.data?.getHotels.list ?? [];
    const initialHotelInventoryTotal =
      hotelsResult.data?.getHotels.metaCounter.total ?? 0;
    const initialTrendingHotels = trendingResult.data?.getTrendingHotels ?? [];
    const initialLastMinuteDeals =
      dealsResult.data?.getHomeLastMinuteDeals.map((deal) => ({
        ...deal,
        validUntil: String(deal.validUntil),
      })) ?? [];
    const initialTestimonials =
      testimonialsResult.data?.getHomeTestimonials.map((entry) => ({
        hotelId: entry.hotelId,
        hotelTitle: entry.hotelTitle,
        review: entry.review,
      })) ?? [];

    let initialFeaturedReviews: ReviewDto[] = [];
    let initialFeaturedRatingsSummary: ReviewRatingsSummaryDto | null = null;

    const featuredHotelId = initialTopHotels[0]?._id;
    if (featuredHotelId) {
      try {
        const reviewsResult = await client.query<
          GetHotelReviewsQueryData,
          GetHotelReviewsQueryVars
        >({
          query: GET_HOTEL_REVIEWS_QUERY,
          variables: {
            hotelId: featuredHotelId,
            input: REVIEW_QUERY_INPUT,
          },
          fetchPolicy: "no-cache",
        });

        initialFeaturedReviews = reviewsResult.data?.getHotelReviews.list ?? [];
        initialFeaturedRatingsSummary =
          reviewsResult.data?.getHotelReviews.ratingsSummary ?? null;
      } catch {
        initialFeaturedReviews = [];
        initialFeaturedRatingsSummary = null;
      }
    }

    return {
      props: {
        initialTopHotels,
        initialHotelInventoryTotal,
        initialTrendingHotels,
        initialFeaturedReviews,
        initialFeaturedRatingsSummary,
        initialTestimonials,
        initialLastMinuteDeals,
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
