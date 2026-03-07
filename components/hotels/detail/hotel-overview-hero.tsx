import { memo } from "react";
import Image from "next/image";
import { getHotelLocationLabelLocalized, getHotelTypeLabel } from "@/lib/hotels/hotels-i18n";
import { useI18n } from "@/lib/i18n/provider";
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
  const { t } = useI18n();
  const verificationLabel =
    hotel.verificationStatus === "VERIFIED"
      ? t("hotel_detail_badge_verified")
      : t("hotel_detail_badge_pending");
  const badgeLabel =
    hotel.badgeLevel && hotel.badgeLevel !== "NONE"
      ? t("hotel_detail_badge_host", {
          level: hotel.badgeLevel.toLowerCase(),
        })
      : null;

  return (
    <section
      id="overview"
      className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-xl"
    >
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
                  {getHotelLocationLabelLocalized(hotel.hotelLocation, t)}
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition hover:bg-white/20">
                  {getHotelTypeLabel(hotel.hotelType, t)}
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

              <h1 className="max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                {hotel.hotelTitle}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-100/90 sm:text-lg">
                {shortDescription}
              </p>

              <div className="flex flex-wrap gap-2.5">
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm">
                  {t("hotel_detail_star_class", { count: hotel.starRating })}
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm">
                  {cancellationPolicyText}
                </span>
                {hotel.safeStayCertified ? (
                  <span className="rounded-full border border-emerald-200/40 bg-emerald-200/20 px-3 py-1 text-sm text-emerald-100">
                    {t("hotel_detail_safe_stay")}
                  </span>
                ) : null}
                {(hotel.suitableFor ?? []).slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/35 bg-white/10 px-3 py-1 text-sm"
                  >
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
                    {togglingLike
                      ? t("hotel_detail_saving")
                      : hotelLiked
                        ? t("hotel_detail_saved")
                        : t("hotel_detail_save_hotel")}
                  </button>
                ) : (
                  <span className="rounded-full border border-white/30 bg-white/5 px-4 py-1.5 text-sm text-slate-200/90">
                    {t("hotel_detail_login_to_save")}
                  </span>
                )}
                <a
                  href="#rooms"
                  className="rounded-full border border-white/35 bg-black/20 px-4 py-1.5 text-sm font-semibold transition hover:bg-black/30"
                >
                  {t("hotel_detail_see_rooms")}
                </a>
                <a
                  href="#reviews"
                  className="rounded-full border border-white/35 bg-black/20 px-4 py-1.5 text-sm font-semibold transition hover:bg-black/30"
                >
                  {t("hotel_detail_guest_reviews_cta")}
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">
                  {t("hotel_detail_guest_rating")}
                </p>
                <p className="mt-2 text-4xl font-semibold leading-none">
                  {(hotel.hotelRating ?? 0).toFixed(1)}
                </p>
                <p className="mt-2 text-xs text-slate-200">{t("hotel_detail_out_of_five")}</p>
              </article>
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">
                  {t("hotel_detail_reviews_metric")}
                </p>
                <p className="mt-2 text-4xl font-semibold leading-none">
                  {reviewCountText}
                </p>
                <p className="mt-2 text-xs text-slate-200">{t("hotel_detail_verified_stays")}</p>
              </article>
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">
                  {t("hotel_detail_satisfaction")}
                </p>
                <p className="mt-2 text-4xl font-semibold leading-none">
                  {satisfactionText}
                </p>
                <p className="mt-2 text-xs text-slate-200">{t("hotel_detail_average_score")}</p>
              </article>
              <article className="rounded-2xl border border-white/30 bg-white/15 px-4 py-4 backdrop-blur-sm hover-lift">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-200">
                  {t("hotel_detail_saved_by_guests")}
                </p>
                <p className="mt-2 text-4xl font-semibold leading-none">
                  {formatNumber(hotelLikeCount)}
                </p>
                <p className="mt-2 text-xs text-slate-200">{t("hotel_detail_total_likes")}</p>
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
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">
                {t("hotel_detail_checkin")}: {hotel.checkInTime ?? "—"}
              </p>
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">
                {t("hotel_detail_checkout")}: {hotel.checkOutTime ?? "—"}
              </p>
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">
                {hotel.petsAllowed ? t("hotel_features_pets_yes") : t("hotel_features_pets_no")} ·{" "}
                {hotel.smokingAllowed ? t("hotel_features_smoking_yes") : t("hotel_features_smoking_no")}
              </p>
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5">
                {hotel.detailedLocation?.district || getHotelLocationLabelLocalized(hotel.hotelLocation, t)} ·{" "}
                {hotel.detailedLocation?.nearestSubway ||
                  t("hotel_detail_transit_pending")}
              </p>
            </div>
            <a
              href="#location"
              className="inline-flex w-full justify-center rounded-xl border border-white/50 bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/30"
            >
              {t("hotel_detail_explore_location")}
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
});
