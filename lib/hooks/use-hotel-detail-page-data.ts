import { useMutation, useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GET_HOTEL_QUERY,
  GET_HOTEL_REVIEWS_QUERY,
  GET_RECOMMENDED_HOTELS_QUERY,
  GET_ROOMS_BY_HOTEL_QUERY,
  GET_SIMILAR_HOTELS_QUERY,
  GET_TRENDING_BY_LOCATION_QUERY,
  HAS_LIKED_QUERY,
  MARK_HELPFUL_MUTATION,
  TOGGLE_LIKE_MUTATION,
} from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import {
  amenityLabels,
  asPercent,
  canUseMemberActions,
  canUsePersonalizedRecommendations,
  CARD_LIST_LIMIT,
  getMapEmbedLink,
  getMapLink,
  getPolicyText,
  REVIEW_PAGE_SIZE,
  ROOM_PAGE_SIZE,
  shortenText,
  uniqueHotels,
} from "@/lib/hotels/detail-page-helpers";
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
  GetSimilarHotelsQueryData,
  GetSimilarHotelsQueryVars,
  GetTrendingByLocationQueryData,
  GetTrendingByLocationQueryVars,
  HasLikedQueryData,
  HasLikedQueryVars,
  HotelDetailItem,
  HotelLocation,
  MarkHelpfulMutationData,
  MarkHelpfulMutationVars,
  RoomListItem,
  ToggleLikeMutationData,
  ToggleLikeMutationVars,
} from "@/types/hotel";

interface UseHotelDetailPageDataInput {
  initialHotel: HotelDetailItem | null;
  initialRooms: RoomListItem[];
}

export const useHotelDetailPageData = ({ initialHotel, initialRooms }: UseHotelDetailPageDataInput) => {
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

  const handleToggleHotelLike = useCallback(async (): Promise<void> => {
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
  }, [canUseLikeActions, hotelId, toggleLikeMutation]);

  const handleMarkHelpful = useCallback(
    async (reviewId: string): Promise<void> => {
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
    },
    [canUseLikeActions, markHelpfulMutation],
  );

  return {
    hotelId,
    hotel,
    hotelLoading,
    hotelErrorMessage: hotelError ? getErrorMessage(hotelError) : null,
    hotelLikedErrorMessage: hotelLikedError ? getErrorMessage(hotelLikedError) : null,
    generalActionError,
    reviewActionError,
    rooms,
    roomsLoading,
    roomsErrorMessage: roomsError ? getErrorMessage(roomsError) : null,
    reviews,
    reviewsLoading,
    reviewsErrorMessage: reviewsError ? getErrorMessage(reviewsError) : null,
    reviewPage,
    reviewTotalPages,
    reviewTotal,
    setReviewPage,
    canGoPrev: reviewPage > 1,
    canGoNext: reviewPage < reviewTotalPages,
    markingHelpfulReviewId,
    helpfulCountOverrides,
    canUseLikeActions,
    canUseRecommendedQuery,
    togglingHotelLike,
    handleToggleHotelLike,
    handleMarkHelpful,
    fromPrice,
    activeAmenities,
    shortDescription,
    reviewCountText,
    satisfactionText,
    hotelLikeCount,
    hotelLiked,
    heroImage,
    secondaryImage,
    galleryImages,
    discoverySectionRef,
    locationSectionRef,
    shouldLoadMap,
    mapEmbedUrl: hotel ? getMapEmbedLink(hotel) : "",
    mapUrl: hotel ? getMapLink(hotel) : "",
    similarHotels,
    similarLoading,
    similarErrorMessage: similarError ? getErrorMessage(similarError) : null,
    trendingHotels,
    trendingLoading,
    trendingErrorMessage: trendingError ? getErrorMessage(trendingError) : null,
    recommendedHotels,
    recommendedLoading,
    recommendedErrorMessage: recommendedError ? getErrorMessage(recommendedError) : null,
    cancellationPolicyText: hotel ? getPolicyText(hotel.cancellationPolicy) : "Moderate cancellation",
  };
};
