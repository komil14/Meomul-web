import { memo } from "react";
import { formatNumber } from "@/lib/utils/format";

interface HotelFeaturesSectionProps {
  fromPrice: number;
  cancellationPolicyText: string;
  address: string;
  nearestSubway?: string | null;
  activeAmenities: string[];
}

export const HotelFeaturesSection = memo(function HotelFeaturesSection({
  fromPrice,
  cancellationPolicyText,
  address,
  nearestSubway,
  activeAmenities,
}: HotelFeaturesSectionProps) {
  return (
    <section id="features" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Features</h2>
        <p className="text-sm text-slate-600">Amenities and policies designed for comfort.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">From</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">₩ {fromPrice > 0 ? formatNumber(fromPrice) : "-"}</p>
          <p className="mt-1 text-xs text-slate-500">per room/night</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cancellation</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{cancellationPolicyText}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Address</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{address || "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Nearby Subway</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{nearestSubway || "Not specified"}</p>
        </article>
      </div>

      {activeAmenities.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Top amenities</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeAmenities.map((amenity) => (
              <span key={amenity} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {amenity}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
});
