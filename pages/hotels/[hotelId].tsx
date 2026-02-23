import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { RoomCard } from "@/components/hotels/room-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_HOTEL_QUERY, GET_ROOMS_BY_HOTEL_QUERY } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelQueryData,
  GetHotelQueryVars,
  GetRoomsByHotelQueryData,
  GetRoomsByHotelQueryVars,
} from "@/types/hotel";

const ROOM_PAGE_SIZE = 12;

export default function HotelDetailPage() {
  const router = useRouter();

  const hotelId = useMemo(() => {
    if (typeof router.query.hotelId === "string") {
      return router.query.hotelId;
    }

    return "";
  }, [router.query.hotelId]);

  const {
    data: hotelData,
    loading: hotelLoading,
    error: hotelError,
  } = useQuery<GetHotelQueryData, GetHotelQueryVars>(GET_HOTEL_QUERY, {
    skip: !hotelId,
    variables: { hotelId },
    fetchPolicy: "cache-and-network",
  });

  const {
    data: roomsData,
    loading: roomsLoading,
    error: roomsError,
  } = useQuery<GetRoomsByHotelQueryData, GetRoomsByHotelQueryVars>(GET_ROOMS_BY_HOTEL_QUERY, {
    skip: !hotelId,
    variables: {
      hotelId,
      input: {
        page: 1,
        limit: ROOM_PAGE_SIZE,
        sort: "createdAt",
        direction: -1,
      },
    },
    fetchPolicy: "cache-and-network",
  });

  const hotel = hotelData?.getHotel;
  const rooms = roomsData?.getRoomsByHotel.list ?? [];

  if (!hotelId) {
    return (
      <main className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Loading hotel route...
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/hotels" className="text-sm text-slate-600 underline underline-offset-4">
          Back to hotels
        </Link>
      </div>

      {hotelError ? <ErrorNotice message={getErrorMessage(hotelError)} /> : null}

      {hotelLoading && !hotel ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading hotel...</div>
      ) : null}

      {!hotelLoading && !hotel && !hotelError ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Hotel not found.
        </div>
      ) : null}

      {hotel ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div
            className="h-56 w-full bg-slate-200 bg-cover bg-center"
            style={hotel.hotelImages[0] ? { backgroundImage: `url(${hotel.hotelImages[0]})` } : undefined}
          />
          <div className="space-y-2 p-5">
            <h1 className="text-2xl font-semibold text-slate-900">{hotel.hotelTitle}</h1>
            <p className="text-sm text-slate-600">
              {hotel.hotelLocation} · {hotel.hotelType}
            </p>
            <p className="text-sm text-slate-700">
              Rating {hotel.hotelRating.toFixed(1)} · {hotel.hotelLikes} likes
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Rooms</h2>
            <p className="text-sm text-slate-600">Available room options for this hotel.</p>
          </div>
        </header>

        {roomsError ? <ErrorNotice message={getErrorMessage(roomsError)} /> : null}

        {roomsLoading && rooms.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading rooms...</div>
        ) : null}

        {!roomsLoading && rooms.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            No rooms found for this hotel.
          </div>
        ) : null}

        {rooms.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room._id} room={room} hotelId={hotelId} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
