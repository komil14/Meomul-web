import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { HotelCard } from "@/components/hotels/hotel-card";
import { RoomCard } from "@/components/hotels/room-card";
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
} from "@/types/hotel";

const ROOM_PAGE_SIZE = 12;
const REVIEW_PAGE_SIZE = 5;
const CARD_LIST_LIMIT = 6;

const SECTION_LINKS: Array<{ id: string; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "gallery", label: "Gallery" },
  { id: "features", label: "Features" },
  { id: "rooms", label: "Rooms" },
  { id: "reviews", label: "Reviews" },
  { id: "location", label: "Location" },
];

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

export default function HotelDetailPage() {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);

  const [reviewPage, setReviewPage] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adultCount, setAdultCount] = useState(2);

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
    fetchPolicy: "cache-and-network",
  });

  const hotel = hotelData?.getHotel;
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
    fetchPolicy: "cache-and-network",
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
  });

  const {
    data: similarData,
    loading: similarLoading,
    error: similarError,
  } = useQuery<GetSimilarHotelsQueryData, GetSimilarHotelsQueryVars>(GET_SIMILAR_HOTELS_QUERY, {
    skip: !hotelId,
    variables: {
      hotelId,
      limit: CARD_LIST_LIMIT,
    },
    fetchPolicy: "cache-and-network",
  });

  const {
    data: trendingData,
    loading: trendingLoading,
    error: trendingError,
  } = useQuery<GetTrendingByLocationQueryData, GetTrendingByLocationQueryVars>(GET_TRENDING_BY_LOCATION_QUERY, {
    skip: !trendingLocation,
    variables: {
      location: (trendingLocation ?? "SEOUL") as HotelLocation,
      limit: CARD_LIST_LIMIT,
    },
    fetchPolicy: "cache-and-network",
  });

  const canLoadRecommended = canUsePersonalizedRecommendations(member?.memberType);
  const {
    data: recommendedData,
    loading: recommendedLoading,
    error: recommendedError,
  } = useQuery<GetRecommendedHotelsQueryData, GetRecommendedHotelsQueryVars>(GET_RECOMMENDED_HOTELS_QUERY, {
    skip: !canLoadRecommended,
    variables: {
      limit: CARD_LIST_LIMIT,
    },
    fetchPolicy: "cache-and-network",
  });

  const rooms = useMemo(() => roomsData?.getRoomsByHotel.list ?? [], [roomsData?.getRoomsByHotel.list]);
  const reviews = reviewsData?.getHotelReviews.list ?? [];
  const reviewTotal = reviewsData?.getHotelReviews.metaCounter.total ?? 0;
  const reviewTotalPages = Math.max(1, Math.ceil(reviewTotal / REVIEW_PAGE_SIZE));

  useEffect(() => {
    if (rooms.length === 0) {
      return;
    }

    if (!selectedRoomId || !rooms.some((room) => room._id === selectedRoomId)) {
      setSelectedRoomId(rooms[0]._id);
    }
  }, [rooms, selectedRoomId]);

  const selectedRoom = rooms.find((room) => room._id === selectedRoomId) ?? null;
  const fromPrice = rooms.length > 0 ? Math.min(...rooms.map((room) => room.basePrice)) : 0;

  const similarHotels = uniqueHotels(similarData?.getSimilarHotels ?? [], hotelId);
  const trendingHotels = uniqueHotels(trendingData?.getTrendingByLocation ?? [], hotelId);
  const recommendedHotels = uniqueHotels(recommendedData?.getRecommendedHotels ?? [], hotelId);

  const heroImage = hotel?.hotelImages[0] ?? rooms[0]?.roomImages[0] ?? "";
  const secondaryImage = hotel?.hotelImages[1] ?? heroImage;
  const galleryImages = hotel
    ? hotel.hotelImages.length > 2
      ? hotel.hotelImages.slice(2)
      : hotel.hotelImages
    : [];

  const activeAmenities = hotel
    ? Object.entries(hotel.amenities)
        .filter(([, enabled]) => enabled)
        .map(([key]) => amenityLabels[key as keyof HotelDetailItem["amenities"]])
    : [];

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
        <nav className="flex flex-wrap gap-2">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
            >
              {link.label}
            </a>
          ))}
        </nav>
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
            <img src={heroImage} alt={hotel.hotelTitle} className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/65 to-slate-900/80" />
          <div className="relative grid gap-6 p-6 text-slate-100 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-8">
            <div className="space-y-4">
              <p className="inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
                {hotel.hotelLocation} · {hotel.hotelType}
              </p>
              <h1 className="max-w-2xl text-3xl font-semibold leading-tight lg:text-5xl">{hotel.hotelTitle}</h1>
              <p className="max-w-2xl text-sm text-slate-100/90 lg:text-base">{hotel.hotelDesc || "No hotel description provided yet."}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-white/15 px-2.5 py-1">{hotel.starRating} star</span>
                <span className="rounded-full bg-white/15 px-2.5 py-1">Rating {hotel.hotelRating.toFixed(1)}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-1">{hotel.hotelLikes.toLocaleString()} likes</span>
                <span className="rounded-full bg-white/15 px-2.5 py-1">{getPolicyText(hotel.cancellationPolicy)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {hotel.suitableFor.slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm transition duration-500 hover:-translate-y-0.5">
              {secondaryImage ? (
                <img src={secondaryImage} alt={`${hotel.hotelTitle} preview`} className="h-36 w-full rounded-xl object-cover" />
              ) : null}
              <div className="grid gap-2 text-sm">
                <p className="rounded-lg bg-white/10 px-3 py-2">Check-in: {hotel.checkInTime}</p>
                <p className="rounded-lg bg-white/10 px-3 py-2">Check-out: {hotel.checkOutTime}</p>
                <p className="rounded-lg bg-white/10 px-3 py-2">
                  {hotel.petsAllowed ? "Pets allowed" : "No pets"} · {hotel.smokingAllowed ? "Smoking allowed" : "Non-smoking"}
                </p>
              </div>
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
                    <img
                      src={image}
                      alt={`Hotel gallery ${index + 1}`}
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

          <section id="location" className="space-y-4">
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

          <section className="space-y-6">
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
                    onChange={(event) => setCheckInDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Check-out</span>
                  <input
                    type="date"
                    value={checkOutDate}
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

            {selectedRoom ? (
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
                Select a room first
              </button>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
