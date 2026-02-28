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
  GET_TRENDING_HOTELS_QUERY,
} from "@/graphql/hotel.gql";
import { getAccessToken } from "@/lib/auth/session";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelReviewsQueryData,
  GetHotelReviewsQueryVars,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  GetRecommendedHotelsV2QueryData,
  GetRecommendedHotelsV2QueryVars,
  GetTrendingHotelsQueryData,
  GetTrendingHotelsQueryVars,
  HotelListItem,
  PaginationInput,
  ReviewDto,
} from "@/types/hotel";
import styles from "@/styles/home-landing-ovastin.module.css";

const HERO_LIMIT = 5;
const HERO_ROTATION_MS = 4000;
const REVIEW_LIMIT = 5;
const RECOMMENDED_GRID_LIMIT = 6;
const TRENDING_RAIL_LIMIT = 10;
const TESTIMONIAL_LIMIT = 6;

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

  const fallbackSlides = Array.from({ length: HERO_LIMIT - slides.length }, (_, index) => createFallbackSlide(index));
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
  const source = review.reviewText?.trim() || review.reviewTitle?.trim() || "Great stay experience.";
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

export default function HomePage() {
  const apolloClient = useApolloClient();
  const [isMounted, setIsMounted] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);
  const [activeRecommendedCard, setActiveRecommendedCard] = useState(1);
  const [activeTestimonialCard, setActiveTestimonialCard] = useState(0);
  const [testimonialEntries, setTestimonialEntries] = useState<TestimonialReviewEntry[]>([]);
  const testimonialsRailRef = useRef<HTMLDivElement | null>(null);

  const {
    data: topHotelsData,
    error: topHotelsError,
  } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    variables: { input: HERO_QUERY_INPUT },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const topHotels = useMemo(() => topHotelsData?.getHotels.list ?? [], [topHotelsData?.getHotels.list]);
  const stableTopHotels = useMemo(() => (isMounted ? topHotels : []), [isMounted, topHotels]);
  const heroSlides = useMemo(() => toHeroSlides(stableTopHotels), [stableTopHotels]);
  const featuredHotelId = stableTopHotels[0]?._id ?? "";

  const { data: featuredReviewsData, loading: featuredReviewsLoading } = useQuery<GetHotelReviewsQueryData, GetHotelReviewsQueryVars>(
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

  const { data: recommendedHotelsData } = useQuery<GetRecommendedHotelsV2QueryData, GetRecommendedHotelsV2QueryVars>(
    GET_RECOMMENDED_HOTELS_V2_QUERY,
    {
      variables: { limit: RECOMMENDED_GRID_LIMIT },
      skip: !hasAccessToken,
      errorPolicy: "ignore",
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const { data: trendingHotelsData } = useQuery<GetTrendingHotelsQueryData, GetTrendingHotelsQueryVars>(
    GET_TRENDING_HOTELS_QUERY,
    {
      variables: { limit: RECOMMENDED_GRID_LIMIT },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  useEffect(() => {
    setIsMounted(true);
    setHasAccessToken(Boolean(getAccessToken()));
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
  const activeSlideHref = activeSlideData?._id.startsWith("fallback-") ? "/hotels" : `/hotels/${activeSlideData?._id ?? ""}`;
  const featuredReviews = useMemo(
    () => (isMounted ? featuredReviewsData?.getHotelReviews.list ?? [] : []),
    [featuredReviewsData?.getHotelReviews.list, isMounted],
  );
  const ratingsSummary = isMounted ? featuredReviewsData?.getHotelReviews.ratingsSummary : undefined;
  const reviewCount = isMounted ? ratingsSummary?.totalReviews ?? featuredReviewsData?.getHotelReviews.metaCounter.total ?? 0 : 0;
  const reviewRating = isMounted ? ratingsSummary?.overallRating ?? activeSlideData?.rating ?? 0 : activeSlideData?.rating ?? 0;
  const reviewStars = formatRatingStars(reviewRating);
  const testimonialSourceHotels = useMemo(
    () =>
      stableTopHotels
        .slice(0, 4)
        .map((hotel) => ({
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
            const result = await apolloClient.query<GetHotelReviewsQueryData, GetHotelReviewsQueryVars>({
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
            const aTimestamp = new Date(a.review.stayDate || a.review.createdAt).getTime();
            const bTimestamp = new Date(b.review.stayDate || b.review.createdAt).getTime();
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
    const explanations = isMounted ? recommendedHotelsData?.getRecommendedHotelsV2.explanations ?? [] : [];
    explanations.forEach((explanation) => {
      const topSignal = explanation.signals?.[0];
      if (topSignal) {
        signalMap.set(explanation.hotelId, topSignal);
      }
    });
    return signalMap;
  }, [isMounted, recommendedHotelsData?.getRecommendedHotelsV2.explanations]);

  const recommendedCards = useMemo<RecommendedCard[]>(() => {
    const personalized = isMounted ? recommendedHotelsData?.getRecommendedHotelsV2.list ?? [] : [];
    const trending = isMounted ? trendingHotelsData?.getTrendingHotels ?? [] : [];
    const merged = uniqueHotelsById([...personalized, ...trending, ...stableTopHotels]).slice(0, RECOMMENDED_GRID_LIMIT);

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
    () => [recommendedCards.slice(0, 3), recommendedCards.slice(3, 6)].filter((row) => row.length > 0),
    [recommendedCards],
  );

  const trendingRailCards = useMemo(() => {
    const trendingHotels = isMounted ? trendingHotelsData?.getTrendingHotels ?? [] : [];
    const recommendationHotels = isMounted ? recommendedHotelsData?.getRecommendedHotelsV2.list ?? [] : [];
    return uniqueHotelsById([...trendingHotels, ...recommendationHotels, ...stableTopHotels]).slice(0, TRENDING_RAIL_LIMIT);
  }, [isMounted, recommendedHotelsData?.getRecommendedHotelsV2.list, stableTopHotels, trendingHotelsData?.getTrendingHotels]);

  const valuePillars = useMemo(() => {
    const hotelInventoryTotal = isMounted ? topHotelsData?.getHotels.metaCounter.total ?? 0 : 0;
    const averageHeroRating =
      stableTopHotels.length > 0 ? stableTopHotels.reduce((sum, hotel) => sum + (hotel.hotelRating ?? 0), 0) / stableTopHotels.length : 0;
    const trendingLikes = trendingRailCards.reduce((sum, hotel) => sum + (hotel.hotelLikes ?? 0), 0);
    const recommendationMeta = isMounted ? recommendedHotelsData?.getRecommendedHotelsV2.meta : undefined;

    const personalizationDetail = hasAccessToken
      ? recommendationMeta
        ? `${recommendationMeta.matchedLocationCount} location matches and ${recommendationMeta.strictStageCount + recommendationMeta.relaxedStageCount} strict-fit picks in your feed.`
        : "Profile-aware recommendations are active and adapt to your booking behavior."
      : "Sign in to unlock profile-aware recommendations based on onboarding + behavior signals.";

    return [
      {
        title: "Destination coverage",
        metric: hotelInventoryTotal > 0 ? `${hotelInventoryTotal.toLocaleString()} hotels` : "Curated inventory",
        detail: "Active stays across major Korea destinations, ranked daily by quality and guest demand.",
      },
      {
        title: "Guest trust layer",
        metric: reviewCount > 0 ? `${reviewCount.toLocaleString()} verified reviews` : "Live review scoring",
        detail: "Review scores and helpful feedback continuously shape ranking, visibility, and recommendations.",
      },
      {
        title: "Demand intelligence",
        metric: trendingLikes > 0 ? `${trendingLikes.toLocaleString()} demand signals` : "Real-time demand feed",
        detail:
          averageHeroRating > 0
            ? `Top stays currently average ★ ${averageHeroRating.toFixed(1)} based on recent guest interactions.`
            : "Trending, likes, and viewing patterns surface high-intent stays before they sell out.",
      },
      {
        title: "Personalized matching",
        metric: hasAccessToken ? "Onboarding + behavior" : "Ready when you sign in",
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

  const testimonialReviews = useMemo(() => testimonialEntries, [testimonialEntries]);

  const handleTestimonialsScroll = useCallback(() => {
    const rail = testimonialsRailRef.current;
    if (!rail) {
      return;
    }

    const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-testimonial-index]"));
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

    setActiveTestimonialCard((current) => (current === nearestIndex ? current : nearestIndex));
  }, []);

  useEffect(() => {
    if (testimonialReviews.length === 0) {
      setActiveTestimonialCard(0);
      return;
    }
    if (activeTestimonialCard >= testimonialReviews.length) {
      setActiveTestimonialCard(Math.max(0, testimonialReviews.length - 1));
    }
  }, [activeTestimonialCard, testimonialReviews.length]);

  return (
    <>
      <Script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" strategy="afterInteractive" />
      <Script id="ovastin-font-loader" strategy="afterInteractive">
        {`if (window.WebFont) { window.WebFont.load({ google: { families: ["Plus Jakarta Sans:300,400,500,600,700"] } }); }`}
      </Script>

      <main className={styles.page}>
        <div className={styles.shell}>
          {topHotelsError ? <ErrorNotice message={getErrorMessage(topHotelsError)} /> : null}

          <section className={styles.hero}>
            <div className={styles.heroLeft}>
              <div className={styles.subtitle}>
                <span className={styles.subtitleSlash} />
                <span>Smart Hotel Stays Start Here</span>
                <span className={styles.subtitleSlash} />
              </div>

              <h1 className={styles.title}>Book the Right Stay for Every Trip</h1>

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
                        ? featuredReviews.slice(0, REVIEW_LIMIT).map((review, index) => {
                            const reviewerImageUrl = resolveMediaUrl(review.reviewerImage);

                            return (
                              <div key={`review-avatar-${review._id}`} className={styles.avatarItem}>
                                {reviewerImageUrl ? (
                                  <Image src={reviewerImageUrl} alt={review.reviewerNick ?? "Guest reviewer"} fill sizes="22px" className={styles.avatarImage} />
                                ) : (
                                  <span className={styles.avatarFallback}>{toReviewerInitial(review, index)}</span>
                                )}
                              </div>
                            );
                          })
                        : heroSlides.slice(0, REVIEW_LIMIT).map((slide, index) => (
                            <div key={`review-fallback-avatar-${slide._id}-${index}`} className={styles.avatarItem}>
                              {slide.imageUrl ? (
                                <Image src={slide.imageUrl} alt={slide.title} fill sizes="22px" className={styles.avatarImage} />
                              ) : (
                                <span className={styles.avatarFallback}>{index + 1}</span>
                              )}
                            </div>
                          ))}
                    </div>
                    <div className={styles.reviewMeta}>
                      <div className={styles.stars}>{featuredReviewsLoading ? "★★★★★" : reviewStars}</div>
                      <div>
                        {featuredReviewsLoading
                          ? "Loading reviews..."
                          : reviewCount > 0
                            ? `${reviewCount.toLocaleString()} verified reviews`
                            : "No reviews yet"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.bottomRow}>
                <p className={styles.description}>
                  Compare real ratings, room types, and date-based availability to book with confidence on Meomul.
                </p>
                <Link href={activeSlideHref} className={styles.watchBubble}>
                  {activeSlideData?.imageUrl ? (
                    <Image src={activeSlideData.imageUrl} alt={activeSlideData.title} fill sizes="120px" className={styles.watchImage} />
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

            <div className={styles.heroRight} onMouseEnter={() => setIsSliderPaused(true)} onMouseLeave={() => setIsSliderPaused(false)}>
              <div className={styles.sliderViewport}>
                {heroSlides.map((slide, index) => {
                  const isActive = index === activeSlide;
                  const slideHref = slide._id.startsWith("fallback-") ? "/hotels" : `/hotels/${slide._id}`;

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
                          <span>{formatHotelLocationLabel(slide.location)}</span>
                          <span>{slide.hotelType}</span>
                        </div>
                        <h3>{slide.title}</h3>
                        <p>
                          ⭐ {slide.rating.toFixed(1)} · {slide.likes.toLocaleString()} likes
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

          {isMounted && recommendedCards.length > 0 ? (
            <section className={styles.signatureSection}>
              <div className={styles.signatureHeader}>
                <p className={styles.signatureEyebrow}>Recommended Stays</p>
                <h2 className={styles.signatureTitle}>Our signature stay recommendations</h2>
                <p className={styles.signatureDescription}>
                  Curated from your travel profile, live guest behavior, and top-performing hotels across the platform.
                </p>
              </div>

              <div className={styles.signatureRows}>
                {recommendedRows.map((row, rowIndex) => (
                  <div key={`recommended-row-${rowIndex}`} className={styles.signatureRow}>
                    {row.map((hotel, colIndex) => {
                      const globalIndex = rowIndex * 3 + colIndex;
                      const isActive = globalIndex === activeRecommendedCard;

                      return (
                        <article
                          key={`recommended-hotel-${hotel._id}`}
                          className={`${styles.signatureCard} ${isActive ? styles.signatureCardActive : ""}`}
                          onMouseEnter={() => setActiveRecommendedCard(globalIndex)}
                          onFocus={() => setActiveRecommendedCard(globalIndex)}
                        >
                          <Link href={`/hotels/${hotel._id}`} className={styles.signatureCardLink}>
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
                              <p className={styles.signatureCardIndex}>#{String(globalIndex + 1).padStart(2, "0")}</p>
                              <h3>{hotel.title}</h3>
                              <p className={styles.signatureCardMeta}>
                                {formatHotelLocationLabel(hotel.location)} · {hotel.hotelType} · ★ {hotel.rating.toFixed(1)}
                              </p>
                              <p className={styles.signatureCardSignal}>{hotel.signal}</p>
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
                  <h2 className={styles.trendingTitle}>Stays guests are booking right now</h2>
                </div>
                <Link href="/hotels" className={styles.trendingLink}>
                  Browse all stays <span aria-hidden>↗</span>
                </Link>
              </div>

              <div className={styles.trendingRail} role="list">
                {trendingRailCards.map((hotel, index) => (
                  <article key={`trending-hotel-${hotel._id}`} className={styles.trendingCard} role="listitem">
                    <Link href={`/hotels/${hotel._id}`} className={styles.trendingCardLink}>
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
                        <p className={styles.trendingRank}>#{String(index + 1).padStart(2, "0")}</p>
                        <h3>{hotel.hotelTitle}</h3>
                        <p className={styles.trendingMeta}>
                          {formatHotelLocationLabel(hotel.hotelLocation)} · {hotel.hotelType}
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
                <h2 className={styles.valueTitle}>Built for decision speed and booking confidence</h2>
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

          {isMounted && testimonialReviews.length > 0 ? (
            <section className={styles.testimonialsSection}>
              <div className={styles.testimonialsHeader}>
                <div className={styles.testimonialsTopRow}>
                  <p className={styles.testimonialsEyebrow}>
                    <span className={styles.testimonialsSlash} />
                    <span>Testimonials</span>
                    <span className={styles.testimonialsSlash} />
                  </p>
                </div>
                <h2 className={styles.testimonialsTitle}>Trusted by guests booking through Meomul</h2>
                <p className={styles.testimonialsDescription}>
                  Real verified stays from our live booking flow, with review quality reflected directly in hotel ranking.
                </p>
              </div>

              <div ref={testimonialsRailRef} className={styles.testimonialsRail} role="list" onScroll={handleTestimonialsScroll}>
                {testimonialReviews.map((entry, index) => {
                  const review = entry.review;
                  const isActive = index === activeTestimonialCard;
                  const isAccentCard = !isActive && (index + 1) % 4 === 0;
                  const filledStars = Math.max(0, Math.min(5, Math.round(review.overallRating || 0)));
                  const reviewerImageUrl = resolveMediaUrl(review.reviewerImage);
                  const reviewerName = review.reviewerNick?.trim() || "Verified guest";
                  const featuredHotelTitle = entry.hotelTitle || "Meomul stay";

                  return (
                    <article
                      key={`testimonial-${review._id}-${entry.hotelId}`}
                      className={`${styles.testimonialCard} ${isActive ? styles.testimonialCardActive : ""} ${isAccentCard ? styles.testimonialCardAccent : ""}`}
                      role="listitem"
                      data-testimonial-index={index}
                      onMouseEnter={() => setActiveTestimonialCard(index)}
                      onClick={() => setActiveTestimonialCard(index)}
                      onFocus={() => setActiveTestimonialCard(index)}
                    >
                      <header className={styles.testimonialCardHeader}>
                        <div className={styles.testimonialAvatar}>
                          {reviewerImageUrl ? (
                            <Image src={reviewerImageUrl} alt={reviewerName} fill sizes="56px" className={styles.testimonialAvatarImage} />
                          ) : (
                            <span className={styles.testimonialAvatarFallback}>{toReviewerInitial(review, index)}</span>
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

                      <div className={styles.testimonialStars} aria-label={`Rated ${filledStars} out of 5`}>
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <span key={`review-star-${review._id}-${starIndex}`} className={starIndex < filledStars ? styles.testimonialStarFilled : styles.testimonialStarEmpty}>
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
