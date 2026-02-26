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
  const verificationLabel = hotel.verificationStatus === "VERIFIED" ? "Verified property" : "Verification pending";
  const badgeLabel = hotel.badgeLevel === "NONE" ? null : `${hotel.badgeLevel.toLowerCase()} host`;

  return (
    <section id="overview" className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-xl">
      {heroImage ? (
        <Image
          src={heroImage}
          alt={hotel.hotelTitle}
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/75 to-sky-900/60" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-950/95 to-transparent" />

      <div className="relative p-6 text-slate-100 sm:p-8 lg:p-12">
        <div className="grid gap-7 lg:min-h-[40rem] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition hover:bg-white/20">
                    {hotel.hotelLocation}
                  </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition hover:bg-white/20">
                  {hotel.hotelType}
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.08em] transition hover:bg-white/20">
                  {verificationLabel}
                </span>
                {badgeLabel ? (
                  <span className="rounded-full border border-amber-200/40 bg-amber-200/15 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-amber-100">
                    {badgeLabel}
                  </span>
                ) : null}
              </div>

              <h1 className="max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{hotel.hotelTitle}</h1>
              <p className="max-w-2xl text-base leading-7 text-slate-100/90 sm:text-lg">{shortDescription}</p>

              <div className="flex flex-wrap gap-2.5">
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm">{hotel.starRating} star class</span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm">{cancellationPolicyText}</span>
                {hotel.safeStayCertified ? (
                  <span className="rounded-full border border-emerald-200/40 bg-emerald-200/20 px-3 py-1 text-sm text-emerald-100">
                    Safe stay certified
                  </span>
                ) : null}
                {hotel.suitableFor.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/35 bg-white/10 px-3 py-1 text-sm">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2.5">
                {canToggleLike ? (
                  <button
                    type="button"
                    onClick={onToggleLike}
                    disabled={togglingLike}
                    className="rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-sm font-semibold transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {togglingLike ? "Saving..." : hotelLiked ? "Saved" : "Save hotel"}
                  </button>
                ) : (
                  <span className="rounded-full border border-white/30 bg-white/5 px-4 py-1.5 text-sm text-slate-200/90">Login to save</span>
                )}
                <a
                  href="#rooms"
                  className="rounded-full border border-white/35 bg-black/20 px-4 py-1.5 text-sm font-semibold transition hover:bg-black/30"
                >
                  See rooms
                </a>
                <a
                  href="#reviews"
                  className="rounded-full border border-white/35 bg-black/20 px-4 py-1.5 text-sm font-semibold transition hover:bg-black/30"
                >
                  Guest reviews
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Guest rating</p>
                <p className="mt-2 text-4xl font-semibold leading-none">{hotel.hotelRating.toFixed(1)}</p>
                <p className="mt-2 text-xs text-slate-200">out of 5.0</p>
              </article>
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Reviews</p>
                <p className="mt-2 text-4xl font-semibold leading-none">{reviewCountText}</p>
                <p className="mt-2 text-xs text-slate-200">verified stays</p>
              </article>
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Satisfaction</p>
                <p className="mt-2 text-4xl font-semibold leading-none">{satisfactionText}</p>
                <p className="mt-2 text-xs text-slate-200">average score</p>
              </article>
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">Saved by guests</p>
                <p className="mt-2 text-4xl font-semibold leading-none">{formatNumber(hotelLikeCount)}</p>
                <p className="mt-2 text-xs text-slate-200">total likes</p>
              </article>
            </div>
          </div>

          <aside className="flex flex-col gap-4 rounded-3xl border border-white/30 bg-white/12 p-4 backdrop-blur-sm transition duration-500 hover:-translate-y-0.5 lg:p-5">
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
            <div className="space-y-2.5 text-sm">
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">Check-in: {hotel.checkInTime}</p>
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">Check-out: {hotel.checkOutTime}</p>
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">
                {hotel.petsAllowed ? "Pets allowed" : "No pets"} · {hotel.smokingAllowed ? "Smoking allowed" : "Non-smoking"}
              </p>
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">
                {hotel.detailedLocation.district || hotel.hotelLocation} · {hotel.detailedLocation.nearestSubway || "Transit info pending"}
              </p>
            </div>
            <a
              href="#location"
              className="inline-flex w-full justify-center rounded-xl border border-white/50 bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/30"
            >
              Explore location
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
});
