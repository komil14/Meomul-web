import { DetailIcon, type DetailIconName } from "@/components/rooms/detail/detail-icon";
import type { RoomDetailItem } from "@/types/hotel";

export interface RoomHeroHighlight {
  label: string;
  value: string;
  icon: DetailIconName;
}

interface RoomHeroSectionProps {
  coverImage: string;
  galleryImages: string[];
  roomTypeLabel: string;
  viewTypeLabel: string;
  roomNumber?: string | null;
  roomName: string;
  roomDesc: string;
  basePrice: number;
  deal?: RoomDetailItem["lastMinuteDeal"];
  highlights: RoomHeroHighlight[];
}

export function RoomHeroSection({
  coverImage,
  galleryImages,
  roomTypeLabel,
  viewTypeLabel,
  roomNumber,
  roomName,
  roomDesc,
  basePrice,
  deal,
  highlights,
}: RoomHeroSectionProps) {
  return (
    <section className="relative overflow-hidden rounded-[2.2rem] border border-slate-200/90 bg-white shadow-[0_24px_60px_-35px_rgba(15,23,42,0.55)]">
      <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-cyan-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-blue-200/60 blur-3xl" />
      <div
        className="relative h-[32rem] w-full bg-slate-200 bg-cover bg-center sm:h-[36rem]"
        style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
      >
        {!coverImage ? (
          <div className="flex h-full items-center justify-center bg-slate-100 text-base font-medium text-slate-500">No room image</div>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.28),transparent_45%)]" />
            <div className="absolute left-4 right-4 top-4 rounded-2xl border border-white/35 bg-slate-900/55 px-4 py-3 text-right text-white shadow-xl backdrop-blur sm:left-auto sm:right-7 sm:top-7 sm:w-auto">
              {deal?.isActive ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-200">Deal Price</p>
                  <p className="mt-1 text-2xl font-semibold">₩ {deal.dealPrice.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-200 line-through">₩ {deal.originalPrice.toLocaleString()}</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Nightly Rate</p>
                  <p className="mt-1 text-2xl font-semibold">₩ {basePrice.toLocaleString()}</p>
                </>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                  {roomTypeLabel}
                </span>
                <span className="rounded-full border border-white/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                  {viewTypeLabel} View
                </span>
                {roomNumber ? (
                  <span className="rounded-full border border-white/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                    Room #{roomNumber}
                  </span>
                ) : null}
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{roomName}</h1>
              <p className="mt-3 max-w-3xl text-base text-slate-100 sm:text-lg">{roomDesc || "Premium room prepared with practical comforts and a refined atmosphere."}</p>
              <div className="mt-5 grid grid-cols-2 gap-2 lg:max-w-2xl lg:grid-cols-4">
                {highlights.map((item) => (
                  <article key={item.label} className="rounded-xl border border-white/35 bg-white/10 px-3 py-2 backdrop-blur-sm">
                    <div className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/40 bg-white/10 text-white">
                      <DetailIcon name={item.icon} />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">{item.label}</p>
                    <p className="text-lg font-semibold">{item.value}</p>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {galleryImages.length > 0 ? (
        <div className="border-t border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50/35 p-3 sm:p-4">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {galleryImages.map((image, index) => (
              <div key={image} className="group relative h-32 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:h-36 sm:min-w-[12rem]">
                <div className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${image})` }} aria-hidden />
                <span className="absolute left-2 top-2 rounded-md border border-white/35 bg-slate-900/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
