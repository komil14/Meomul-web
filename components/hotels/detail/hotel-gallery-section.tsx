import { memo } from "react";
import Image from "next/image";
import { resolveMediaUrl } from "@/lib/utils/media-url";

interface HotelGallerySectionProps {
  images: string[];
}

export const HotelGallerySection = memo(function HotelGallerySection({ images }: HotelGallerySectionProps) {
  const galleryImages = images.map((image) => resolveMediaUrl(image));

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {galleryImages.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white hover-lift ${
                index % 6 === 0 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""
              }`}
            >
              <Image
                src={image}
                alt={`Hotel gallery ${index + 1}`}
                width={1200}
                height={800}
                sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 30vw, (min-width: 640px) 48vw, 100vw"
                className={`w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
                  index % 6 === 0 ? "h-80 lg:h-full" : "h-56"
                }`}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
                Shot {String(index + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No gallery images available yet.
        </section>
      )}
    </section>
  );
});
