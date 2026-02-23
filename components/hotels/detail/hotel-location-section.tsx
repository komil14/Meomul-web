import type { RefObject } from "react";
import type { HotelDetailItem } from "@/types/hotel";

interface HotelLocationSectionProps {
  hotel: HotelDetailItem;
  mapSectionRef: RefObject<HTMLElement | null>;
  shouldLoadMap: boolean;
  mapEmbedUrl: string;
  mapUrl: string;
}

export function HotelLocationSection({ hotel, mapSectionRef, shouldLoadMap, mapEmbedUrl, mapUrl }: HotelLocationSectionProps) {
  return (
    <section id="location" ref={mapSectionRef} className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Location</h2>
        <p className="text-sm text-slate-600">Where you will stay and nearby transit context.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-900">Address:</span> {hotel.detailedLocation.address}
          </p>
          <p>
            <span className="font-semibold text-slate-900">District:</span> {hotel.detailedLocation.district || "-"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Nearest subway:</span> {hotel.detailedLocation.nearestSubway || "-"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Walking distance:</span>{" "}
            {hotel.detailedLocation.walkingDistance != null ? `${hotel.detailedLocation.walkingDistance} min` : "-"}
          </p>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          {shouldLoadMap ? (
            <iframe
              title={`${hotel.hotelTitle} map`}
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-72 w-full"
              allowFullScreen
            />
          ) : (
            <div className="flex h-72 items-center justify-center bg-slate-100 text-sm text-slate-600">Map loading...</div>
          )}
        </div>
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          Open on map
        </a>
      </div>
    </section>
  );
}
