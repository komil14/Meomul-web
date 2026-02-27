import { memo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import type { HotelListItem } from "@/types/hotel";

export interface HotelCardTrackingContext {
  source: string;
  section: string;
  profileSource?: "onboarding" | "computed";
  onboardingWeight?: number;
  behaviorWeight?: number;
}

interface HotelCardProps {
  hotel: HotelListItem;
  trackingContext?: HotelCardTrackingContext;
}

export const HotelCard = memo(function HotelCard({ hotel, trackingContext }: HotelCardProps) {
  const router = useRouter();
  const hasPrefetchedRef = useRef(false);
  const coverImage = hotel.hotelImages[0];
  const hotelHref = `/hotels/${hotel._id}`;

  const handlePrefetchIntent = useCallback(() => {
    if (hasPrefetchedRef.current) {
      return;
    }

    hasPrefetchedRef.current = true;
    void router.prefetch(hotelHref);
  }, [hotelHref, router]);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl">
      <Link
        href={hotelHref}
        prefetch={false}
        className="block"
        onMouseEnter={handlePrefetchIntent}
        onFocus={handlePrefetchIntent}
        onClick={() => {
          if (!trackingContext) {
            return;
          }

          trackAnalyticsEvent("hotel_card_clicked", {
            hotelId: hotel._id,
            hotelLocation: hotel.hotelLocation,
            source: trackingContext.source,
            section: trackingContext.section,
            profileSource: trackingContext.profileSource ?? null,
            onboardingWeight: trackingContext.onboardingWeight ?? null,
            behaviorWeight: trackingContext.behaviorWeight ?? null,
          });
        }}
      >
        <div className="relative h-32 w-full bg-slate-200 sm:h-40">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={hotel.hotelTitle}
              fill
              sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-100 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              No Image
            </div>
          )}
        </div>

        <div className="space-y-1.5 p-3 sm:space-y-2 sm:p-4">
          <h3 className="line-clamp-1 text-[15px] font-semibold text-slate-900 sm:text-base">{hotel.hotelTitle}</h3>
          <p className="line-clamp-1 text-xs text-slate-600 sm:text-sm">
            {hotel.hotelLocation} · {hotel.hotelType}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-700 sm:text-sm">
            <span>Rating {hotel.hotelRating.toFixed(1)}</span>
            <span>{hotel.hotelLikes} likes</span>
          </div>
        </div>
      </Link>
    </article>
  );
});
