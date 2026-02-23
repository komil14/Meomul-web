import { useQuery } from "@apollo/client/react";
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
  GET_SIMILAR_HOTELS_QUERY,
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
  GetSimilarHotelsQueryData,
  GetSimilarHotelsQueryVars,
  GetTrendingByLocationQueryData,
  GetTrendingByLocationQueryVars,
  HotelDetailItem,
  HotelListItem,
  HotelLocation,
  RoomListItem,
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

const shortenText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const canUsePersonalizedRecommendations = (memberType: string | undefined): boolean => {
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
  const member = useMemo(() => getSessionMember(), []);
  const discoverySectionRef = useRef<HTMLElement | null>(null);
  const locationSectionRef = useRef<HTMLElement | null>(null);

  const [reviewPage, setReviewPage] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adultCount, setAdultCount] = useState(2);
  const [shouldLoadDiscovery, setShouldLoadDiscovery] = useState(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const todayDate = useMemo(() => formatDateInput(new Date()), []);

  const hotelId = useMemo(() => {
    if (typeof router.query.hotelId === "string") {
      return router.query.hotelId;
    }

    return "";
  }, [router.query.hotelId]);

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

  const canLoadRecommended = canUsePersonalizedRecommendations(member?.memberType);
  const {
    data: recommendedData,
    loading: recommendedLoading,
    error: recommendedError,
  } = useQuery<GetRecommendedHotelsQueryData, GetRecommendedHotelsQueryVars>(GET_RECOMMENDED_HOTELS_QUERY, {
    skip: !canLoadRecommended || !shouldLoadDiscovery,
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
      .filter(([, enabled]) => enabled)
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
  const minCheckOutDate = useMemo(() => (checkInDate ? addDays(checkInDate, 1) : addDays(todayDate, 1)), [checkInDate, todayDate]);
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
    if (adultCount < 1) {
      return "Adult count must be at least 1.";
    }
    return null;
  }, [adultCount, checkInDate, checkOutDate, selectedRoom]);
  const canContinueBooking = bookingValidationMessage === null && Boolean(selectedRoom);

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
            reviewPage={reviewPage}
            reviewTotalPages={reviewTotalPages}
            reviewTotal={reviewTotal}
            onPrevPage={() => setReviewPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() => setReviewPage((prev) => Math.min(reviewTotalPages, prev + 1))}
            canGoPrev={reviewPage > 1}
            canGoNext={reviewPage < reviewTotalPages}
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

            {canLoadRecommended ? (
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
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-in</span>
                  <input
                    type="date"
                    value={checkInDate}
                    min={todayDate}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCheckInDate(nextValue);
                      if (checkOutDate && checkOutDate <= nextValue) {
                        setCheckOutDate("");
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-out</span>
                  <input
                    type="date"
                    value={checkOutDate}
                    min={minCheckOutDate}
                    onChange={(event) => setCheckOutDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                  />
                </label>
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
