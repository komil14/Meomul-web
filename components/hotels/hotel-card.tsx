import Link from "next/link";
import type { HotelListItem } from "@/types/hotel";

interface HotelCardProps {
  hotel: HotelListItem;
}

export function HotelCard({ hotel }: HotelCardProps) {
  const coverImage = hotel.hotelImages[0];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/hotels/${hotel._id}`} className="block">
        <div
          className="h-40 w-full bg-slate-200 bg-cover bg-center"
          style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
        >
          {!coverImage ? (
            <div className="flex h-full items-center justify-center bg-slate-100 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              No Image
            </div>
          ) : null}
        </div>

        <div className="space-y-2 p-4">
          <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{hotel.hotelTitle}</h3>
          <p className="text-sm text-slate-600">
            {hotel.hotelLocation} · {hotel.hotelType}
          </p>
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Rating {hotel.hotelRating.toFixed(1)}</span>
            <span>{hotel.hotelLikes} likes</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
