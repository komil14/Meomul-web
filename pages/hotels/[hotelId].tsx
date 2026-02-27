import type { GetServerSideProps } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createApolloClient } from "@/lib/apollo/client";
import { HotelFeaturesSection } from "@/components/hotels/detail/hotel-features-section";
import { HotelGallerySection } from "@/components/hotels/detail/hotel-gallery-section";
import { HotelLocationSection } from "@/components/hotels/detail/hotel-location-section";
import { HotelOverviewHero } from "@/components/hotels/detail/hotel-overview-hero";
import { HotelReviewsSection } from "@/components/hotels/detail/hotel-reviews-section";
import { HotelRoomsSection } from "@/components/hotels/detail/hotel-rooms-section";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_HOTEL_QUERY, GET_ROOMS_BY_HOTEL_QUERY } from "@/graphql/hotel.gql";
import { useHotelDetailPageData } from "@/lib/hooks/use-hotel-detail-page-data";
import { ROOM_PAGE_SIZE } from "@/lib/hotels/detail-page-helpers";
import type {
  GetHotelQueryData,
  GetHotelQueryVars,
  GetRoomsByHotelQueryData,
  GetRoomsByHotelQueryVars,
  HotelDetailItem,
  RoomListItem,
} from "@/types/hotel";

interface HotelDetailPageProps {
  initialHotel: HotelDetailItem | null;
  initialRooms: RoomListItem[];
}

const HotelListSection = dynamic(
  () => import("@/components/hotels/detail/hotel-list-section").then((mod) => mod.HotelListSection),
  {
    loading: () => (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Loading recommendations...
      </section>
    ),
  },
);

const HOTEL_DETAIL_MOTION_INTENSITY_CLASS = "motion-intensity-bold";

export default function HotelDetailPage({ initialHotel, initialRooms }: HotelDetailPageProps) {
  const {
    hotelId,
    hotel,
    hotelLoading,
    hotelErrorMessage,
    hotelLikedErrorMessage,
    generalActionError,
    reviewActionError,
    rooms,
    roomsLoading,
    roomsErrorMessage,
    reviews,
    reviewsLoading,
    reviewsErrorMessage,
    reviewPage,
    reviewTotalPages,
    reviewTotal,
    ratingsSummary,
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
    shouldLoadDiscovery,
    shouldLoadMap,
    mapEmbedUrl,
    mapUrl,
    similarHotels,
    similarLoading,
    similarErrorMessage,
    trendingHotels,
    trendingLoading,
    trendingErrorMessage,
    recommendedHotels,
    recommendedExplanationMap,
    recommendedMeta,
    recommendedLoading,
    recommendedErrorMessage,
    cancellationPolicyText,
    reviewsSectionRef,
  } = useHotelDetailPageData({ initialHotel, initialRooms });

  if (!hotelId) {
    return (
      <main className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Loading hotel route...
      </main>
    );
  }

  if (hotelLoading && !hotel) {
    return (
      <main className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
            Back to hotels
          </Link>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Loading hotel...
        </section>
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
    <main className={`space-y-6 [scroll-behavior:smooth] ${HOTEL_DETAIL_MOTION_INTENSITY_CLASS}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
          Back to hotels
        </Link>
        <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
          {hotel.hotelLocation} · {hotel.hotelType}
        </p>
      </div>

      {hotelErrorMessage ? <ErrorNotice message={hotelErrorMessage} /> : null}
      {hotelLikedErrorMessage ? <ErrorNotice message={hotelLikedErrorMessage} /> : null}
      {generalActionError ? <ErrorNotice message={generalActionError} /> : null}

      <ScrollReveal delayMs={30}>
        <HotelOverviewHero
          hotel={hotel}
          heroImage={heroImage}
          secondaryImage={secondaryImage}
          shortDescription={shortDescription}
          reviewCountText={reviewCountText}
          satisfactionText={satisfactionText}
          cancellationPolicyText={cancellationPolicyText}
          hotelLikeCount={hotelLikeCount}
          hotelLiked={hotelLiked}
          canToggleLike={canUseLikeActions}
          togglingLike={togglingHotelLike}
          onToggleLike={handleToggleHotelLike}
        />
      </ScrollReveal>

      <div className="space-y-10">
        <ScrollReveal delayMs={40}>
          <HotelGallerySection images={galleryImages} />
        </ScrollReveal>

        <ScrollReveal delayMs={50}>
          <HotelFeaturesSection
            fromPrice={fromPrice}
            cancellationPolicyText={cancellationPolicyText}
            address={hotel.detailedLocation.address}
            nearestSubway={hotel.detailedLocation.nearestSubway}
            activeAmenities={activeAmenities}
            checkInTime={hotel.checkInTime}
            checkOutTime={hotel.checkOutTime}
            flexibleCheckInEnabled={hotel.flexibleCheckIn.enabled}
            flexibleCheckOutEnabled={hotel.flexibleCheckOut.enabled}
            petsAllowed={hotel.petsAllowed}
            smokingAllowed={hotel.smokingAllowed}
          />
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <HotelRoomsSection
            rooms={rooms}
            roomsLoading={roomsLoading}
            roomsErrorMessage={roomsErrorMessage}
            hotelId={hotelId}
          />
        </ScrollReveal>

        <div ref={reviewsSectionRef}>
          <ScrollReveal delayMs={70}>
            <HotelReviewsSection
              reviews={reviews}
              reviewsLoading={reviewsLoading}
              reviewsErrorMessage={reviewsErrorMessage}
              reviewActionErrorMessage={reviewActionError}
              reviewPage={reviewPage}
              reviewTotalPages={reviewTotalPages}
              reviewTotal={reviewTotal}
              ratingsSummary={ratingsSummary}
              onPrevPage={handlePrevReviewPage}
              onNextPage={handleNextReviewPage}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              canMarkHelpful={canUseLikeActions}
              markingHelpfulReviewId={markingHelpfulReviewId}
              helpfulCountOverrides={helpfulCountOverrides}
              onMarkHelpful={handleMarkHelpful}
            />
          </ScrollReveal>
        </div>

        <ScrollReveal delayMs={80}>
          <HotelLocationSection
            hotel={hotel}
            mapSectionRef={locationSectionRef}
            shouldLoadMap={shouldLoadMap}
            mapEmbedUrl={mapEmbedUrl}
            mapUrl={mapUrl}
          />
        </ScrollReveal>

        <section ref={discoverySectionRef} className="space-y-6">
          {shouldLoadDiscovery ? (
            <>
              <ScrollReveal delayMs={40}>
                <HotelListSection
                  title="Similar Hotels"
                  description="Properties with matching location, type, and demand profile."
                  hotels={similarHotels}
                  loading={similarLoading}
                  loadingText="Loading similar hotels..."
                  errorMessage={similarErrorMessage}
                  layout="horizontal"
                  trackingContext={{ source: "similar", section: "hotel_detail_similar" }}
                />
              </ScrollReveal>

              <ScrollReveal delayMs={60}>
                <HotelListSection
                  title={`Trending in ${hotel.hotelLocation}`}
                  description="Most active hotels in this location right now."
                  hotels={trendingHotels}
                  loading={trendingLoading}
                  loadingText="Loading location trends..."
                  errorMessage={trendingErrorMessage}
                  layout="horizontal"
                  trackingContext={{ source: "trending_by_location", section: "hotel_detail_trending_location" }}
                />
              </ScrollReveal>

              {canUseRecommendedQuery ? (
                <ScrollReveal delayMs={80}>
                  <HotelListSection
                    title="Recommended for You"
                    description="Personalized suggestions based on your activity."
                    hotels={recommendedHotels}
                    loading={recommendedLoading}
                    loadingText="Loading personalized recommendations..."
                    errorMessage={recommendedErrorMessage}
                    layout="horizontal"
                    recommendationExplanations={recommendedExplanationMap}
                    trackingContext={{
                      source: "recommended_v2",
                      section: "hotel_detail_recommended",
                      profileSource: recommendedMeta?.profileSource,
                      onboardingWeight: recommendedMeta?.onboardingWeight,
                      behaviorWeight: recommendedMeta?.behaviorWeight,
                    }}
                  />
                </ScrollReveal>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Preparing recommendations...</p>
              <p className="mt-1 text-xs text-slate-600">Discovery sections will load as you scroll.</p>
              <div className="mt-4 flex gap-3 overflow-hidden">
                <div className="h-44 min-w-[16rem] flex-1 animate-pulse rounded-xl bg-slate-100" />
                <div className="hidden h-44 min-w-[16rem] flex-1 animate-pulse rounded-xl bg-slate-100 sm:block" />
                <div className="hidden h-44 min-w-[16rem] flex-1 animate-pulse rounded-xl bg-slate-100 lg:block" />
              </div>
            </div>
          )}
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

  if (context.res) {
    context.res.setHeader(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : "no-store",
    );
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
