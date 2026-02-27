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
  imagePriority?: boolean;
  imageSizes?: string;
}

const formatLocationLabel = (location: string): string =>
  location
    ? `${location.toLowerCase().charAt(0).toUpperCase()}${location.toLowerCase().slice(1)}`
    : "Unknown";

const DEFAULT_IMAGE_SIZES = "(max-width: 479px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 24rem";

export const HotelCard = memo(function HotelCard({
  hotel,
  trackingContext,
  imagePriority = false,
  imageSizes = DEFAULT_IMAGE_SIZES,
}: HotelCardProps) {
  const router = useRouter();
  const hasPrefetchedRef = useRef(false);
  const coverImage = hotel.hotelImages[0];
  const hotelHref = `/hotels/${hotel._id}`;
  const ratingText = Number.isFinite(hotel.hotelRating) ? hotel.hotelRating.toFixed(1) : "0.0";
  const likeText = hotel.hotelLikes.toLocaleString();
  const locationLabel = formatLocationLabel(hotel.hotelLocation);

  const handlePrefetchIntent = useCallback(() => {
    if (hasPrefetchedRef.current) {
      return;
    }

    hasPrefetchedRef.current = true;
    void router.prefetch(hotelHref);
  }, [hotelHref, router]);

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_22px_46px_-34px_rgba(15,23,42,0.55)] transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_30px_66px_-30px_rgba(15,23,42,0.58)]">
      <Link
        href={hotelHref}
        prefetch={false}
        className="block h-full focus:outline-none"
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
        <div className="relative h-64 w-full overflow-hidden bg-slate-200 sm:h-72">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={hotel.hotelTitle}
              fill
              priority={imagePriority}
              sizes={imageSizes}
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-white text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              curated stay
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/18 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-4 md:hidden">
            <p className="line-clamp-2 text-xl font-semibold leading-tight text-white">{hotel.hotelTitle}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-white/90">
              <span>
                {locationLabel} · {hotel.hotelType}
              </span>
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M12 2l2.95 6.08 6.72.98-4.86 4.67 1.15 6.6L12 17.2l-5.96 3.13 1.15-6.6L2.33 9.06l6.72-.98L12 2z" />
                </svg>
                {ratingText}
              </span>
            </div>
          </div>

          <div className="absolute inset-0 hidden p-5 opacity-0 transition duration-300 md:flex md:flex-col md:justify-end md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <div className="rounded-2xl border border-white/20 bg-black/45 p-4 backdrop-blur-md">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full border border-white/35 bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  {locationLabel}
                </span>
                <span className="rounded-full border border-white/35 bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  {hotel.hotelType}
                </span>
              </div>
              <p className="line-clamp-2 text-2xl font-semibold leading-tight text-white">{hotel.hotelTitle}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-3 text-sm text-white/90">
                  <span className="inline-flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-amber-300" aria-hidden>
                      <path d="M12 2l2.95 6.08 6.72.98-4.86 4.67 1.15 6.6L12 17.2l-5.96 3.13 1.15-6.6L2.33 9.06l6.72-.98L12 2z" />
                    </svg>
                    {ratingText}
                  </span>
                  <span>{likeText} likes</span>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
});
