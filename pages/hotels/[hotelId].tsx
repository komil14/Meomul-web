import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Loader2, MessageSquare } from "lucide-react";
import { getSessionMember } from "@/lib/auth/session";
import { createApolloClient } from "@/lib/apollo/client";
import { HotelFeaturesSection } from "@/components/hotels/detail/hotel-features-section";
import { HotelGallerySection } from "@/components/hotels/detail/hotel-gallery-section";
import { HotelLocationSection } from "@/components/hotels/detail/hotel-location-section";
import { HotelOverviewHero } from "@/components/hotels/detail/hotel-overview-hero";
import { HotelReviewsSection } from "@/components/hotels/detail/hotel-reviews-section";
import { HotelRoomsSection } from "@/components/hotels/detail/hotel-rooms-section";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useToast } from "@/components/ui/toast-provider";
import { START_CHAT_MUTATION } from "@/graphql/chat.gql";
import { GET_HOTEL_QUERY, GET_ROOMS_BY_HOTEL_QUERY } from "@/graphql/hotel.gql";
import { useHotelDetailPageData } from "@/lib/hooks/use-hotel-detail-page-data";
import { ROOM_PAGE_SIZE } from "@/lib/hotels/detail-page-helpers";
import { pushRecentlyViewedHotel } from "@/lib/hotels/recently-viewed";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import type {
  GetHotelQueryData,
  GetHotelQueryVars,
  GetRoomsByHotelQueryData,
  GetRoomsByHotelQueryVars,
  HotelDetailItem,
  RoomListItem,
} from "@/types/hotel";
import type {
  StartChatMutationData,
  StartChatMutationVars,
} from "@/types/chat";

interface HotelDetailPageProps {
  initialHotel: HotelDetailItem | null;
  initialRooms: RoomListItem[];
}

const HotelListSection = dynamic(
  () =>
    import("@/components/hotels/detail/hotel-list-section").then(
      (mod) => mod.HotelListSection,
    ),
  {
    loading: () => (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Loading recommendations...
      </section>
    ),
  },
);

const HOTEL_DETAIL_MOTION_INTENSITY_CLASS = "motion-intensity-bold";

export default function HotelDetailPage({
  initialHotel,
  initialRooms,
}: HotelDetailPageProps) {
  const router = useRouter();
  const toast = useToast();
  const [member, setMember] =
    useState<ReturnType<typeof getSessionMember>>(null);
  useEffect(() => {
    setMember(getSessionMember());
  }, []);
  const isUser = member?.memberType === "USER";
  const [startingChat, setStartingChat] = useState(false);
  const [startChat] = useMutation<StartChatMutationData, StartChatMutationVars>(
    START_CHAT_MUTATION,
  );
  const trackedHotelIdRef = useRef<string>("");
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

  useEffect(() => {
    if (!hotel || trackedHotelIdRef.current === hotel._id) {
      return;
    }

    trackedHotelIdRef.current = hotel._id;
    pushRecentlyViewedHotel({
      hotelId: hotel._id,
      hotelTitle: hotel.hotelTitle,
      hotelLocation: hotel.hotelLocation,
      hotelType: hotel.hotelType,
      hotelRating: Number.isFinite(hotel.hotelRating) ? hotel.hotelRating : 0,
      hotelLikes: Number.isFinite(hotel.hotelLikes) ? hotel.hotelLikes : 0,
      imageUrl: resolveMediaUrl(hotel.hotelImages[0]),
    });
  }, [hotel]);

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
          <Link
            href="/hotels"
            className="text-sm text-slate-600 underline underline-offset-4"
          >
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
          <Link
            href="/hotels"
            className="text-sm text-slate-600 underline underline-offset-4"
          >
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
    <>
      <main
        className={`space-y-6 [scroll-behavior:smooth] ${HOTEL_DETAIL_MOTION_INTENSITY_CLASS}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/hotels"
            className="text-sm text-slate-600 underline underline-offset-4"
          >
            Back to hotels
          </Link>
          <div className="flex items-center gap-2">
            <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
              {hotel.hotelLocation} · {hotel.hotelType}
            </p>
          </div>
        </div>

        {hotelErrorMessage ? <ErrorNotice message={hotelErrorMessage} /> : null}
        {hotelLikedErrorMessage ? (
          <ErrorNotice message={hotelLikedErrorMessage} />
        ) : null}
        {generalActionError ? (
          <ErrorNotice message={generalActionError} />
        ) : null}

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
              address={hotel.detailedLocation?.address ?? ""}
              nearestSubway={hotel.detailedLocation?.nearestSubway ?? ""}
              activeAmenities={activeAmenities}
              checkInTime={hotel.checkInTime}
              checkOutTime={hotel.checkOutTime}
              flexibleCheckInEnabled={hotel.flexibleCheckIn?.enabled ?? false}
              flexibleCheckOutEnabled={hotel.flexibleCheckOut?.enabled ?? false}
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
                    trackingContext={{
                      source: "similar",
                      section: "hotel_detail_similar",
                    }}
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
                    trackingContext={{
                      source: "trending_by_location",
                      section: "hotel_detail_trending_location",
                    }}
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
                <p className="text-sm font-semibold text-slate-900">
                  Preparing recommendations...
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Discovery sections will load as you scroll.
                </p>
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

      {/* Floating chat FAB — always visible for logged-in users */}
      {isUser && (
        <button
          type="button"
          disabled={startingChat}
          onClick={async () => {
            setStartingChat(true);
            try {
              const { data } = await startChat({
                variables: {
                  input: {
                    hotelId,
                    initialMessage: `Hi, I’m interested in ${hotel?.hotelTitle ?? "your hotel"}. Could you help me?`,
                  },
                },
              });
              if (data?.startChat._id) {
                void router.push(`/chats/${data.startChat._id}`);
              }
            } catch {
              toast.error("Could not start chat. Please try again.");
              setStartingChat(false);
            }
          }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(14,165,233,0.5)] transition hover:bg-sky-600 hover:shadow-[0_8px_30px_-4px_rgba(14,165,233,0.6)] active:scale-95 disabled:opacity-70"
        >
          {startingChat ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <MessageSquare size={18} />
          )}
          <span className="hidden sm:inline">
            {startingChat ? "Starting chat…" : "Chat with hotel"}
          </span>
        </button>
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<
  HotelDetailPageProps
> = async (context) => {
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
