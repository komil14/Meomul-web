import Image from "next/image";

interface HotelGallerySectionProps {
  images: string[];
}

export function HotelGallerySection({ images }: HotelGallerySectionProps) {
  return (
    <section id="gallery" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Gallery</h2>
        <p className="text-sm text-slate-600">A quick visual tour of this property.</p>
      </header>

      {images.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white ${
                index % 5 === 0 ? "sm:col-span-2" : ""
              }`}
            >
              <Image
                src={image}
                alt={`Hotel gallery ${index + 1}`}
                width={1200}
                height={800}
                sizes="(min-width: 1024px) 24vw, (min-width: 640px) 48vw, 100vw"
                className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
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
}
