import { memo } from "react";
import { formatNumber } from "@/lib/utils/format";

interface HotelFeaturesSectionProps {
  fromPrice: number;
  cancellationPolicyText: string;
  address: string;
  nearestSubway?: string | null;
  activeAmenities: string[];
  checkInTime: string;
  checkOutTime: string;
  flexibleCheckInEnabled: boolean;
  flexibleCheckOutEnabled: boolean;
  petsAllowed: boolean;
  smokingAllowed: boolean;
}

export const HotelFeaturesSection = memo(function HotelFeaturesSection({
  fromPrice,
  cancellationPolicyText,
  address,
  nearestSubway,
  activeAmenities,
  checkInTime,
  checkOutTime,
  flexibleCheckInEnabled,
  flexibleCheckOutEnabled,
  petsAllowed,
  smokingAllowed,
}: HotelFeaturesSectionProps) {
  const primaryAmenities = activeAmenities.slice(0, 12);
  const extraAmenitiesCount = Math.max(0, activeAmenities.length - primaryAmenities.length);

  return (
    <section id="features" className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Stay Profile</p>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Everything this property offers</h2>
        <p className="max-w-3xl text-sm text-slate-600">Pricing, rules, and amenity strengths from live backend data.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Starting rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">KRW {fromPrice > 0 ? formatNumber(fromPrice) : "-"}</p>
            <p className="mt-1 text-xs text-slate-500">per room/night</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cancellation</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{cancellationPolicyText}</p>
            <p className="mt-1 text-xs text-slate-500">applies by booking policy</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Check-in / Check-out</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {checkInTime} / {checkOutTime}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {flexibleCheckInEnabled ? "Flexible check-in available" : "Standard check-in"} ·{" "}
              {flexibleCheckOutEnabled ? "Flexible check-out available" : "Standard check-out"}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">House rules</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {petsAllowed ? "Pets welcome" : "No pets"} · {smokingAllowed ? "Smoking allowed" : "Non-smoking"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{nearestSubway || "Subway not specified"} nearby</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Address</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{address || "-"}</p>
          </article>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-sm">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-200">Amenity Highlights</p>
              <h3 className="mt-1 text-xl font-semibold">Guest comfort essentials</h3>
            </div>
            <p className="text-xs text-slate-200">{activeAmenities.length} matched</p>
          </div>

          {primaryAmenities.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {primaryAmenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white"
                >
                  {amenity}
                </span>
              ))}
              {extraAmenitiesCount > 0 ? (
                <span className="rounded-full border border-white/30 bg-black/20 px-3 py-1 text-xs font-semibold text-slate-100">
                  +{extraAmenitiesCount} more
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-200">Amenities are still being updated for this property.</p>
          )}
        </div>
      </div>
    </section>
  );
});
