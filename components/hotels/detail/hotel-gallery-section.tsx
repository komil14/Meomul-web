import { memo, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { resolveMediaUrl } from "@/lib/utils/media-url";

interface HotelGallerySectionProps {
  images: string[];
}

const SCENE_LABELS = ["Arrival", "Lobby", "Suite", "Amenities", "Sky View", "Dining", "Neighborhood", "Night"];

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

const sceneLabelFor = (index: number): string => SCENE_LABELS[index % SCENE_LABELS.length];

export const HotelGallerySection = memo(function HotelGallerySection({ images }: HotelGallerySectionProps) {
  const galleryImages = useMemo(
    () => images.map((image) => resolveMediaUrl(image)).filter((image) => image.length > 0),
    [images],
  );
  const totalImages = galleryImages.length;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const activeImage = totalImages > 0 ? galleryImages[activeImageIndex] : null;
  const activeSceneLabel = sceneLabelFor(activeImageIndex);

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
    <section id="gallery" className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Gallery</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Visual Storyline</h2>
            <p className="text-sm text-slate-600">One focused hero image with quick scene switching, no popup lock, smooth page scroll.</p>
          </div>
          {totalImages > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((previous) => !previous)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
            >
              {expanded ? "Collapse grid" : `See all photos (${totalImages})`}
            </button>
          ) : null}
        </div>
      </header>

      {totalImages > 0 && activeImage ? (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-3 shadow-sm sm:p-4">
          <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
            <Image
              src={activeImage}
              alt={`Hotel scene ${activeImageIndex + 1}`}
              width={2200}
              height={1400}
              sizes="100vw"
              className="h-64 w-full object-cover sm:h-80 lg:h-[30rem]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />

            <div className="absolute left-3 top-3 rounded-full border border-white/35 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white">
              {activeSceneLabel}
            </div>
            <div className="absolute right-3 top-3 rounded-full border border-white/35 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white">
              {String(activeImageIndex + 1).padStart(2, "0")} / {String(totalImages).padStart(2, "0")}
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              <p className="text-sm font-semibold text-white sm:text-base">{activeSceneLabel} scene preview</p>
              {totalImages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="rounded-full border border-white/35 bg-black/45 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-full border border-white/35 bg-black/45 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </article>

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {galleryImages.map((image, index) => (
              <button
                key={`${image}-thumb-${index}`}
                type="button"
                onClick={() => selectImage(index)}
                className={`relative min-w-[5.5rem] overflow-hidden rounded-xl border transition sm:min-w-[6.25rem] ${
                  index === activeImageIndex ? "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.45)]" : "border-slate-200"
                }`}
              >
                <Image
                  src={image}
                  alt={`Scene thumbnail ${index + 1}`}
                  width={320}
                  height={220}
                  sizes="100px"
                  className="h-14 w-full object-cover sm:h-16"
                />
                <span className="absolute bottom-1 right-1 rounded border border-white/35 bg-black/45 px-1 text-[9px] font-semibold text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>

          {expanded ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-grid-${index}`}
                  type="button"
                  onClick={() => selectImage(index)}
                  className={`group relative overflow-hidden rounded-xl border ${
                    index === activeImageIndex ? "border-cyan-400" : "border-slate-200"
                  }`}
                >
                  <Image
                    src={image}
                    alt={`Gallery grid ${index + 1}`}
                    width={900}
                    height={700}
                    sizes="(min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
                    className="h-28 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-32"
                  />
                  <span className="absolute left-2 top-2 rounded-md border border-white/35 bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {sceneLabelFor(index)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No gallery images available yet.
        </section>
      )}
    </section>
  );
});
