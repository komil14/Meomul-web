import { useQuery } from "@apollo/client/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GET_RECOMMENDED_HOTELS_QUERY,
  GET_SIMILAR_HOTELS_QUERY,
  GET_TRENDING_BY_LOCATION_QUERY,
} from "@/graphql/hotel.gql";
import { CARD_LIST_LIMIT, uniqueHotels } from "@/lib/hotels/detail-page-helpers";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetRecommendedHotelsQueryData,
  GetRecommendedHotelsQueryVars,
  GetSimilarHotelsQueryData,
  GetSimilarHotelsQueryVars,
  GetTrendingByLocationQueryData,
  GetTrendingByLocationQueryVars,
  HotelLocation,
} from "@/types/hotel";

interface UseHotelDetailDiscoveryInput {
  hotelId: string;
  trendingLocation?: HotelLocation;
  canUseRecommendedQuery: boolean;
}

export const useHotelDetailDiscovery = ({
  hotelId,
  trendingLocation,
  canUseRecommendedQuery,
}: UseHotelDetailDiscoveryInput) => {
  const discoverySectionRef = useRef<HTMLElement | null>(null);
  const locationSectionRef = useRef<HTMLElement | null>(null);

  const [shouldLoadDiscovery, setShouldLoadDiscovery] = useState(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);

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

  return {
    discoverySectionRef,
    locationSectionRef,
    shouldLoadMap,
    similarHotels,
    similarLoading,
    similarErrorMessage: similarError ? getErrorMessage(similarError) : null,
    trendingHotels,
    trendingLoading,
    trendingErrorMessage: trendingError ? getErrorMessage(trendingError) : null,
    recommendedHotels,
    recommendedLoading,
    recommendedErrorMessage: recommendedError ? getErrorMessage(recommendedError) : null,
  };
};
