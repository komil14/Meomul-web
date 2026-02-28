import { useQuery } from "@apollo/client/react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_HOTELS_QUERY, GET_HOTEL_REVIEWS_QUERY } from "@/graphql/hotel.gql";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { getErrorMessage } from "@/lib/utils/error";
import type { GetHotelReviewsQueryData, GetHotelReviewsQueryVars, GetHotelsQueryData, GetHotelsQueryVars, HotelListItem, PaginationInput, ReviewDto } from "@/types/hotel";
import styles from "@/styles/home-landing-ovastin.module.css";

const HERO_LIMIT = 5;
const HERO_ROTATION_MS = 4000;
const REVIEW_LIMIT = 5;

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

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);

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

  useEffect(() => {
    setIsMounted(true);
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
  const featuredReviews = featuredReviewsData?.getHotelReviews.list ?? [];
  const ratingsSummary = featuredReviewsData?.getHotelReviews.ratingsSummary;
  const reviewCount = ratingsSummary?.totalReviews ?? featuredReviewsData?.getHotelReviews.metaCounter.total ?? 0;
  const reviewRating = ratingsSummary?.overallRating ?? activeSlideData?.rating ?? 0;
  const reviewStars = formatRatingStars(reviewRating);

  return (
    <>
      <Script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" strategy="afterInteractive" />
      <Script id="ovastin-font-loader" strategy="afterInteractive">
        {`if (window.WebFont) { window.WebFont.load({ google: { families: ["Plus Jakarta Sans:300,400,500,600,700"] } }); }`}
      </Script>

      <main className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.navbar}>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoMark} aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className={styles.logoText}>Meomul</span>
            </Link>

            <nav className={styles.navLinks}>
              <Link href="/" className={styles.navLink}>
                Home
              </Link>
              <Link href="/hotels" className={styles.navLink}>
                Hotels
              </Link>
              <Link href="/hotels" className={styles.navLink}>
                Rooms
              </Link>
              <Link href="/bookings/new" className={styles.navLink}>
                Bookings
              </Link>
            </nav>

            <div className={styles.navCta}>
              <Link href="/hotels" className={styles.startButton}>
                Start Booking
              </Link>
              <Link href="/hotels" className={styles.arrowButton} aria-label="Start booking now">
                ↗
              </Link>
            </div>
          </header>

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
        </div>
      </main>
    </>
  );
}
