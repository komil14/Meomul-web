import { useQuery } from "@apollo/client/react";
import type { GetServerSideProps } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { HotelCard } from "@/components/hotels/hotel-card";
import { RoomCard } from "@/components/hotels/room-card";
import { createApolloClient } from "@/lib/apollo/client";
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

const amenityLabels: Record<keyof HotelDetailItem["amenities"], string> = {
  wifi: "Fast Wi-Fi",
  parking: "Parking",
  breakfast: "Breakfast",
  roomService: "Room Service",
  gym: "Gym",
  pool: "Pool",
  workspace: "Workspace",
  familyRoom: "Family Room",
  kidsFriendly: "Kids Friendly",
  wheelchairAccessible: "Wheelchair Accessible",
};

const formatDate = (value: string): string => new Date(value).toLocaleDateString();

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
      .map(([key]) => amenityLabels[key as keyof HotelDetailItem["amenities"]]);
  }, [hotel]);
  const shortDescription = useMemo(
    () => (hotel ? shortenText(hotel.hotelDesc || "No hotel description provided yet.", 190) : ""),
    [hotel],
  );
  const reviewCountText = useMemo(
    () => (reviewTotal > 0 ? reviewTotal.toLocaleString() : reviewsLoading ? "..." : "0"),
    [reviewTotal, reviewsLoading],
  );
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
        <section id="overview" className="relative overflow-hidden rounded-3xl border border-slate-200">
          {heroImage ? (
            <Image src={heroImage} alt={hotel.hotelTitle} fill priority sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/70 to-cyan-900/50" />
          <div className="relative p-6 text-slate-100 sm:p-8 lg:p-12">
            <div className="grid gap-6 lg:min-h-[37rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="flex flex-col justify-between gap-7">
                <div className="space-y-5">
                  <p className="inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                    {hotel.hotelLocation} · {hotel.hotelType}
                  </p>
                  <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{hotel.hotelTitle}</h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-100/90">{shortDescription}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-sm">{hotel.starRating} star</span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-sm">{getPolicyText(hotel.cancellationPolicy)}</span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-sm">{hotel.hotelLikes.toLocaleString()} likes</span>
                    {hotel.suitableFor.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/35 bg-white/10 px-3 py-1 text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <article className="rounded-2xl border border-white/35 bg-white/20 px-4 py-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Guest rating</p>
                    <p className="mt-2 text-4xl font-semibold leading-none">{hotel.hotelRating.toFixed(1)}</p>
                    <p className="mt-2 text-xs text-slate-200">out of 5.0</p>
                  </article>
                  <article className="rounded-2xl border border-white/35 bg-white/20 px-4 py-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Reviews</p>
                    <p className="mt-2 text-4xl font-semibold leading-none">{reviewCountText}</p>
                    <p className="mt-2 text-xs text-slate-200">verified stays</p>
                  </article>
                  <article className="rounded-2xl border border-white/35 bg-white/20 px-4 py-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Satisfaction</p>
                    <p className="mt-2 text-4xl font-semibold leading-none">{asPercent(hotel.hotelRating)}</p>
                    <p className="mt-2 text-xs text-slate-200">average score</p>
                  </article>
                </div>
              </div>

              <aside className="flex flex-col gap-4 rounded-3xl border border-white/35 bg-white/15 p-4 backdrop-blur-sm transition duration-500 hover:-translate-y-0.5 lg:p-5">
                {secondaryImage ? (
                  <Image
                    src={secondaryImage}
                    alt={`${hotel.hotelTitle} preview`}
                    width={1200}
                    height={800}
                    sizes="(min-width: 1024px) 34vw, 100vw"
                    className="h-60 w-full rounded-2xl object-cover lg:h-72"
                  />
                ) : null}
                <div className="grid gap-2 text-sm">
                  <p className="rounded-lg bg-white/15 px-3 py-2">Check-in: {hotel.checkInTime}</p>
                  <p className="rounded-lg bg-white/15 px-3 py-2">Check-out: {hotel.checkOutTime}</p>
                  <p className="rounded-lg bg-white/15 px-3 py-2">
                    {hotel.petsAllowed ? "Pets allowed" : "No pets"} · {hotel.smokingAllowed ? "Smoking allowed" : "Non-smoking"}
                  </p>
                </div>
                <a
                  href="#reviews"
                  className="inline-flex w-full justify-center rounded-xl border border-white/50 bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/30"
                >
                  Jump to guest reviews
                </a>
              </aside>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="space-y-8">
          <section id="gallery" className="space-y-4">
            <header>
              <h2 className="text-2xl font-semibold text-slate-900">Gallery</h2>
              <p className="text-sm text-slate-600">A quick visual tour of this property.</p>
            </header>

            {galleryImages.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {galleryImages.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white ${
                      index % 5 === 0 ? "sm:col-span-2" : ""
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`Hotel gallery ${index + 1}`}
                      width={1200}
                      height={800}
                      sizes="(min-width: 1024px) 24vw, (min-width: 640px) 48vw, 100vw"
                      className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                No gallery images available yet.
              </section>
            )}
          </section>

          <section id="features" className="space-y-4">
            <header>
              <h2 className="text-2xl font-semibold text-slate-900">Features</h2>
              <p className="text-sm text-slate-600">Amenities and policies designed for comfort.</p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">From</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  ₩ {fromPrice > 0 ? fromPrice.toLocaleString() : "-"}
                </p>
                <p className="mt-1 text-xs text-slate-500">per room/night</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cancellation</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{getPolicyText(hotel?.cancellationPolicy ?? "MODERATE")}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Address</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{hotel?.detailedLocation.address ?? "-"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Nearby Subway</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{hotel?.detailedLocation.nearestSubway || "Not specified"}</p>
              </article>
            </div>

            {activeAmenities.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Top amenities</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeAmenities.map((amenity) => (
                    <span key={amenity} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section id="rooms" className="space-y-4">
            <header>
              <h2 className="text-2xl font-semibold text-slate-900">Rooms</h2>
              <p className="text-sm text-slate-600">Available options and pricing for this property.</p>
            </header>

            {roomsError ? <ErrorNotice message={getErrorMessage(roomsError)} /> : null}

            {roomsLoading && rooms.length === 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading rooms...</section>
            ) : null}

            {!roomsLoading && rooms.length === 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                No rooms found for this hotel.
              </section>
            ) : null}

            {rooms.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                  <RoomCard key={room._id} room={room} hotelId={hotelId} />
                ))}
              </div>
            ) : null}
          </section>

          <section id="reviews" className="space-y-4">
            <header>
              <h2 className="text-2xl font-semibold text-slate-900">Reviews</h2>
              <p className="text-sm text-slate-600">Verified and recent guest feedback for this hotel.</p>
            </header>

            {reviewsError ? <ErrorNotice message={getErrorMessage(reviewsError)} /> : null}

            {reviewsLoading && reviews.length === 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading reviews...</section>
            ) : null}

            {!reviewsLoading && reviews.length === 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                No reviews yet for this hotel.
              </section>
            ) : null}

            {reviews.length > 0 ? (
              <>
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <article key={review._id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{review.reviewTitle || "Guest review"}</p>
                          <p className="text-xs text-slate-500">{formatDate(review.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{review.overallRating.toFixed(1)} / 5</p>
                          <p className="text-xs text-slate-500">Verified stay: {review.verifiedStay ? "Yes" : "No"}</p>
                        </div>
                      </div>

                      <p className="text-sm leading-6 text-slate-700">{review.reviewText}</p>

                      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                        <p>Cleanliness: {asPercent(review.cleanlinessRating)}</p>
                        <p>Location: {asPercent(review.locationRating)}</p>
                        <p>Service: {asPercent(review.serviceRating)}</p>
                        <p>Amenities: {asPercent(review.amenitiesRating)}</p>
                        <p>Value: {asPercent(review.valueRating)}</p>
                        <p>Helpful: {review.helpfulCount.toLocaleString()}</p>
                      </div>

                      {review.hotelResponse ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <p className="font-medium text-slate-900">Hotel response</p>
                          <p className="mt-1">{review.hotelResponse.responseText}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(review.hotelResponse.respondedAt)}</p>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>

                <footer className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <p className="text-slate-600">
                    Page {reviewPage} / {reviewTotalPages} · Total reviews: {reviewTotal.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewPage((prev) => Math.max(1, prev - 1))}
                      disabled={reviewPage <= 1}
                      className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewPage((prev) => Math.min(reviewTotalPages, prev + 1))}
                      disabled={reviewPage >= reviewTotalPages}
                      className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </footer>
              </>
            ) : null}
          </section>

          <section id="location" ref={locationSectionRef} className="space-y-4">
            <header>
              <h2 className="text-2xl font-semibold text-slate-900">Location</h2>
              <p className="text-sm text-slate-600">Where you will stay and nearby transit context.</p>
            </header>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-900">Address:</span> {hotel.detailedLocation.address}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">District:</span> {hotel.detailedLocation.district || "-"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Nearest subway:</span> {hotel.detailedLocation.nearestSubway || "-"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Walking distance:</span>{" "}
                  {hotel.detailedLocation.walkingDistance != null ? `${hotel.detailedLocation.walkingDistance} min` : "-"}
                </p>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                {shouldLoadMap ? (
                  <iframe
                    title={`${hotel.hotelTitle} map`}
                    src={getMapEmbedLink(hotel)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-72 w-full"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center bg-slate-100 text-sm text-slate-600">Map loading...</div>
                )}
              </div>
              <a
                href={getMapLink(hotel)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
              >
                Open on map
              </a>
            </div>
          </section>

          <section ref={discoverySectionRef} className="space-y-6">
            <div className="space-y-4">
              <header>
                <h2 className="text-2xl font-semibold text-slate-900">Similar Hotels</h2>
                <p className="text-sm text-slate-600">Properties with matching location, type, and demand profile.</p>
              </header>

              {similarError ? <ErrorNotice message={getErrorMessage(similarError)} /> : null}
              {similarLoading && similarHotels.length === 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading similar hotels...</section>
              ) : null}
              {similarHotels.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {similarHotels.map((entry) => (
                    <HotelCard key={entry._id} hotel={entry} />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <header>
                <h2 className="text-2xl font-semibold text-slate-900">Trending in {hotel.hotelLocation}</h2>
                <p className="text-sm text-slate-600">Most active hotels in this location right now.</p>
              </header>

              {trendingError ? <ErrorNotice message={getErrorMessage(trendingError)} /> : null}
              {trendingLoading && trendingHotels.length === 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading location trends...</section>
              ) : null}
              {trendingHotels.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {trendingHotels.map((entry) => (
                    <HotelCard key={entry._id} hotel={entry} />
                  ))}
                </div>
              ) : null}
            </div>

            {canLoadRecommended ? (
              <div className="space-y-4">
                <header>
                  <h2 className="text-2xl font-semibold text-slate-900">Recommended for You</h2>
                  <p className="text-sm text-slate-600">Personalized suggestions based on your activity.</p>
                </header>

                {recommendedError ? <ErrorNotice message={getErrorMessage(recommendedError)} /> : null}
                {recommendedLoading && recommendedHotels.length === 0 ? (
                  <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                    Loading personalized recommendations...
                  </section>
                ) : null}
                {recommendedHotels.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {recommendedHotels.map((entry) => (
                      <HotelCard key={entry._id} hotel={entry} />
                    ))}
                  </div>
                ) : null}
              </div>
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
