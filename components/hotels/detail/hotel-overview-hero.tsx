import { memo } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { ArrowLeft, Heart, Share, Star } from "lucide-react";
import { getHotelLocationLabelLocalized, getHotelTypeLabel } from "@/lib/hotels/hotels-i18n";
import { useI18n } from "@/lib/i18n/provider";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import { getYouTubeEmbedUrl } from "@/lib/utils/youtube";
import type { HotelDetailItem } from "@/types/hotel";

interface HotelOverviewHeroProps {
  hotel: HotelDetailItem;
  heroImage: string;
  heroVideo?: string;
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
  onShare?: () => void;
}

type MediaItem =
  | { kind: "youtube"; src: string }
  | { kind: "video"; src: string }
  | { kind: "image"; src: string };

export const HotelOverviewHero = memo(function HotelOverviewHero({
  hotel,
  heroImage,
  heroVideo,
  reviewCountText,
  hotelLiked,
  canToggleLike,
  togglingLike,
  onToggleLike,
  onShare,
}: HotelOverviewHeroProps) {
  const router = useRouter();
  const { t } = useI18n();
  const locationLabel = getHotelLocationLabelLocalized(hotel.hotelLocation, t);
  const hotelTypeLabel = getHotelTypeLabel(hotel.hotelType, t);
  const starLabel =
    typeof hotel.starRating === "number" && hotel.starRating > 0
      ? `${hotel.starRating}-star`
      : null;
  const primaryVideoValue = heroVideo || hotel.hotelVideos[0] || "";
  const primaryYoutube = getYouTubeEmbedUrl(primaryVideoValue);
  const primaryVideo = primaryYoutube ? "" : resolveMediaUrl(primaryVideoValue);
  const primaryImage = resolveMediaUrl(heroImage || hotel.hotelImages[0] || "");
  const primaryMedia: MediaItem | null = primaryYoutube
    ? { kind: "youtube", src: primaryYoutube }
    : primaryVideo
      ? { kind: "video", src: primaryVideo }
      : primaryImage
        ? { kind: "image", src: primaryImage }
        : null;

  return (
    <section id="overview" className="space-y-5">
      <div className="hidden flex-col gap-4 md:flex lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="max-w-5xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-[2.65rem]">
            {hotel.hotelTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-stone-700">
            <span className="inline-flex items-center gap-1 text-stone-950">
              <Star className="h-4 w-4 fill-current" />
              {(hotel.hotelRating ?? 0).toFixed(2)}
            </span>
            <span className="underline underline-offset-2">{reviewCountText} reviews</span>
            <span>{hotel.detailedLocation?.district || locationLabel}, South Korea</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm font-semibold text-stone-950">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-stone-100"
          >
            <Share className="h-4 w-4" />
            <span className="underline underline-offset-2">{t("hotel_detail_share")}</span>
          </button>
          <button
            type="button"
            onClick={onToggleLike}
            disabled={!canToggleLike || togglingLike}
            className="inline-flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Heart className={`h-4 w-4 ${hotelLiked ? "fill-current text-rose-500" : ""}`} />
            <span className="underline underline-offset-2">
              {hotelLiked ? t("hotel_detail_saved") : t("hotel_detail_save")}
            </span>
          </button>
        </div>
      </div>

      <div className="md:hidden">
        {primaryMedia ? (
          <div className="-mx-3 overflow-hidden sm:-mx-6">
            <div className="relative bg-stone-100">
              <article className="relative min-h-[18rem] overflow-hidden bg-stone-100">
                {primaryMedia.kind === "youtube" ? (
                  <iframe
                    src={primaryMedia.src}
                    title={hotel.hotelTitle}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                ) : primaryMedia.kind === "video" ? (
                  <video
                    key={primaryMedia.src}
                    src={primaryMedia.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                ) : (
                  <Image
                    src={primaryMedia.src}
                    alt={hotel.hotelTitle}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover"
                  />
                )}
              </article>

              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
                <button
                  type="button"
                  onClick={() => {
                    if (window.history.length > 1) {
                      void router.back();
                      return;
                    }
                    void router.push("/hotels");
                  }}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-950 shadow-sm"
                  aria-label={t("hotel_detail_back")}
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onShare}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-950 shadow-sm"
                    aria-label={t("hotel_detail_share")}
                  >
                    <Share className="h-4.5 w-4.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleLike}
                    disabled={!canToggleLike || togglingLike}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={hotelLiked ? t("hotel_detail_saved") : t("hotel_detail_save")}
                  >
                    <Heart className={`h-4.5 w-4.5 ${hotelLiked ? "fill-current text-rose-500" : ""}`} />
                  </button>
                </div>
              </div>

            </div>

            <div className="relative z-10 -mt-10 rounded-[2rem] bg-white px-4 pb-2 pt-5 shadow-[0_-6px_24px_-18px_rgba(15,23,42,0.18)]">
              <div className="space-y-4 pb-4 text-center">
                <h1 className="text-[1.85rem] font-semibold leading-tight tracking-tight text-stone-950">
                  {hotel.hotelTitle}
                </h1>
                <div className="space-y-1.5 text-stone-600">
                  <p className="text-base">
                    {t("hotel_airbnb_intro_title", {
                      district: hotel.detailedLocation?.district || locationLabel,
                    })}
                  </p>
                  <p className="text-base">
                    {hotelTypeLabel}
                    {starLabel ? ` · ${starLabel}` : ""}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-base font-medium text-stone-900">
                  <Star className="h-4 w-4 shrink-0 fill-current" />
                  <span>{(hotel.hotelRating ?? 0).toFixed(2)}</span>
                  <span>·</span>
                  <span>{reviewCountText} reviews</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="-mx-3 rounded-b-[2rem] bg-stone-100 px-6 py-20 text-center text-sm text-stone-600 sm:-mx-6">
            {t("hotel_gallery_empty")}
          </div>
        )}
      </div>

      {primaryMedia ? (
        <div className="relative hidden overflow-hidden rounded-[1.75rem] bg-stone-100 md:block">
          <article className="relative min-h-[16rem] overflow-hidden bg-stone-100 sm:min-h-[22rem] lg:min-h-[30rem]">
            {primaryMedia.kind === "youtube" ? (
              <iframe
                src={primaryMedia.src}
                title={hotel.hotelTitle}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : primaryMedia.kind === "video" ? (
              <video
                key={primaryMedia.src}
                src={primaryMedia.src}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <Image
                src={primaryMedia.src}
                alt={hotel.hotelTitle}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            )}
          </article>

          <a
            href="#gallery"
            className="absolute bottom-4 right-4 inline-flex items-center rounded-xl border border-stone-900 bg-white px-4 py-3 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-stone-50"
          >
            {t("hotel_detail_show_all_photos")}
          </a>
        </div>
      ) : (
        <div className="rounded-[1.75rem] bg-stone-100 px-6 py-20 text-center text-sm text-stone-600">
          {t("hotel_gallery_empty")}
        </div>
      )}
    </section>
  );
});
