import { memo } from "react";
import { RoomCard } from "@/components/hotels/room-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { RoomListItem } from "@/types/hotel";

interface HotelRoomsSectionProps {
  rooms: RoomListItem[];
  roomsLoading: boolean;
  roomsErrorMessage: string | null;
  hotelId: string;
}

export const HotelRoomsSection = memo(function HotelRoomsSection({
  rooms,
  roomsLoading,
  roomsErrorMessage,
  hotelId,
}: HotelRoomsSectionProps) {
  const roomCount = rooms.length;

  return (
    <section id="rooms" className="space-y-4 motion-fade-up motion-delay-3">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-5 text-white sm:px-6 hover-lift">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Stay Selection</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Choose your room</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Compare space, bed setup, live availability, and nightly rates before booking.
            </p>
          </div>
          <p className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100">
            {roomCount} option{roomCount === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      {roomsErrorMessage ? <ErrorNotice message={roomsErrorMessage} /> : null}

      {roomsLoading && rooms.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading rooms...</section>
      ) : null}

      {!roomsLoading && rooms.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No rooms found for this hotel.
        </section>
      ) : null}

      {rooms.length > 0 ? (
        <div className="space-y-5">
          {rooms.map((room) => (
            <RoomCard key={room._id} room={room} hotelId={hotelId} />
          ))}
        </div>
      ) : null}
    </section>
  );
});
