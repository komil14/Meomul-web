import { useApolloClient, useQuery } from "@apollo/client/react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  GET_HOTELS_QUERY,
  GET_HOTEL_REVIEWS_QUERY,
  GET_RECOMMENDED_HOTELS_V2_QUERY,
  GET_ROOMS_BY_HOTEL_QUERY,
  GET_TRENDING_HOTELS_QUERY,
} from "@/graphql/hotel.gql";
import { getAccessToken } from "@/lib/auth/session";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import {
  clearRecentlyViewedHotels,
  readRecentlyViewedHotels,
  type RecentlyViewedHotelEntry,
} from "@/lib/hotels/recently-viewed";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelReviewsQueryData,
  GetHotelReviewsQueryVars,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  GetRecommendedHotelsV2QueryData,
  GetRecommendedHotelsV2QueryVars,
  GetRoomsByHotelQueryData,
  GetRoomsByHotelQueryVars,
  GetTrendingHotelsQueryData,
  GetTrendingHotelsQueryVars,
  HotelLocation,
  HotelListItem,
  PaginationInput,
  RoomListItem,
  StayPurpose,
  ReviewDto,
} from "@/types/hotel";
import styles from "@/styles/home-landing-ovastin.module.css";

const HERO_LIMIT = 5;
const HERO_ROTATION_MS = 4000;
const REVIEW_LIMIT = 5;
const RECOMMENDED_GRID_LIMIT = 6;
const TRENDING_RAIL_LIMIT = 10;
const TESTIMONIAL_LIMIT = 6;
const LAST_MINUTE_HOTELS_LIMIT = 8;
const LAST_MINUTE_ROOMS_PER_HOTEL = 8;
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
  roomType: string;
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
  const expiresAt = new Date(validUntil).getTime();
  if (!Number.isFinite(expiresAt)) {
    return "Ends soon";
  }

  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) {
    return "Expired";
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `Ends in ${hours}h ${minutes}m`;
  }
  return `Ends in ${minutes}m`;
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

const getNextWeekendRange = (): { checkIn: string; checkOut: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const checkInDate = addDays(today, daysUntilSaturday);
  const checkOutDate = addDays(checkInDate, 2);
  return {
    checkIn: toIsoLocalDate(checkInDate),
    checkOut: toIsoLocalDate(checkOutDate),
  };
};

const getNextBusinessRange = (): { checkIn: string; checkOut: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

export default function HomePage() {
  const apolloClient = useApolloClient();
  const [isMounted, setIsMounted] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);
  const [activeRecommendedCard, setActiveRecommendedCard] = useState(1);
  const [activeTestimonialCard, setActiveTestimonialCard] = useState(0);
  const [recentlyViewedHotels, setRecentlyViewedHotels] = useState<
    RecentlyViewedHotelEntry[]
  >([]);
  const [lastMinuteDeals, setLastMinuteDeals] = useState<LastMinuteDealCard[]>(
    [],
  );
  const [testimonialEntries, setTestimonialEntries] = useState<
    TestimonialReviewEntry[]
  >([]);
  const testimonialsRailRef = useRef<HTMLDivElement | null>(null);

  const { data: topHotelsData, error: topHotelsError } = useQuery<
    GetHotelsQueryData,
    GetHotelsQueryVars
  >(GET_HOTELS_QUERY, {
    variables: { input: HERO_QUERY_INPUT },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const topHotels = useMemo(
    () => topHotelsData?.getHotels.list ?? [],
    [topHotelsData?.getHotels.list],
  );
  const stableTopHotels = useMemo(
    () => (isMounted ? topHotels : []),
    [isMounted, topHotels],
  );
  const heroSlides = useMemo(
    () => toHeroSlides(stableTopHotels),
    [stableTopHotels],
  );
  const featuredHotelId = stableTopHotels[0]?._id ?? "";

  const { data: featuredReviewsData, loading: featuredReviewsLoading } =
    useQuery<GetHotelReviewsQueryData, GetHotelReviewsQueryVars>(
      GET_HOTEL_REVIEWS_QUERY,
      {
        skip: !featuredHotelId,
        variables: {
          hotelId: featuredHotelId,
          input: REVIEW_QUERY_INPUT,
        },
        fetchPolicy: "cache-and-network",
        nextFetchPolicy: "cache-and-network",
      },
    );

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

  const { data: trendingHotelsData } = useQuery<
    GetTrendingHotelsQueryData,
    GetTrendingHotelsQueryVars
  >(GET_TRENDING_HOTELS_QUERY, {
    variables: { limit: RECOMMENDED_GRID_LIMIT },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    setIsMounted(true);
    setHasAccessToken(Boolean(getAccessToken()));
    setRecentlyViewedHotels(readRecentlyViewedHotels());
  }, []);

  const handleClearRecentlyViewed = useCallback(() => {
    clearRecentlyViewedHotels();
    setRecentlyViewedHotels([]);
  }, []);

  useEffect(() => {
    setActiveSlide(0);
  }, [heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1 || isSliderPaused) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, HERO_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [heroSlides.length, isSliderPaused]);

  const activeSlideData = heroSlides[activeSlide] ?? heroSlides[0];
  const activeSlideHref = activeSlideData?._id.startsWith("fallback-")
    ? "/hotels"
    : `/hotels/${activeSlideData?._id ?? ""}`;
  const featuredReviews = useMemo(
    () => (isMounted ? (featuredReviewsData?.getHotelReviews.list ?? []) : []),
    [featuredReviewsData?.getHotelReviews.list, isMounted],
  );
  const ratingsSummary = isMounted
    ? featuredReviewsData?.getHotelReviews.ratingsSummary
    : undefined;
  const reviewCount = isMounted
    ? (ratingsSummary?.totalReviews ??
      featuredReviewsData?.getHotelReviews.metaCounter.total ??
      0)
    : 0;
  const reviewRating = isMounted
    ? (ratingsSummary?.overallRating ?? activeSlideData?.rating ?? 0)
    : (activeSlideData?.rating ?? 0);
  const reviewStars = formatRatingStars(reviewRating);
  const testimonialSourceHotels = useMemo(
    () =>
      stableTopHotels.slice(0, 4).map((hotel) => ({
        hotelId: hotel._id,
        hotelTitle: hotel.hotelTitle,
      })),
    [stableTopHotels],
  );

  useEffect(() => {
    if (!isMounted || testimonialSourceHotels.length === 0) {
      setTestimonialEntries([]);
      return;
    }

    let isCancelled = false;

    const loadTestimonials = async (): Promise<void> => {
      try {
        const reviewGroups = await Promise.all(
          testimonialSourceHotels.map(async (hotel) => {
            const result = await apolloClient.query<
              GetHotelReviewsQueryData,
              GetHotelReviewsQueryVars
            >({
              query: GET_HOTEL_REVIEWS_QUERY,
              variables: {
                hotelId: hotel.hotelId,
                input: {
                  ...REVIEW_QUERY_INPUT,
                  limit: 3,
                },
              },
              fetchPolicy: "network-only",
            });

            return {
              hotelId: hotel.hotelId,
              hotelTitle: hotel.hotelTitle,
              reviews: result.data?.getHotelReviews.list ?? [],
            };
          }),
        );

        if (isCancelled) {
          return;
        }

        const mergedEntries = reviewGroups
          .flatMap((group) =>
            group.reviews.map((review) => ({
              review,
              hotelId: group.hotelId,
              hotelTitle: group.hotelTitle,
            })),
          )
          .sort((a, b) => {
            const aTimestamp = new Date(
              a.review.stayDate || a.review.createdAt,
            ).getTime();
            const bTimestamp = new Date(
              b.review.stayDate || b.review.createdAt,
            ).getTime();
            return bTimestamp - aTimestamp;
          })
          .slice(0, TESTIMONIAL_LIMIT);

        setTestimonialEntries(mergedEntries);
      } catch {
        if (!isCancelled) {
          setTestimonialEntries([]);
        }
      }
    };

    void loadTestimonials();

    return () => {
      isCancelled = true;
    };
  }, [apolloClient, isMounted, testimonialSourceHotels]);

  const recommendationSignalsByHotelId = useMemo(() => {
    const signalMap = new Map<string, string>();
    const explanations = isMounted
      ? (recommendedHotelsData?.getRecommendedHotelsV2.explanations ?? [])
      : [];
    explanations.forEach((explanation) => {
      const topSignal = explanation.signals?.[0];
      if (topSignal) {
        signalMap.set(explanation.hotelId, topSignal);
      }
    });
    return signalMap;
  }, [isMounted, recommendedHotelsData?.getRecommendedHotelsV2.explanations]);

  const recommendedCards = useMemo<RecommendedCard[]>(() => {
    const personalized = isMounted
      ? (recommendedHotelsData?.getRecommendedHotelsV2.list ?? [])
      : [];
    const trending = isMounted
      ? (trendingHotelsData?.getTrendingHotels ?? [])
      : [];
    const merged = uniqueHotelsById([
      ...personalized,
      ...trending,
      ...stableTopHotels,
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
    isMounted,
    recommendedHotelsData?.getRecommendedHotelsV2.list,
    recommendationSignalsByHotelId,
    stableTopHotels,
    trendingHotelsData?.getTrendingHotels,
  ]);

  const recommendedRows = useMemo(
    () =>
      [recommendedCards.slice(0, 3), recommendedCards.slice(3, 6)].filter(
        (row) => row.length > 0,
      ),
    [recommendedCards],
  );

  const trendingRailCards = useMemo(() => {
    const trendingHotels = isMounted
      ? (trendingHotelsData?.getTrendingHotels ?? [])
      : [];
    const recommendationHotels = isMounted
      ? (recommendedHotelsData?.getRecommendedHotelsV2.list ?? [])
      : [];
    return uniqueHotelsById([
      ...trendingHotels,
      ...recommendationHotels,
      ...stableTopHotels,
    ]).slice(0, TRENDING_RAIL_LIMIT);
  }, [
    isMounted,
    recommendedHotelsData?.getRecommendedHotelsV2.list,
    stableTopHotels,
    trendingHotelsData?.getTrendingHotels,
  ]);
  const recentViewedCards = useMemo(
    () => recentlyViewedHotels.slice(0, 6),
    [recentlyViewedHotels],
  );
  const editorialGuideCards = useMemo<EditorialGuideCard[]>(() => {
    if (!isMounted) {
      return [];
    }

    const weekendRange = getNextWeekendRange();
    const businessRange = getNextBusinessRange();
    const imageCandidates = uniqueHotelsById([
      ...stableTopHotels,
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
  }, [heroSlides, isMounted, stableTopHotels, trendingRailCards]);
  const dealSourceHotels = useMemo(() => {
    const personalized = isMounted
      ? (recommendedHotelsData?.getRecommendedHotelsV2.list ?? [])
      : [];
    const trending = isMounted
      ? (trendingHotelsData?.getTrendingHotels ?? [])
      : [];

    return uniqueHotelsById([
      ...personalized,
      ...trending,
      ...stableTopHotels,
    ]).slice(0, LAST_MINUTE_HOTELS_LIMIT);
  }, [
    isMounted,
    recommendedHotelsData?.getRecommendedHotelsV2.list,
    stableTopHotels,
    trendingHotelsData?.getTrendingHotels,
  ]);

  useEffect(() => {
    if (!isMounted || dealSourceHotels.length === 0) {
      setLastMinuteDeals([]);
      return;
    }

    let isCancelled = false;

    const loadLastMinuteDeals = async (): Promise<void> => {
      try {
        const roomGroups = await Promise.all(
          dealSourceHotels.map(async (hotel) => {
            const result = await apolloClient.query<
              GetRoomsByHotelQueryData,
              GetRoomsByHotelQueryVars
            >({
              query: GET_ROOMS_BY_HOTEL_QUERY,
              variables: {
                hotelId: hotel._id,
                input: {
                  page: 1,
                  limit: LAST_MINUTE_ROOMS_PER_HOTEL,
                  sort: "updatedAt",
                  direction: -1,
                },
              },
              fetchPolicy: "network-only",
            });

            return {
              hotel,
              rooms: result.data?.getRoomsByHotel.list ?? [],
            };
          }),
        );

        if (isCancelled) {
          return;
        }

        const now = Date.now();
        const deals = roomGroups
          .flatMap(({ hotel, rooms }) =>
            rooms
              .filter((room: RoomListItem) => {
                if (!room.lastMinuteDeal?.isActive) {
                  return false;
                }

                const expiresAt = new Date(room.lastMinuteDeal.validUntil).getTime();
                return Number.isFinite(expiresAt) && expiresAt > now;
              })
              .map((room: RoomListItem) => ({
                roomId: room._id,
                hotelId: hotel._id,
                hotelTitle: hotel.hotelTitle,
                hotelLocation: hotel.hotelLocation,
                roomName: room.roomName,
                roomType: room.roomType,
                imageUrl: resolveMediaUrl(room.roomImages[0] || hotel.hotelImages[0]),
                basePrice: room.lastMinuteDeal?.originalPrice ?? room.basePrice,
                dealPrice: room.lastMinuteDeal?.dealPrice ?? room.basePrice,
                discountPercent: room.lastMinuteDeal?.discountPercent ?? 0,
                validUntil: room.lastMinuteDeal?.validUntil ?? "",
              })),
          )
          .sort((a, b) => {
            if (b.discountPercent !== a.discountPercent) {
              return b.discountPercent - a.discountPercent;
            }
            return new Date(a.validUntil).getTime() - new Date(b.validUntil).getTime();
          })
          .slice(0, LAST_MINUTE_DEALS_LIMIT);

        setLastMinuteDeals(deals);
      } catch {
        if (!isCancelled) {
          setLastMinuteDeals([]);
        }
      }
    };

    void loadLastMinuteDeals();

    return () => {
      isCancelled = true;
    };
  }, [apolloClient, dealSourceHotels, isMounted]);

  const valuePillars = useMemo(() => {
    const hotelInventoryTotal = isMounted
      ? (topHotelsData?.getHotels.metaCounter.total ?? 0)
      : 0;
    const averageHeroRating =
      stableTopHotels.length > 0
        ? stableTopHotels.reduce(
            (sum, hotel) => sum + (hotel.hotelRating ?? 0),
            0,
          ) / stableTopHotels.length
        : 0;
    const trendingLikes = trendingRailCards.reduce(
      (sum, hotel) => sum + (hotel.hotelLikes ?? 0),
      0,
    );
    const recommendationMeta = isMounted
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
    isMounted,
    hasAccessToken,
    recommendedHotelsData?.getRecommendedHotelsV2.meta,
    reviewCount,
    stableTopHotels,
    topHotelsData?.getHotels.metaCounter.total,
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
    () => testimonialEntries,
    [testimonialEntries],
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
    if (!isMounted || !rail || testimonialReviews.length <= 1) {
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
  }, [isMounted, testimonialReviews.length]);

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
          {topHotelsError ? (
            <ErrorNotice message={getErrorMessage(topHotelsError)} />
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
                          : reviewCount > 0
                            ? `${reviewCount.toLocaleString()}k+ verified reviews`
                            : "No reviews yet"}
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

          {isMounted && recommendedCards.length > 0 ? (
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

          {isMounted && trendingRailCards.length > 0 ? (
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

          {isMounted ? (
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

          {isMounted && lastMinuteDeals.length > 0 ? (
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

          {isMounted && testimonialReviews.length > 0 ? (
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


          {isMounted && editorialGuideCards.length > 0 ? (
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

        </div>
      </main>
    </>
  );
}
