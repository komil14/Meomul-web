import { memo, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/provider";
import { resolveMediaUrl } from "@/lib/utils/media-url";

interface HotelGallerySectionProps {
  images: string[];
}

const clampIndex = (index: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  if (index < 0) {
    return 0;
  }
  if (index >= total) {
    return total - 1;
  }
  return index;
};

export const HotelGallerySection = memo(function HotelGallerySection({ images }: HotelGallerySectionProps) {
  const { t } = useI18n();
  const galleryImages = useMemo(
    () => images.map((image) => resolveMediaUrl(image)).filter((image) => image.length > 0),
    [images],
  );
  const totalImages = galleryImages.length;

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const activeImage = totalImages > 0 ? galleryImages[activeImageIndex] : null;
  const selectImage = useCallback(
    (index: number): void => {
      setActiveImageIndex(clampIndex(index, totalImages));
    },
    [totalImages],
  );

  const handlePrev = useCallback((): void => {
    if (totalImages <= 1) {
      return;
    }
    setActiveImageIndex((previous) => (previous - 1 + totalImages) % totalImages);
  }, [totalImages]);

  const handleNext = useCallback((): void => {
    if (totalImages <= 1) {
      return;
    }
    setActiveImageIndex((previous) => (previous + 1) % totalImages);
  }, [totalImages]);

  return (
    <section id="gallery" className="space-y-4">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("hotel_gallery_eyebrow")}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{t("hotel_gallery_title")}</h2>
            <p className="text-sm text-slate-600">{t("hotel_gallery_desc")}</p>
          </div>
        </div>
      </header>

      {totalImages > 0 && activeImage ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 hover-lift sm:p-4">
          <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <Image
              src={activeImage}
              alt={`Hotel scene ${activeImageIndex + 1}`}
              width={2200}
              height={1400}
              sizes="100vw"
              className="h-64 w-full object-cover transition duration-700 group-hover:scale-[1.02] sm:h-80 lg:h-[30rem]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />

            <div className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
              {String(activeImageIndex + 1).padStart(2, "0")} / {String(totalImages).padStart(2, "0")}
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              <div />
              {totalImages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="rounded-full border border-white/30 bg-black/45 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/60"
                  >
                    {t("hotel_gallery_prev")}
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-full border border-white/30 bg-black/45 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/60"
                  >
                    {t("hotel_gallery_next")}
                  </button>
                </div>
              ) : null}
            </div>
          </article>

          <div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-thumb-${index}`}
                  type="button"
                  onClick={() => selectImage(index)}
                  className={`group relative min-w-[5.5rem] overflow-hidden rounded-lg border transition duration-300 hover:-translate-y-0.5 hover:shadow-sm sm:min-w-[6.25rem] ${
                    index === activeImageIndex ? "border-slate-900" : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <Image
                    src={image}
                    alt={`Scene thumbnail ${index + 1}`}
                    width={320}
                    height={220}
                    sizes="100px"
                    className="h-14 w-full object-cover transition duration-500 group-hover:scale-[1.04] sm:h-16"
                  />
                  <span className="absolute bottom-1 right-1 rounded border border-white/40 bg-black/50 px-1 text-[9px] font-semibold text-white">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          {t("hotel_gallery_empty")}
        </section>
      )}
    </section>
  );
});
