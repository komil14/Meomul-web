import { useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GET_HOTEL_QUERY, GET_HOTEL_REVIEWS_QUERY, GET_ROOMS_BY_HOTEL_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import {
  amenityLabels,
  asPercent,
  canUseMemberActions,
  canUsePersonalizedRecommendations,
  getMapEmbedLink,
  getMapLink,
  getPolicyText,
  REVIEW_PAGE_SIZE,
  ROOM_PAGE_SIZE,
  shortenText,
} from "@/lib/hotels/detail-page-helpers";
import { useHotelDetailActions } from "@/lib/hooks/use-hotel-detail-actions";
import { useHotelDetailDiscovery } from "@/lib/hooks/use-hotel-detail-discovery";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelQueryData,
  GetHotelQueryVars,
  GetHotelReviewsQueryData,
  GetHotelReviewsQueryVars,
  GetRoomsByHotelQueryData,
  GetRoomsByHotelQueryVars,
  HotelDetailItem,
  RoomListItem,
} from "@/types/hotel";

interface UseHotelDetailPageDataInput {
  initialHotel: HotelDetailItem | null;
  initialRooms: RoomListItem[];
}

export const useHotelDetailPageData = ({ initialHotel, initialRooms }: UseHotelDetailPageDataInput) => {
  const router = useRouter();

  const [isHydrated, setIsHydrated] = useState(false);
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);
  const [reviewPage, setReviewPage] = useState(1);

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

  const hotelQueryVariables = useMemo<GetHotelQueryVars>(() => ({ hotelId }), [hotelId]);

  const roomsQueryVariables = useMemo<GetRoomsByHotelQueryVars>(
    () => ({
      hotelId,
      input: {
        page: 1,
        limit: ROOM_PAGE_SIZE,
        sort: "createdAt",
        direction: -1,
      },
    }),
    [hotelId],
  );

  const reviewsQueryVariables = useMemo<GetHotelReviewsQueryVars>(
    () => ({
      hotelId,
      input: {
        page: reviewPage,
        limit: REVIEW_PAGE_SIZE,
        sort: "createdAt",
        direction: -1,
      },
    }),
    [hotelId, reviewPage],
  );

  const {
    data: hotelData,
    loading: hotelLoading,
    error: hotelError,
  } = useQuery<GetHotelQueryData, GetHotelQueryVars>(GET_HOTEL_QUERY, {
    skip: !hotelId,
    variables: hotelQueryVariables,
    fetchPolicy: initialHotel ? "cache-first" : "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const queriedHotel = hotelData?.getHotel ?? null;
  const hotel = isHydrated ? queriedHotel ?? initialHotel : initialHotel;
  const trendingLocation = hotel?.hotelLocation;

  const {
    data: roomsData,
    loading: roomsLoading,
    error: roomsError,
  } = useQuery<GetRoomsByHotelQueryData, GetRoomsByHotelQueryVars>(GET_ROOMS_BY_HOTEL_QUERY, {
    skip: !hotelId,
    variables: roomsQueryVariables,
    fetchPolicy: initialRooms.length > 0 ? "cache-first" : "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: reviewsData,
    loading: reviewsLoading,
    error: reviewsError,
  } = useQuery<GetHotelReviewsQueryData, GetHotelReviewsQueryVars>(GET_HOTEL_REVIEWS_QUERY, {
    skip: !hotelId,
    variables: reviewsQueryVariables,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const {
    hotelLikeState,
    hotelLikedFromServer,
    hotelLikedErrorMessage,
    generalActionError,
    reviewActionError,
    markingHelpfulReviewId,
    helpfulCountOverrides,
    togglingHotelLike,
    handleToggleHotelLike,
    handleMarkHelpful,
  } = useHotelDetailActions({
    hotelId,
    canUseLikeActions,
  });

  const {
    discoverySectionRef,
    locationSectionRef,
    shouldLoadMap,
    similarHotels,
    similarLoading,
    similarErrorMessage,
    trendingHotels,
    trendingLoading,
    trendingErrorMessage,
    recommendedHotels,
    recommendedLoading,
    recommendedErrorMessage,
  } = useHotelDetailDiscovery({
    hotelId,
    trendingLocation,
    canUseRecommendedQuery,
  });

  const queriedRooms = roomsData?.getRoomsByHotel?.list;
  const rooms = useMemo(() => (isHydrated ? queriedRooms ?? initialRooms : initialRooms), [initialRooms, isHydrated, queriedRooms]);

  const reviews = reviewsData?.getHotelReviews.list ?? [];
  const reviewTotal = reviewsData?.getHotelReviews.metaCounter.total ?? 0;
  const reviewTotalPages = Math.max(1, Math.ceil(reviewTotal / REVIEW_PAGE_SIZE));
  const canGoPrev = reviewPage > 1;
  const canGoNext = reviewPage < reviewTotalPages;

  const handlePrevReviewPage = useCallback(() => {
    setReviewPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextReviewPage = useCallback(() => {
    setReviewPage((prev) => Math.min(reviewTotalPages, prev + 1));
  }, [reviewTotalPages]);

  const fromPrice = useMemo(() => {
    const prices = rooms.map((room) => room.basePrice).filter((price): price is number => typeof price === "number");
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [rooms]);

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
  const hotelLiked = hotelLikeState?.liked ?? hotelLikedFromServer;

  return {
    hotelId,
    hotel,
    hotelLoading,
    hotelErrorMessage: hotelError ? getErrorMessage(hotelError) : null,
    hotelLikedErrorMessage,
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
    canGoPrev,
    canGoNext,
    handlePrevReviewPage,
    handleNextReviewPage,
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
    similarErrorMessage,
    trendingHotels,
    trendingLoading,
    trendingErrorMessage,
    recommendedHotels,
    recommendedLoading,
    recommendedErrorMessage,
    cancellationPolicyText: hotel ? getPolicyText(hotel.cancellationPolicy) : "Moderate cancellation",
  };
};
