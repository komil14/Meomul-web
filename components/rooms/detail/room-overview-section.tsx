import { memo } from "react";
import { DetailIcon, type DetailIconName } from "@/components/rooms/detail/detail-icon";
import type { RoomDetailItem } from "@/types/hotel";

export interface RoomFactCard {
  label: string;
  value: string;
  icon: DetailIconName;
}

export interface RoomAmenityCard {
  amenity: string;
  label: string;
  icon: DetailIconName;
  styles: {
    card: string;
    icon: string;
    badge: string;
  };
}

interface RoomOverviewSectionProps {
  roomTypeLine: string;
  roomName: string;
  hotelTitle?: string;
  hotelCheckInTime?: string;
  hotelCheckOutTime?: string;
  hotelCancellationPolicy?: string;
  deal?: RoomDetailItem["lastMinuteDeal"];
  roomDesc: string;
  factCards: RoomFactCard[];
  amenityCards: RoomAmenityCard[];
}

export const RoomOverviewSection = memo(function RoomOverviewSection({
  roomTypeLine,
  roomName,
  hotelTitle,
  hotelCheckInTime,
  hotelCheckOutTime,
  hotelCancellationPolicy,
  deal,
  roomDesc,
  factCards,
  amenityCards,
}: RoomOverviewSectionProps) {
  return (
    <div className="order-2 relative space-y-8 lg:order-1 lg:pr-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{roomTypeLine}</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{roomName}</h2>
          {hotelTitle ? <p className="mt-3 text-lg text-slate-600">{hotelTitle}</p> : null}
        </div>
        {deal?.isActive ? (
          <div className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-right shadow-sm sm:w-auto sm:min-w-[14rem]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Last minute deal</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">₩ {deal.dealPrice.toLocaleString()}</p>
            <p className="text-xs text-slate-500 line-through">₩ {deal.originalPrice.toLocaleString()}</p>
          </div>
        ) : null}
      </div>

      <p className="max-w-3xl text-lg leading-8 text-slate-700">
        {roomDesc || "No room description provided. This room is prepared for practical comfort with distinct atmosphere and clean details."}
      </p>

      {hotelCheckInTime || hotelCheckOutTime || hotelCancellationPolicy ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Check-in</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{hotelCheckInTime || "-"}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Check-out</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{hotelCheckOutTime || "-"}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Cancellation</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{hotelCancellationPolicy || "-"}</p>
          </article>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {factCards.map((item) => (
          <article key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
              <DetailIcon name={item.icon} className="h-6 w-6" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Room Amenities</h3>
          <p className="mt-1 text-sm text-slate-600">Clear icon-based amenity list so guests quickly understand what this room includes.</p>
        </div>
        {amenityCards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {amenityCards.map((item) => (
              <article key={item.amenity} className={`rounded-2xl border px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-sm ${item.styles.card}`}>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${item.styles.icon}`}>
                    <DetailIcon name={item.icon} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 sm:text-base">{item.label}</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${item.styles.badge}`}>
                      Ready to use
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No detailed amenities were provided for this room.</p>
        )}
      </div>
    </div>
  );
});
