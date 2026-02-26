import { memo, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { resolveMediaUrl } from "@/lib/utils/media-url";

interface HotelGallerySectionProps {
  images: string[];
}

export const HotelGallerySection = memo(function HotelGallerySection({ images }: HotelGallerySectionProps) {
  const galleryImages = images.map((image) => resolveMediaUrl(image));
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const openViewer = useCallback((index: number) => {
    setActiveImageIndex(index);
    setViewerOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  const goPrev = useCallback(() => {
    setActiveImageIndex((previous) => (previous - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const goNext = useCallback(() => {
    setActiveImageIndex((previous) => (previous + 1) % galleryImages.length);
  }, [galleryImages.length]);

  useEffect(() => {
    if (!viewerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setViewerOpen(false);
      }
      if (event.key === "ArrowLeft" && galleryImages.length > 1) {
        setActiveImageIndex((previous) => (previous - 1 + galleryImages.length) % galleryImages.length);
      }
      if (event.key === "ArrowRight" && galleryImages.length > 1) {
        setActiveImageIndex((previous) => (previous + 1) % galleryImages.length);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [galleryImages.length, viewerOpen]);

  return (
    <section id="gallery" className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Gallery</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Visual walkthrough</h2>
            <p className="text-sm text-slate-600">Real photos across spaces, atmosphere, and room styles.</p>
          </div>
          {galleryImages.length > 0 ? (
            <p className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {galleryImages.length} photos
            </p>
          ) : null}
        </div>
      </header>

      {galleryImages.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            <button
              type="button"
              onClick={() => openViewer(0)}
              className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <Image
                src={galleryImages[0]}
                alt="Hotel featured gallery shot"
                width={1400}
                height={900}
                sizes="100vw"
                className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
                View all photos
              </span>
              <span className="absolute bottom-3 right-3 rounded-full border border-white/35 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white">
                {galleryImages.length} total
              </span>
            </button>

            {galleryImages.length > 1 ? (
              <div className="grid grid-cols-3 gap-2">
                {galleryImages.slice(1, 9).map((image, index) => (
                  <button
                    key={`${image}-${index + 1}`}
                    type="button"
                    onClick={() => openViewer(index + 1)}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <Image
                      src={image}
                      alt={`Hotel gallery ${index + 2}`}
                      width={720}
                      height={480}
                      sizes="(max-width: 768px) 33vw, 120px"
                      className="h-20 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute left-2 top-2 rounded-md border border-white/35 bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {String(index + 2).padStart(2, "0")}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
            {galleryImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => openViewer(index)}
                className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-left hover-lift ${
                  index % 6 === 0 ? "md:col-span-2 xl:col-span-2 xl:row-span-2" : ""
                }`}
              >
                <Image
                  src={image}
                  alt={`Hotel gallery ${index + 1}`}
                  width={1200}
                  height={800}
                  sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 30vw, (min-width: 768px) 48vw, 100vw"
                  className={`w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
                    index % 6 === 0 ? "h-80 xl:h-full" : "h-56"
                  }`}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
                  Shot {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No gallery images available yet.
        </section>
      )}

      {viewerOpen && galleryImages[activeImageIndex] ? (
        <div className="fixed inset-0 z-50 bg-slate-950/90 p-3 sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
                Photo {activeImageIndex + 1} / {galleryImages.length}
              </p>
              <button
                type="button"
                onClick={closeViewer}
                className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {galleryImages.length > 1 ? (
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/30 bg-black/40 px-3 py-2 text-xs font-semibold text-white"
                >
                  Prev
                </button>
              ) : null}

              <Image
                src={galleryImages[activeImageIndex]}
                alt={`Hotel gallery large ${activeImageIndex + 1}`}
                width={1800}
                height={1200}
                sizes="100vw"
                className="max-h-full w-full rounded-2xl border border-white/10 object-contain"
              />

              {galleryImages.length > 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/30 bg-black/40 px-3 py-2 text-xs font-semibold text-white"
                >
                  Next
                </button>
              ) : null}
            </div>

            {galleryImages.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image}-thumb-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative min-w-[5.25rem] overflow-hidden rounded-lg border ${
                      index === activeImageIndex ? "border-cyan-300" : "border-white/20"
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`Hotel gallery thumbnail ${index + 1}`}
                      width={280}
                      height={180}
                      sizes="90px"
                      className="h-14 w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
});
