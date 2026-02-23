import type { RoomListItem } from "@/types/hotel";

interface RoomCardProps {
  room: RoomListItem;
}

export function RoomCard({ room }: RoomCardProps) {
  const coverImage = room.roomImages[0];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="h-32 w-full bg-slate-200 bg-cover bg-center"
        style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
      >
        {!coverImage ? (
          <div className="flex h-full items-center justify-center bg-slate-100 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
            No Image
          </div>
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{room.roomName}</h3>
        <p className="text-sm text-slate-600">
          {room.roomType} · {room.roomStatus}
        </p>
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>₩ {room.basePrice.toLocaleString()}</span>
          <span>{room.availableRooms} left</span>
        </div>
      </div>
    </article>
  );
}
