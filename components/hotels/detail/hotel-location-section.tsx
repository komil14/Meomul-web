import { memo, type RefObject } from "react";
import type { HotelDetailItem } from "@/types/hotel";

interface HotelLocationSectionProps {
  hotel: HotelDetailItem;
  mapSectionRef: RefObject<HTMLElement | null>;
  shouldLoadMap: boolean;
  mapEmbedUrl: string;
  mapUrl: string;
}

export const HotelLocationSection = memo(function HotelLocationSection({
  hotel,
  mapSectionRef,
  shouldLoadMap,
  mapEmbedUrl,
  mapUrl,
}: HotelLocationSectionProps) {
  return (
    <section id="location" ref={mapSectionRef} className="space-y-5 motion-fade-up motion-delay-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Location</p>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Where you will stay</h2>
        <p className="text-sm text-slate-600">Address, transit, and map context from verified listing data.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 hover-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Address</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{hotel.detailedLocation.address}</p>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">District</p>
              <p className="mt-1 font-semibold text-slate-900">{hotel.detailedLocation.district || "-"}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Nearest subway</p>
              <p className="mt-1 font-semibold text-slate-900">{hotel.detailedLocation.nearestSubway || "-"}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Walking distance</p>
              <p className="mt-1 font-semibold text-slate-900">
                {hotel.detailedLocation.walkingDistance != null ? `${hotel.detailedLocation.walkingDistance} min` : "-"}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">City</p>
              <p className="mt-1 font-semibold text-slate-900">{hotel.detailedLocation.city}</p>
            </article>
          </div>

          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
          >
            Open in Google Maps
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 hover-lift">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {shouldLoadMap ? (
              <iframe
                title={`${hotel.hotelTitle} map`}
                src={mapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-80 w-full lg:h-[22.5rem]"
                allowFullScreen
              />
            ) : (
              <div className="flex h-80 items-center justify-center bg-slate-100 text-sm text-slate-600 lg:h-[22.5rem]">Map loading...</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
