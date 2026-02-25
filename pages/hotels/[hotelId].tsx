import { useMutation, useQuery } from "@apollo/client/react";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createApolloClient } from "@/lib/apollo/client";
import { HotelFeaturesSection } from "@/components/hotels/detail/hotel-features-section";
import { HotelGallerySection } from "@/components/hotels/detail/hotel-gallery-section";
import { HotelListSection } from "@/components/hotels/detail/hotel-list-section";
import { HotelLocationSection } from "@/components/hotels/detail/hotel-location-section";
import { HotelOverviewHero } from "@/components/hotels/detail/hotel-overview-hero";
import { HotelReviewsSection } from "@/components/hotels/detail/hotel-reviews-section";
import { HotelRoomsSection } from "@/components/hotels/detail/hotel-rooms-section";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  GET_HOTEL_QUERY,
  GET_HOTEL_REVIEWS_QUERY,
  GET_RECOMMENDED_HOTELS_QUERY,
  GET_ROOMS_BY_HOTEL_QUERY,
  HAS_LIKED_QUERY,
  MARK_HELPFUL_MUTATION,
  GET_SIMILAR_HOTELS_QUERY,
  TOGGLE_LIKE_MUTATION,
  GET_TRENDING_BY_LOCATION_QUERY,
} from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelQueryData,
  GetHotelQueryVars,
  GetHotelReviewsQueryData,
  GetHotelReviewsQueryVars,
  GetRecommendedHotelsQueryData,
  GetRecommendedHotelsQueryVars,
  GetRoomsByHotelQueryData,
  GetRoomsByHotelQueryVars,
  HasLikedQueryData,
  HasLikedQueryVars,
  GetSimilarHotelsQueryData,
  GetSimilarHotelsQueryVars,
  GetTrendingByLocationQueryData,
  GetTrendingByLocationQueryVars,
  HotelDetailItem,
  HotelListItem,
  HotelLocation,
  MarkHelpfulMutationData,
  MarkHelpfulMutationVars,
  RoomListItem,
  ToggleLikeMutationData,
  ToggleLikeMutationVars,
} from "@/types/hotel";

const ROOM_PAGE_SIZE = 12;
const REVIEW_PAGE_SIZE = 5;
const CARD_LIST_LIMIT = 6;

const amenityLabels: Partial<Record<keyof HotelDetailItem["amenities"], string>> = {
  wifi: "Fast Wi-Fi",
  wifiSpeed: "High-speed Wi-Fi",
  parking: "Parking",
  parkingFee: "Paid Parking",
  breakfast: "Breakfast",
  breakfastIncluded: "Breakfast Included",
  roomService: "Room Service",
  gym: "Gym",
  pool: "Pool",
  workspace: "Workspace",
  familyRoom: "Family Room",
  kidsFriendly: "Kids Friendly",
  wheelchairAccessible: "Wheelchair Accessible",
  elevator: "Elevator",
  accessibleBathroom: "Accessible Bathroom",
  visualAlarms: "Visual Alarms",
  serviceAnimalsAllowed: "Service Animals Allowed",
  airportShuttle: "Airport Shuttle",
  evCharging: "EV Charging",
  playground: "Playground",
  meetingRoom: "Meeting Room",
  privateBath: "Private Bath",
  restaurant: "Restaurant",
  spa: "Spa",
  coupleRoom: "Couple Room",
  romanticView: "Romantic View",
};

const asPercent = (rating: number): string => `${Math.round((rating / 5) * 100)}%`;


const shortenText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const canUsePersonalizedRecommendations = (memberType: string | undefined): boolean => {
  return memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";
};

const canUseMemberActions = (memberType: string | undefined): boolean => {
  return memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";
};

const uniqueHotels = (hotels: HotelListItem[], excludeHotelId: string): HotelListItem[] => {
  const seen = new Set<string>();
  return hotels.filter((hotel) => {
    if (hotel._id === excludeHotelId) {
      return false;
    }
    if (seen.has(hotel._id)) {
      return false;
    }
    seen.add(hotel._id);
    return true;
  });
};

const getPolicyText = (policy: HotelDetailItem["cancellationPolicy"]): string => {
  if (policy === "FLEXIBLE") {
    return "Flexible cancellation";
  }
  if (policy === "STRICT") {
    return "Strict cancellation";
  }
  return "Moderate cancellation";
};

const getMapLink = (hotel: HotelDetailItem): string => {
  const { lat, lng } = hotel.detailedLocation.coordinates;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(hotel.detailedLocation.address)}`;
};

const getMapEmbedLink = (hotel: HotelDetailItem): string => {
  const { lat, lng } = hotel.detailedLocation.coordinates;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(hotel.detailedLocation.address)}&z=15&output=embed`;
};

interface HotelDetailPageProps {
  initialHotel: HotelDetailItem | null;
  initialRooms: RoomListItem[];
}

export default function HotelDetailPage({ initialHotel, initialRooms }: HotelDetailPageProps) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);
  const discoverySectionRef = useRef<HTMLElement | null>(null);
  const locationSectionRef = useRef<HTMLElement | null>(null);

  const [reviewPage, setReviewPage] = useState(1);
  const [shouldLoadDiscovery, setShouldLoadDiscovery] = useState(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [generalActionError, setGeneralActionError] = useState<string | null>(null);
  const [markingHelpfulReviewId, setMarkingHelpfulReviewId] = useState<string | null>(null);
  const [helpfulCountOverrides, setHelpfulCountOverrides] = useState<Record<string, number>>({});
  const [hotelLikeState, setHotelLikeState] = useState<{ liked: boolean; count: number } | null>(null);

  const hotelId = useMemo(() => {
    if (typeof router.query.hotelId === "string") {
      return router.query.hotelId;
    }

    return "";
  }, [router.query.hotelId]);
  const memberType = member?.memberType;
  const canUseRecommendedQuery = canUsePersonalizedRecommendations(memberType);
  const canUseLikeActions = canUseMemberActions(memberType);

  useEffect(() => {
    setIsHydrated(true);
    setMember(getSessionMember());
  }, []);

  const {
    data: hotelData,
    loading: hotelLoading,
    error: hotelError,
  } = useQuery<GetHotelQueryData, GetHotelQueryVars>(GET_HOTEL_QUERY, {
    skip: !hotelId,
    variables: { hotelId },
    fetchPolicy: initialHotel ? "cache-first" : "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const queriedHotel = hotelData?.getHotel ?? null;
  const hotel = isHydrated ? queriedHotel ?? initialHotel : initialHotel;
  const trendingLocation = hotel?.hotelLocation;
  const {
    data: hotelLikedData,
    error: hotelLikedError,
  } = useQuery<HasLikedQueryData, HasLikedQueryVars>(HAS_LIKED_QUERY, {
    skip: !hotelId || !canUseLikeActions,
    variables: {
      likeRefId: hotelId,
      likeGroup: "HOTEL",
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const [toggleLikeMutation, { loading: togglingHotelLike }] = useMutation<ToggleLikeMutationData, ToggleLikeMutationVars>(
    TOGGLE_LIKE_MUTATION,
  );
  const [markHelpfulMutation] = useMutation<MarkHelpfulMutationData, MarkHelpfulMutationVars>(MARK_HELPFUL_MUTATION);

  const {
    data: roomsData,
    loading: roomsLoading,
    error: roomsError,
  } = useQuery<GetRoomsByHotelQueryData, GetRoomsByHotelQueryVars>(GET_ROOMS_BY_HOTEL_QUERY, {
    skip: !hotelId,
    variables: {
      hotelId,
      input: {
        page: 1,
        limit: ROOM_PAGE_SIZE,
        sort: "createdAt",
        direction: -1,
      },
    },
    fetchPolicy: initialRooms.length > 0 ? "cache-first" : "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: reviewsData,
    loading: reviewsLoading,
    error: reviewsError,
  } = useQuery<GetHotelReviewsQueryData, GetHotelReviewsQueryVars>(GET_HOTEL_REVIEWS_QUERY, {
    skip: !hotelId,
    variables: {
      hotelId,
      input: {
        page: reviewPage,
        limit: REVIEW_PAGE_SIZE,
        sort: "createdAt",
        direction: -1,
      },
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: similarData,
    loading: similarLoading,
    error: similarError,
  } = useQuery<GetSimilarHotelsQueryData, GetSimilarHotelsQueryVars>(GET_SIMILAR_HOTELS_QUERY, {
    skip: !hotelId || !shouldLoadDiscovery,
    variables: {
      hotelId,
      limit: CARD_LIST_LIMIT,
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: trendingData,
    loading: trendingLoading,
    error: trendingError,
  } = useQuery<GetTrendingByLocationQueryData, GetTrendingByLocationQueryVars>(GET_TRENDING_BY_LOCATION_QUERY, {
    skip: !trendingLocation || !shouldLoadDiscovery,
    variables: {
      location: (trendingLocation ?? "SEOUL") as HotelLocation,
      limit: CARD_LIST_LIMIT,
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: recommendedData,
    loading: recommendedLoading,
    error: recommendedError,
  } = useQuery<GetRecommendedHotelsQueryData, GetRecommendedHotelsQueryVars>(GET_RECOMMENDED_HOTELS_QUERY, {
    skip: !canUseRecommendedQuery || !shouldLoadDiscovery,
    variables: {
      limit: CARD_LIST_LIMIT,
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const queriedRooms = roomsData?.getRoomsByHotel?.list;
  const rooms = useMemo(() => (isHydrated ? queriedRooms ?? initialRooms : initialRooms), [initialRooms, isHydrated, queriedRooms]);
  const reviews = reviewsData?.getHotelReviews.list ?? [];
  const reviewTotal = reviewsData?.getHotelReviews.metaCounter.total ?? 0;
  const reviewTotalPages = Math.max(1, Math.ceil(reviewTotal / REVIEW_PAGE_SIZE));

  useEffect(() => {
    if (shouldLoadDiscovery) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setShouldLoadDiscovery(true);
    }, 1500);

    return () => window.clearTimeout(fallbackTimer);
  }, [shouldLoadDiscovery]);

  useEffect(() => {
    if (shouldLoadDiscovery) {
      return;
    }

    const target = discoverySectionRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadDiscovery(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoadDiscovery]);

  useEffect(() => {
    if (shouldLoadMap) {
      return;
    }

    const target = locationSectionRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setShouldLoadMap(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoadMap]);

  useEffect(() => {
    setHotelLikeState(null);
    setHelpfulCountOverrides({});
    setReviewActionError(null);
    setGeneralActionError(null);
  }, [hotelId]);

  const fromPrice = useMemo(() => {
    const prices = rooms.map((room) => room.basePrice).filter((price): price is number => typeof price === "number");
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [rooms]);

  const similarHotels = useMemo(
    () => (shouldLoadDiscovery ? uniqueHotels(similarData?.getSimilarHotels ?? [], hotelId) : []),
    [hotelId, shouldLoadDiscovery, similarData?.getSimilarHotels],
  );
  const trendingHotels = useMemo(
    () => (shouldLoadDiscovery ? uniqueHotels(trendingData?.getTrendingByLocation ?? [], hotelId) : []),
    [hotelId, shouldLoadDiscovery, trendingData?.getTrendingByLocation],
  );
  const recommendedHotels = useMemo(
    () => (shouldLoadDiscovery ? uniqueHotels(recommendedData?.getRecommendedHotels ?? [], hotelId) : []),
    [hotelId, recommendedData?.getRecommendedHotels, shouldLoadDiscovery],
  );

  const heroImage = useMemo(() => hotel?.hotelImages[0] ?? rooms[0]?.roomImages[0] ?? "", [hotel?.hotelImages, rooms]);
  const secondaryImage = useMemo(() => hotel?.hotelImages[1] ?? heroImage, [heroImage, hotel?.hotelImages]);
  const galleryImages = useMemo(() => {
    if (!hotel) {
      return [];
    }
    if (hotel.hotelImages.length > 2) {
      return hotel.hotelImages.slice(2);
    }
    return hotel.hotelImages;
  }, [hotel]);

  const activeAmenities = useMemo(() => {
    if (!hotel) {
      return [];
    }
    return Object.entries(hotel.amenities)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => amenityLabels[key as keyof HotelDetailItem["amenities"]] ?? key);
  }, [hotel]);
  const shortDescription = useMemo(
    () => (hotel ? shortenText(hotel.hotelDesc || "No hotel description provided yet.", 190) : ""),
    [hotel],
  );
  const reviewCountText = useMemo(
    () => (reviewTotal > 0 ? reviewTotal.toLocaleString() : reviewsLoading ? "..." : "0"),
    [reviewTotal, reviewsLoading],
  );
  const satisfactionText = useMemo(() => (hotel ? asPercent(hotel.hotelRating) : "0%"), [hotel]);
  const hotelLikeCount = hotelLikeState?.count ?? hotel?.hotelLikes ?? 0;
  const hotelLiked = hotelLikeState?.liked ?? Boolean(hotelLikedData?.hasLiked);

  const handleToggleHotelLike = async (): Promise<void> => {
    if (!hotelId || !canUseLikeActions) {
      return;
    }

    setGeneralActionError(null);
    try {
      const response = await toggleLikeMutation({
        variables: {
          input: {
            likeGroup: "HOTEL",
            likeRefId: hotelId,
          },
        },
      });

      const payload = response.data?.toggleLike;
      if (payload) {
        setHotelLikeState({
          liked: payload.liked,
          count: payload.likeCount,
        });
      }
    } catch (error) {
      setGeneralActionError(getErrorMessage(error));
    }
  };

  const handleMarkHelpful = async (reviewId: string): Promise<void> => {
    if (!canUseLikeActions) {
      return;
    }

    setReviewActionError(null);
    setMarkingHelpfulReviewId(reviewId);

    try {
      const response = await markHelpfulMutation({
        variables: { reviewId },
      });

      const updated = response.data?.markHelpful;
      if (updated) {
        setHelpfulCountOverrides((previous) => ({
          ...previous,
          [updated._id]: updated.helpfulCount,
        }));
      }
    } catch (error) {
      setReviewActionError(getErrorMessage(error));
    } finally {
      setMarkingHelpfulReviewId(null);
    }
  };

  if (!hotelId) {
    return (
      <main className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Loading hotel route...
      </main>
    );
  }

  if (!hotel) {
    return (
      <main className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
            Back to hotels
          </Link>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Hotel is not available right now.
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6 [scroll-behavior:smooth]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
          Back to hotels
        </Link>
      </div>

      {hotelError ? <ErrorNotice message={getErrorMessage(hotelError)} /> : null}
      {hotelLikedError ? <ErrorNotice message={getErrorMessage(hotelLikedError)} /> : null}
      {generalActionError ? <ErrorNotice message={generalActionError} /> : null}

      {hotelLoading && !hotel ? (
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-600">
          Loading hotel...
        </section>
      ) : null}

      {!hotelLoading && !hotel && !hotelError ? (
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-600">
          Hotel not found.
        </section>
      ) : null}

      {hotel ? (
        <HotelOverviewHero
          hotel={hotel}
          heroImage={heroImage}
          secondaryImage={secondaryImage}
          shortDescription={shortDescription}
          reviewCountText={reviewCountText}
          satisfactionText={satisfactionText}
          cancellationPolicyText={getPolicyText(hotel.cancellationPolicy)}
          hotelLikeCount={hotelLikeCount}
          hotelLiked={hotelLiked}
          canToggleLike={canUseLikeActions}
          togglingLike={togglingHotelLike}
          onToggleLike={handleToggleHotelLike}
        />
      ) : null}

      <div className="space-y-8">
          <HotelGallerySection images={galleryImages} />

          <HotelFeaturesSection
            fromPrice={fromPrice}
            cancellationPolicyText={getPolicyText(hotel.cancellationPolicy)}
            address={hotel.detailedLocation.address}
            nearestSubway={hotel.detailedLocation.nearestSubway}
            activeAmenities={activeAmenities}
          />

          <HotelRoomsSection
            rooms={rooms}
            roomsLoading={roomsLoading}
            roomsErrorMessage={roomsError ? getErrorMessage(roomsError) : null}
            hotelId={hotelId}
          />

          <HotelReviewsSection
            reviews={reviews}
            reviewsLoading={reviewsLoading}
            reviewsErrorMessage={reviewsError ? getErrorMessage(reviewsError) : null}
            reviewActionErrorMessage={reviewActionError}
            reviewPage={reviewPage}
            reviewTotalPages={reviewTotalPages}
            reviewTotal={reviewTotal}
            onPrevPage={() => setReviewPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() => setReviewPage((prev) => Math.min(reviewTotalPages, prev + 1))}
            canGoPrev={reviewPage > 1}
            canGoNext={reviewPage < reviewTotalPages}
            canMarkHelpful={canUseLikeActions}
            markingHelpfulReviewId={markingHelpfulReviewId}
            helpfulCountOverrides={helpfulCountOverrides}
            onMarkHelpful={handleMarkHelpful}
          />

          <HotelLocationSection
            hotel={hotel}
            mapSectionRef={locationSectionRef}
            shouldLoadMap={shouldLoadMap}
            mapEmbedUrl={getMapEmbedLink(hotel)}
            mapUrl={getMapLink(hotel)}
          />

          <section ref={discoverySectionRef} className="space-y-6">
            <HotelListSection
              title="Similar Hotels"
              description="Properties with matching location, type, and demand profile."
              hotels={similarHotels}
              loading={similarLoading}
              loadingText="Loading similar hotels..."
              errorMessage={similarError ? getErrorMessage(similarError) : null}
              layout="horizontal"
            />

            <HotelListSection
              title={`Trending in ${hotel.hotelLocation}`}
              description="Most active hotels in this location right now."
              hotels={trendingHotels}
              loading={trendingLoading}
              loadingText="Loading location trends..."
              errorMessage={trendingError ? getErrorMessage(trendingError) : null}
              layout="horizontal"
            />

            {canUseRecommendedQuery ? (
              <HotelListSection
                title="Recommended for You"
                description="Personalized suggestions based on your activity."
                hotels={recommendedHotels}
                loading={recommendedLoading}
                loadingText="Loading personalized recommendations..."
                errorMessage={recommendedError ? getErrorMessage(recommendedError) : null}
                layout="horizontal"
              />
            ) : null}
          </section>
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<HotelDetailPageProps> = async (context) => {
  const rawHotelId = context.params?.hotelId;
  const hotelId = Array.isArray(rawHotelId) ? rawHotelId[0] : rawHotelId;

  if (!hotelId) {
    return { notFound: true };
  }

  const client = createApolloClient();

  try {
    const [hotelResult, roomsResult] = await Promise.all([
      client.query<GetHotelQueryData, GetHotelQueryVars>({
        query: GET_HOTEL_QUERY,
        variables: { hotelId },
        fetchPolicy: "no-cache",
      }),
      client.query<GetRoomsByHotelQueryData, GetRoomsByHotelQueryVars>({
        query: GET_ROOMS_BY_HOTEL_QUERY,
        variables: {
          hotelId,
          input: {
            page: 1,
            limit: ROOM_PAGE_SIZE,
            sort: "createdAt",
            direction: -1,
          },
        },
        fetchPolicy: "no-cache",
      }),
    ]);

    const serverHotel = hotelResult.data?.getHotel ?? null;
    if (!serverHotel) {
      return { notFound: true };
    }

    return {
      props: {
        initialHotel: serverHotel,
        initialRooms: roomsResult.data?.getRoomsByHotel.list ?? [],
      },
    };
  } catch {
    return {
      props: {
        initialHotel: null,
        initialRooms: [],
      },
    };
  }
};
