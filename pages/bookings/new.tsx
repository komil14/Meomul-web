import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { CREATE_BOOKING_MUTATION } from "@/graphql/booking.gql";
import { GET_HOTEL_QUERY, GET_ROOM_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import type { CreateBookingMutationData, CreateBookingMutationVars, PaymentMethod } from "@/types/booking";
import type { GetHotelQueryData, GetHotelQueryVars, GetRoomQueryData, GetRoomQueryVars } from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";

const PAYMENT_METHODS: PaymentMethod[] = ["AT_HOTEL", "CREDIT_CARD", "DEBIT_CARD", "KAKAOPAY", "NAVERPAY", "TOSS"];

const parsePositiveInt = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const diffNights = (checkInDate: string, checkOutDate: string): number => {
  if (!checkInDate || !checkOutDate) {
    return 0;
  }

  const checkIn = new Date(`${checkInDate}T00:00:00.000Z`);
  const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);
  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
};

const toDateTime = (date: string): string => `${date}T00:00:00.000Z`;

const NewBookingPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);

  const hotelId = useMemo(() => {
    if (typeof router.query.hotelId === "string") {
      return router.query.hotelId;
    }

    return "";
  }, [router.query.hotelId]);

  const roomId = useMemo(() => {
    if (typeof router.query.roomId === "string") {
      return router.query.roomId;
    }

    return "";
  }, [router.query.roomId]);

  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [guestCountInput, setGuestCountInput] = useState("1");
  const [quantityInput, setQuantityInput] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("AT_HOTEL");
  const [guestName, setGuestName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [createdBookingCode, setCreatedBookingCode] = useState<string | null>(null);

  const { data: hotelData, loading: hotelLoading, error: hotelError } = useQuery<GetHotelQueryData, GetHotelQueryVars>(
    GET_HOTEL_QUERY,
    {
      skip: !hotelId,
      variables: { hotelId },
      fetchPolicy: "cache-and-network",
    },
  );

  const { data: roomData, loading: roomLoading, error: roomError } = useQuery<GetRoomQueryData, GetRoomQueryVars>(GET_ROOM_QUERY, {
    skip: !roomId,
    variables: { roomId },
    fetchPolicy: "cache-and-network",
  });

  const [createBooking, { loading: creating, data: createdBookingData, error: createError }] = useMutation<
    CreateBookingMutationData,
    CreateBookingMutationVars
  >(CREATE_BOOKING_MUTATION);

  const hotel = hotelData?.getHotel;
  const room = roomData?.getRoom;

  const guestCount = parsePositiveInt(guestCountInput);
  const quantity = parsePositiveInt(quantityInput);

  const nights = diffNights(checkInDate, checkOutDate);
  const effectivePrice =
    room?.lastMinuteDeal && room.lastMinuteDeal.isActive ? room.lastMinuteDeal.dealPrice : room?.basePrice ?? 0;

  const estimatedSubtotal = effectivePrice * (quantity ?? 0) * Math.max(0, nights);

  const memberType = member?.memberType;
  const canCreateBooking = memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";
  const isOperator = memberType === "ADMIN_OPERATOR";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!hotelId || !roomId || !hotel || !room) {
      setFormError("Missing hotel/room context. Please start from the room list.");
      return;
    }

    if (!canCreateBooking) {
      setFormError("Your role cannot create booking with current backend policy.");
      return;
    }

    if (room.hotelId !== hotelId) {
      setFormError("Room does not belong to selected hotel.");
      return;
    }

    if (!guestCount || !quantity) {
      setFormError("Guest count and room quantity must be positive integers.");
      return;
    }

    if (!checkInDate || !checkOutDate) {
      setFormError("Please select check-in and check-out dates.");
      return;
    }

    if (nights < 1) {
      setFormError("Check-out date must be after check-in date.");
      return;
    }

    if (room.availableRooms < quantity) {
      setFormError(`Only ${room.availableRooms} room(s) currently available.`);
      return;
    }

    if (guestCount > room.maxOccupancy * quantity) {
      setFormError(`Max occupancy exceeded. This booking supports up to ${room.maxOccupancy * quantity} guests.`);
      return;
    }

    try {
      const response = await createBooking({
        variables: {
          input: {
            hotelId,
            checkInDate: toDateTime(checkInDate),
            checkOutDate: toDateTime(checkOutDate),
            adultCount: guestCount,
            childCount: 0,
            paymentMethod,
            specialRequests: specialRequests || undefined,
            rooms: [
              {
                roomId,
                roomType: room.roomType,
                quantity,
                pricePerNight: effectivePrice,
                guestName: guestName || undefined,
              },
            ],
          },
        },
      });

      const bookingCode = response.data?.createBooking.bookingCode;
      setCreatedBookingCode(bookingCode ?? null);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  if (!hotelId || !roomId) {
    return (
      <main className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Missing booking context. Open booking from a specific hotel room.
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/hotels/${hotelId}`} className="text-slate-600 underline underline-offset-4">
          Back to hotel
        </Link>
        <Link href="/hotels" className="text-slate-600 underline underline-offset-4">
          Browse hotels
        </Link>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Booking</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create New Booking</h1>
        <p className="mt-2 text-sm text-slate-600">Select dates, guests, quantity, and payment method.</p>
      </header>

      {memberType === "AGENT" || memberType === "ADMIN" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Current backend creates booking under your own account. Booking for another user is not supported yet.
        </div>
      ) : null}

      {isOperator ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Current backend blocks `ADMIN_OPERATOR` from `createBooking`. You can manage payment/status on existing bookings but
          cannot create a new booking yet.
        </div>
      ) : null}

      {hotelError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{getErrorMessage(hotelError)}</div>
      ) : null}
      {roomError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{getErrorMessage(roomError)}</div>
      ) : null}

      {hotelLoading || roomLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading booking context...</div>
      ) : null}

      {hotel && room ? (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Hotel</h2>
            <p className="mt-2 text-sm text-slate-700">{hotel.hotelTitle}</p>
            <p className="text-sm text-slate-600">
              {hotel.hotelLocation} · {hotel.hotelType}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Room</h2>
            <p className="mt-2 text-sm text-slate-700">{room.roomName}</p>
            <p className="text-sm text-slate-600">
              {room.roomType} · max {room.maxOccupancy} guest(s)
            </p>
            <p className="mt-2 text-sm text-slate-700">Available: {room.availableRooms}</p>
            <p className="text-sm text-slate-700">Price per night: ₩ {effectivePrice.toLocaleString()}</p>
          </article>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Check-in</span>
            <input
              type="date"
              value={checkInDate}
              onChange={(event) => setCheckInDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Check-out</span>
            <input
              type="date"
              value={checkOutDate}
              onChange={(event) => setCheckOutDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Guest count</span>
            <input
              value={guestCountInput}
              onChange={(event) => setGuestCountInput(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Room quantity</span>
            <input
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              required
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Payment method</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Guest name (optional)</span>
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              placeholder="Name shown in booking rooms[]"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Special requests (optional)</span>
            <textarea
              value={specialRequests}
              onChange={(event) => setSpecialRequests(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              placeholder="Late arrival note, accessibility request, etc."
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            Estimated subtotal: <span className="font-semibold">₩ {estimatedSubtotal.toLocaleString()}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Final total is calculated on server (taxes, service fee, surcharges).</p>
        </div>

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        {createError ? <p className="text-sm text-red-600">{getErrorMessage(createError)}</p> : null}

        <button
          type="submit"
          disabled={creating || !canCreateBooking}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "Creating booking..." : "Create booking"}
        </button>
      </form>

      {createdBookingCode && createdBookingData?.createBooking ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-800">Booking created</h2>
          <p className="mt-2 text-sm text-emerald-800">
            Code: <span className="font-semibold">{createdBookingCode}</span>
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Total price: <span className="font-semibold">₩ {createdBookingData.createBooking.totalPrice.toLocaleString()}</span>
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Payment status: <span className="font-semibold">{createdBookingData.createBooking.paymentStatus}</span>
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/dashboard" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">
              Go to dashboard
            </Link>
            <Link href={`/hotels/${hotelId}`} className="text-sm font-semibold text-emerald-800 underline underline-offset-4">
              Back to hotel
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
};

NewBookingPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default NewBookingPage;
