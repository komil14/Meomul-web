import { memo } from "react";
import { useI18n } from "@/lib/i18n/provider";
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
  const { t } = useI18n();
  const primaryAmenities = activeAmenities.slice(0, 12);
  const extraAmenitiesCount = Math.max(0, activeAmenities.length - primaryAmenities.length);

  return (
    <section id="features" className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("hotel_features_eyebrow")}</p>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{t("hotel_features_title")}</h2>
        <p className="max-w-3xl text-sm text-slate-600">{t("hotel_features_desc")}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover-lift">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t("hotel_features_starting_rate")}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">KRW {fromPrice > 0 ? formatNumber(fromPrice) : "-"}</p>
            <p className="mt-1 text-xs text-slate-500">{t("hotel_features_per_room_night")}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover-lift">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t("hotel_features_cancellation")}</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{cancellationPolicyText}</p>
            <p className="mt-1 text-xs text-slate-500">{t("hotel_features_policy_note")}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover-lift">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t("hotel_features_checkin_checkout")}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {checkInTime} / {checkOutTime}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {flexibleCheckInEnabled ? t("hotel_features_flexible_checkin") : t("hotel_features_standard_checkin")} ·{" "}
              {flexibleCheckOutEnabled ? t("hotel_features_flexible_checkout") : t("hotel_features_standard_checkout")}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover-lift">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t("hotel_features_house_rules")}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {petsAllowed ? t("hotel_features_pets_yes") : t("hotel_features_pets_no")} · {smokingAllowed ? t("hotel_features_smoking_yes") : t("hotel_features_smoking_no")}
            </p>
            <p className="mt-1 text-xs text-slate-500">{nearestSubway || t("hotel_features_subway_missing")} {t("hotel_features_nearby")}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 hover-lift">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t("hotel_features_address")}</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{address || "-"}</p>
          </article>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-sm hover-lift">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-200">{t("hotel_features_amenities_eyebrow")}</p>
              <h3 className="mt-1 text-xl font-semibold">{t("hotel_features_amenities_title")}</h3>
            </div>
            <p className="text-xs text-slate-200">{t("hotel_features_matched_count", { count: activeAmenities.length })}</p>
          </div>

          {primaryAmenities.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {primaryAmenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/25"
                >
                  {amenity}
                </span>
              ))}
              {extraAmenitiesCount > 0 ? (
                <span className="rounded-full border border-white/30 bg-black/20 px-3 py-1 text-xs font-semibold text-slate-100">
                  {t("hotel_features_more", { count: extraAmenitiesCount })}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-200">{t("hotel_features_amenities_empty")}</p>
          )}
        </div>
      </div>
    </section>
  );
});
