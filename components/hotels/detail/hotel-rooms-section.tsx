import { RoomCard } from "@/components/hotels/room-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { RoomListItem } from "@/types/hotel";

interface HotelRoomsSectionProps {
  rooms: RoomListItem[];
  roomsLoading: boolean;
  roomsErrorMessage: string | null;
  hotelId: string;
}

export function HotelRoomsSection({ rooms, roomsLoading, roomsErrorMessage, hotelId }: HotelRoomsSectionProps) {
  return (
    <section id="rooms" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Rooms</h2>
        <p className="text-sm text-slate-600">Available options and pricing for this property.</p>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room._id} room={room} hotelId={hotelId} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
