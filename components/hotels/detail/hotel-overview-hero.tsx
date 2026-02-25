import { memo } from "react";
import Image from "next/image";
import { formatNumber } from "@/lib/utils/format";
import type { HotelDetailItem } from "@/types/hotel";

interface HotelOverviewHeroProps {
  hotel: HotelDetailItem;
  heroImage: string;
  secondaryImage: string;
  shortDescription: string;
  reviewCountText: string;
  satisfactionText: string;
  cancellationPolicyText: string;
  hotelLikeCount: number;
  hotelLiked: boolean;
  canToggleLike: boolean;
  togglingLike: boolean;
  onToggleLike: () => void;
}

export const HotelOverviewHero = memo(function HotelOverviewHero({
  hotel,
  heroImage,
  secondaryImage,
  shortDescription,
  reviewCountText,
  satisfactionText,
  cancellationPolicyText,
  hotelLikeCount,
  hotelLiked,
  canToggleLike,
  togglingLike,
  onToggleLike,
}: HotelOverviewHeroProps) {
  return (
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
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">{cancellationPolicyText}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">{formatNumber(hotelLikeCount)} likes</span>
                {hotel.suitableFor.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/35 bg-white/10 px-3 py-1 text-sm">
                    {tag}
                  </span>
                ))}
                {canToggleLike ? (
                  <button
                    type="button"
                    onClick={onToggleLike}
                    disabled={togglingLike}
                    className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {togglingLike ? "Saving..." : hotelLiked ? "Saved" : "Save hotel"}
                  </button>
                ) : (
                  <span className="rounded-full border border-white/30 bg-white/5 px-3 py-1 text-sm text-slate-200/90">Login to save</span>
                )}
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
                <p className="mt-2 text-4xl font-semibold leading-none">{satisfactionText}</p>
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
  );
});
