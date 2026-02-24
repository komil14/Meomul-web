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
  CANCEL_PRICE_LOCK_MUTATION,
  GET_MY_PRICE_LOCK_QUERY,
  GET_HOTEL_QUERY,
  GET_HOTEL_REVIEWS_QUERY,
  GET_PRICE_CALENDAR_QUERY,
  GET_RECOMMENDED_HOTELS_QUERY,
  GET_ROOMS_BY_HOTEL_QUERY,
  HAS_LIKED_QUERY,
  LOCK_PRICE_MUTATION,
  MARK_HELPFUL_MUTATION,
  GET_SIMILAR_HOTELS_QUERY,
  TOGGLE_LIKE_MUTATION,
  GET_TRENDING_BY_LOCATION_QUERY,
} from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  CancelPriceLockMutationData,
  CancelPriceLockMutationVars,
  GetHotelQueryData,
  GetHotelQueryVars,
  GetHotelReviewsQueryData,
  GetHotelReviewsQueryVars,
  GetMyPriceLockQueryData,
  GetMyPriceLockQueryVars,
  GetPriceCalendarQueryData,
  GetPriceCalendarQueryVars,
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
  DayPriceDto,
  HotelDetailItem,
  HotelListItem,
  HotelLocation,
  LockPriceMutationData,
  LockPriceMutationVars,
  MarkHelpfulMutationData,
  MarkHelpfulMutationVars,
  RoomListItem,
  ToggleLikeMutationData,
  ToggleLikeMutationVars,
} from "@/types/hotel";

const ROOM_PAGE_SIZE = 12;
const REVIEW_PAGE_SIZE = 5;
const CARD_LIST_LIMIT = 6;
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

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

const formatDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (dateInput: string, days: number): string => {
  const base = new Date(`${dateInput}T00:00:00`);
  base.setDate(base.getDate() + days);
  return formatDateInput(base);
};

const addMonthsToMonthKey = (monthKey: string, months: number): string => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  const date = new Date(Date.UTC(year, month - 1 + months, 1, 0, 0, 0, 0));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
};

const buildMonthGrid = (monthKey: string): Array<string | null> => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return [];
  }

  const firstWeekDay = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0, 0, 0, 0, 0)).getUTCDate();
  const grid: Array<string | null> = [];

  for (let i = 0; i < firstWeekDay; i += 1) {
    grid.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }

  return grid;
};

const formatMonthLabel = (monthKey: string): string => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = monthNames[month - 1] ?? String(month);
  return `${monthLabel} ${year}`;
};

const buildStayDates = (checkInDate: string, checkOutDate: string): string[] => {
  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
    return [];
  }

  const dates: string[] = [];
  let cursor = checkInDate;
  while (cursor < checkOutDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const isCalendarDayBookable = (day: DayPriceDto | undefined): boolean => {
  if (!day) {
    return false;
  }
  if (day.localEvent === "Closed") {
    return false;
  }
  return (day.availableRooms ?? 0) > 0;
};

const isStayRangeAvailable = (checkInDate: string, checkOutDate: string, availabilityByDate: Map<string, DayPriceDto>): boolean => {
  const stayDates = buildStayDates(checkInDate, checkOutDate);
  if (stayDates.length === 0) {
    return false;
  }

  return stayDates.every((date) => isCalendarDayBookable(availabilityByDate.get(date)));
};

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

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

const getMinutesUntil = (value: string): number => {
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 60000));
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

const buildBookingHref = (
  hotelId: string,
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  adults: number,
): { pathname: string; query: Record<string, string> } => {
  const query: Record<string, string> = {
    hotelId,
    roomId,
  };

  if (checkInDate) {
    query.checkInDate = checkInDate;
  }
  if (checkOutDate) {
    query.checkOutDate = checkOutDate;
  }
  query.adultCount = String(adults);

  return {
    pathname: "/bookings/new",
    query,
  };
};

interface HotelDetailPageProps {
  initialHotel: HotelDetailItem | null;
  initialRooms: RoomListItem[];
}

export default function HotelDetailPage({ initialHotel, initialRooms }: HotelDetailPageProps) {
  const router = useRouter();
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);
  const discoverySectionRef = useRef<HTMLElement | null>(null);
  const locationSectionRef = useRef<HTMLElement | null>(null);

  const [reviewPage, setReviewPage] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adultCount, setAdultCount] = useState(2);
  const [shouldLoadDiscovery, setShouldLoadDiscovery] = useState(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [generalActionError, setGeneralActionError] = useState<string | null>(null);
  const [markingHelpfulReviewId, setMarkingHelpfulReviewId] = useState<string | null>(null);
  const [helpfulCountOverrides, setHelpfulCountOverrides] = useState<Record<string, number>>({});
  const [hotelLikeState, setHotelLikeState] = useState<{ liked: boolean; count: number } | null>(null);
  const todayDate = useMemo(() => formatDateInput(new Date()), []);
  const todayMonth = useMemo(() => todayDate.slice(0, 7), [todayDate]);
  const [calendarMonth, setCalendarMonth] = useState(todayMonth);
  const [calendarByMonth, setCalendarByMonth] = useState<Record<string, DayPriceDto[]>>({});

  const hotelId = useMemo(() => {
    if (typeof router.query.hotelId === "string") {
      return router.query.hotelId;
    }

    return "";
  }, [router.query.hotelId]);
  const memberType = member?.memberType;
  const canUseRecommendedQuery = canUsePersonalizedRecommendations(memberType);
  const canUseLikeActions = canUseMemberActions(memberType);
  const canUsePriceActions = canUseMemberActions(memberType);

  useEffect(() => {
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

  const hotel = hotelData?.getHotel ?? initialHotel;
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
    data: priceCalendarData,
    loading: priceCalendarLoading,
    error: priceCalendarError,
  } = useQuery<GetPriceCalendarQueryData, GetPriceCalendarQueryVars>(GET_PRICE_CALENDAR_QUERY, {
    skip: !selectedRoomId,
    variables: {
      input: {
        roomId: selectedRoomId,
        month: calendarMonth,
      },
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: myPriceLockData,
    loading: myPriceLockLoading,
    error: myPriceLockError,
    refetch: refetchMyPriceLock,
  } = useQuery<GetMyPriceLockQueryData, GetMyPriceLockQueryVars>(GET_MY_PRICE_LOCK_QUERY, {
    skip: !selectedRoomId || !canUsePriceActions,
    variables: {
      roomId: selectedRoomId,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const [lockPriceMutation, { loading: lockingPrice }] = useMutation<LockPriceMutationData, LockPriceMutationVars>(LOCK_PRICE_MUTATION);
  const [cancelPriceLockMutation, { loading: cancellingPriceLock }] = useMutation<
    CancelPriceLockMutationData,
    CancelPriceLockMutationVars
  >(CANCEL_PRICE_LOCK_MUTATION);

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

  const rooms = useMemo(() => roomsData?.getRoomsByHotel?.list ?? initialRooms, [initialRooms, roomsData?.getRoomsByHotel?.list]);
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
    if (rooms.length === 0) {
      return;
    }

    const firstRoomId = rooms[0]?._id;
    if (firstRoomId && (!selectedRoomId || !rooms.some((room) => room._id === selectedRoomId))) {
      setSelectedRoomId(firstRoomId);
    }
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    setHotelLikeState(null);
    setHelpfulCountOverrides({});
    setReviewActionError(null);
    setGeneralActionError(null);
  }, [hotelId]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }

    setCalendarByMonth({});
    setCalendarMonth(todayMonth);
    setCheckInDate("");
    setCheckOutDate("");
  }, [selectedRoomId, todayMonth]);

  useEffect(() => {
    const calendar = priceCalendarData?.getPriceCalendar.calendar;
    if (!calendar || calendar.length === 0) {
      return;
    }
    if (calendar[0]?.date.slice(0, 7) !== calendarMonth) {
      return;
    }

    setCalendarByMonth((previous) => ({
      ...previous,
      [calendarMonth]: calendar,
    }));
  }, [calendarMonth, priceCalendarData]);

  const selectedRoom = useMemo(() => rooms.find((room) => room._id === selectedRoomId) ?? null, [rooms, selectedRoomId]);
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
  const availabilityByDate = useMemo(() => {
    const map = new Map<string, DayPriceDto>();
    Object.values(calendarByMonth)
      .flat()
      .forEach((day) => {
        map.set(day.date, day);
      });
    return map;
  }, [calendarByMonth]);
  const monthGrid = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);
  const visibleMonthCalendar = useMemo(() => calendarByMonth[calendarMonth] ?? [], [calendarByMonth, calendarMonth]);
  const hasCalendarAvailability = availabilityByDate.size > 0;
  const maxCalendarMonth = useMemo(() => addMonthsToMonthKey(todayMonth, 11), [todayMonth]);
  const canGoPrevCalendarMonth = calendarMonth > todayMonth;
  const canGoNextCalendarMonth = calendarMonth < maxCalendarMonth;
  const calendarMonthLabel = useMemo(() => formatMonthLabel(calendarMonth), [calendarMonth]);

  const bookingValidationMessage = useMemo(() => {
    if (!selectedRoom) {
      return "Select a room first.";
    }
    if (selectedRoom.availableRooms <= 0) {
      return "Selected room is sold out.";
    }
    if (!checkInDate || !checkOutDate) {
      return "Choose check-in and check-out dates.";
    }
    if (checkOutDate <= checkInDate) {
      return "Check-out must be after check-in.";
    }
    if (hasCalendarAvailability && !isStayRangeAvailable(checkInDate, checkOutDate, availabilityByDate)) {
      return "One or more selected nights are unavailable.";
    }
    if (adultCount < 1) {
      return "Adult count must be at least 1.";
    }
    return null;
  }, [adultCount, availabilityByDate, checkInDate, checkOutDate, hasCalendarAvailability, selectedRoom]);
  const canContinueBooking = bookingValidationMessage === null && Boolean(selectedRoom);
  const hotelLikeCount = hotelLikeState?.count ?? hotel?.hotelLikes ?? 0;
  const hotelLiked = hotelLikeState?.liked ?? Boolean(hotelLikedData?.hasLiked);
  const activePriceLock = myPriceLockData?.getMyPriceLock ?? null;
  const lockMinutesLeft = activePriceLock ? getMinutesUntil(activePriceLock.expiresAt) : 0;
  const visibleCalendarByDate = useMemo(() => {
    const map = new Map<string, DayPriceDto>();
    visibleMonthCalendar.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [visibleMonthCalendar]);

  useEffect(() => {
    if (!checkInDate) {
      return;
    }

    const checkInDay = availabilityByDate.get(checkInDate);
    if (hasCalendarAvailability && (!checkInDay || !isCalendarDayBookable(checkInDay))) {
      setCheckInDate("");
      setCheckOutDate("");
      return;
    }

    if (checkOutDate && hasCalendarAvailability && !isStayRangeAvailable(checkInDate, checkOutDate, availabilityByDate)) {
      setCheckOutDate("");
    }
  }, [availabilityByDate, checkInDate, checkOutDate, hasCalendarAvailability]);

  const handleSelectCalendarDate = (date: string): void => {
    if (date < todayDate) {
      return;
    }

    const day = availabilityByDate.get(date);
    const isBookableDay = isCalendarDayBookable(day);

    if (!checkInDate) {
      if (!isBookableDay) {
        return;
      }
      setCheckInDate(date);
      setCheckOutDate("");
      return;
    }

    if (checkOutDate) {
      if (!isBookableDay) {
        return;
      }
      setCheckInDate(date);
      setCheckOutDate("");
      return;
    }

    if (date <= checkInDate) {
      if (!isBookableDay) {
        return;
      }
      setCheckInDate(date);
      setCheckOutDate("");
      return;
    }

    if (!isStayRangeAvailable(checkInDate, date, availabilityByDate)) {
      return;
    }

    setCheckOutDate(date);
  };

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

  const handleLockPrice = async (): Promise<void> => {
    if (!canUsePriceActions || !selectedRoom) {
      return;
    }

    setGeneralActionError(null);
    try {
      await lockPriceMutation({
        variables: {
          input: {
            roomId: selectedRoom._id,
            currentPrice: selectedRoom.basePrice,
          },
        },
      });
      await refetchMyPriceLock();
    } catch (error) {
      setGeneralActionError(getErrorMessage(error));
    }
  };

  const handleCancelPriceLock = async (): Promise<void> => {
    if (!canUsePriceActions || !activePriceLock) {
      return;
    }

    setGeneralActionError(null);
    try {
      await cancelPriceLockMutation({
        variables: { priceLockId: activePriceLock._id },
      });
      await refetchMyPriceLock();
    } catch (error) {
      setGeneralActionError(getErrorMessage(error));
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
      {myPriceLockError ? <ErrorNotice message={getErrorMessage(myPriceLockError)} /> : null}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
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

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Book this stay</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">₩ {fromPrice > 0 ? fromPrice.toLocaleString() : "-"}</p>
            <p className="text-xs text-slate-500">starting price per room/night</p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Room</span>
                <select
                  value={selectedRoomId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                  disabled={rooms.length === 0}
                >
                  {rooms.length === 0 ? <option value="">No rooms available</option> : null}
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.roomName} · ₩ {room.basePrice.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-in</span>
                  <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                    {checkInDate || "Select date"}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-out</span>
                  <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                    {checkOutDate || "Select date"}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((previous) => addMonthsToMonthKey(previous, -1))}
                    disabled={!canGoPrevCalendarMonth}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition enabled:hover:border-slate-400 enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{calendarMonthLabel}</p>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((previous) => addMonthsToMonthKey(previous, 1))}
                    disabled={!canGoNextCalendarMonth}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition enabled:hover:border-slate-400 enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {monthGrid.map((date, index) => {
                    if (!date) {
                      return <span key={`empty-${calendarMonth}-${String(index)}`} className="h-8 rounded-md bg-transparent" />;
                    }

                    const day = visibleCalendarByDate.get(date) ?? availabilityByDate.get(date);
                    const isBookableDay = isCalendarDayBookable(day);
                    const isPastDate = date < todayDate;
                    const isSelectedCheckIn = checkInDate === date;
                    const isSelectedCheckOut = checkOutDate === date;
                    const isInSelectedRange = Boolean(checkInDate && checkOutDate && date > checkInDate && date < checkOutDate);

                    let isSelectable = false;
                    if (!isPastDate) {
                      if (!checkInDate || checkOutDate || date <= checkInDate) {
                        isSelectable = isBookableDay;
                      } else {
                        isSelectable = isStayRangeAvailable(checkInDate, date, availabilityByDate);
                      }
                    }

                    const baseClassName =
                      "h-8 rounded-md border text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";
                    let stateClassName = "border-slate-200 bg-white text-slate-700 enabled:hover:border-slate-400 enabled:hover:bg-slate-100";
                    if (isSelectedCheckIn || isSelectedCheckOut) {
                      stateClassName = "border-slate-900 bg-slate-900 text-white";
                    } else if (isInSelectedRange) {
                      stateClassName = "border-slate-300 bg-slate-200 text-slate-900";
                    } else if (!isSelectable) {
                      stateClassName = "border-slate-200 bg-slate-100 text-slate-300";
                    }

                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={!isSelectable}
                        onClick={() => handleSelectCalendarDate(date)}
                        className={`${baseClassName} ${stateClassName}`}
                        aria-label={`Select ${date}`}
                      >
                        {Number(date.slice(8, 10))}
                      </button>
                    );
                  })}
                </div>

                {priceCalendarLoading && visibleMonthCalendar.length === 0 ? (
                  <p className="mt-2 text-[11px] text-slate-500">Loading availability...</p>
                ) : null}
                {priceCalendarError && visibleMonthCalendar.length === 0 ? (
                  <p className="mt-2 text-[11px] text-amber-700">{getErrorMessage(priceCalendarError)}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-slate-500">Unavailable nights are disabled.</p>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Adults</span>
                <input
                  value={String(adultCount)}
                  onChange={(event) => {
                    const parsed = Number(event.target.value.replace(/\D/g, ""));
                    setAdultCount(Number.isInteger(parsed) && parsed > 0 ? parsed : 1);
                  }}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                />
              </label>
            </div>

            {selectedRoom ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Selected: <span className="font-semibold text-slate-900">{selectedRoom.roomName}</span>
                <br />
                Status: {selectedRoom.roomStatus} · Left: {selectedRoom.availableRooms}
              </div>
            ) : null}

            {bookingValidationMessage ? (
              <p className="mt-3 text-xs font-medium text-amber-700">{bookingValidationMessage}</p>
            ) : null}

            {canContinueBooking && selectedRoom ? (
              <Link
                href={buildBookingHref(hotelId, selectedRoom._id, checkInDate, checkOutDate, adultCount)}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Continue to booking
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                Complete booking details
              </button>
            )}

            <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Price insights ({calendarMonth})</p>

              {priceCalendarError ? <p className="text-xs text-amber-700">{getErrorMessage(priceCalendarError)}</p> : null}

              {!member ? (
                <p className="text-xs text-slate-500">Login to view monthly price trend.</p>
              ) : priceCalendarLoading ? (
                <p className="text-xs text-slate-500">Loading monthly price trend...</p>
              ) : priceCalendarData?.getPriceCalendar ? (
                <div className="grid gap-2 text-xs text-slate-700">
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    Average: <span className="font-semibold">₩ {priceCalendarData.getPriceCalendar.averagePrice.toLocaleString()}</span>
                  </p>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    Cheapest:{" "}
                    <span className="font-semibold">
                      {priceCalendarData.getPriceCalendar.cheapestDate.date} · ₩{" "}
                      {priceCalendarData.getPriceCalendar.cheapestDate.price.toLocaleString()}
                    </span>
                  </p>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    Peak:{" "}
                    <span className="font-semibold">
                      {priceCalendarData.getPriceCalendar.mostExpensiveDate.date} · ₩{" "}
                      {priceCalendarData.getPriceCalendar.mostExpensiveDate.price.toLocaleString()}
                    </span>
                  </p>
                  <p className="text-slate-600">Potential savings this month: ₩ {priceCalendarData.getPriceCalendar.savings.toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select a room to see monthly pricing.</p>
              )}

              {canUsePriceActions ? (
                <>
                  {myPriceLockLoading ? <p className="text-xs text-slate-500">Checking your active price lock...</p> : null}
                  {activePriceLock ? (
                    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      <p>
                        Locked price: <span className="font-semibold">₩ {activePriceLock.lockedPrice.toLocaleString()}</span>
                      </p>
                      <p>
                        Expires in <span className="font-semibold">{lockMinutesLeft} min</span> ({formatDateTime(activePriceLock.expiresAt)})
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleCancelPriceLock()}
                        disabled={cancellingPriceLock}
                        className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingPriceLock ? "Cancelling..." : "Cancel lock"}
                      </button>
                    </div>
                  ) : selectedRoom ? (
                    <button
                      type="button"
                      onClick={() => void handleLockPrice()}
                      disabled={lockingPrice}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {lockingPrice ? "Locking..." : `Lock ₩ ${selectedRoom.basePrice.toLocaleString()} for 30 min`}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-slate-500">Login with USER/AGENT/ADMIN to use price lock.</p>
              )}
            </div>
          </section>
        </aside>
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
