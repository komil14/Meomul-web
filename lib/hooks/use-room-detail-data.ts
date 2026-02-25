import { useQuery } from "@apollo/client/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { GET_HOTEL_CONTEXT_QUERY, GET_PRICE_CALENDAR_QUERY, GET_ROOM_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { formatDateInput } from "@/lib/rooms/booking";
import type {
  GetHotelContextQueryData,
  GetHotelContextQueryVars,
  GetPriceCalendarQueryData,
  GetPriceCalendarQueryVars,
  GetRoomQueryData,
  GetRoomQueryVars,
  RoomDetailItem,
} from "@/types/hotel";

interface UseRoomDetailDataResult {
  isHydrated: boolean;
  memberType: string | undefined;
  todayDate: string;
  todayMonth: string;
  calendarMonth: string;
  setCalendarMonth: (value: string) => void;
  roomId: string;
  room: RoomDetailItem | undefined;
  roomLoading: boolean;
  roomError: unknown;
  roomHotelId: string;
  priceCalendarData: GetPriceCalendarQueryData | undefined;
  priceCalendarLoading: boolean;
  priceCalendarError: unknown;
  refetchPriceCalendar: (variables?: GetPriceCalendarQueryVars) => Promise<unknown>;
  hotel: GetHotelContextQueryData["getHotel"] | undefined;
  hotelError: unknown;
  coverImage: string;
  galleryImages: string[];
  activeDeal: RoomDetailItem["lastMinuteDeal"] | null;
}

export const useRoomDetailData = (): UseRoomDetailDataResult => {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [member, setMember] = useState<ReturnType<typeof getSessionMember>>(null);

  useEffect(() => {
    setIsHydrated(true);
    setMember(getSessionMember());
  }, []);

  const todayDate = useMemo(() => formatDateInput(new Date()), []);
  const todayMonth = useMemo(() => todayDate.slice(0, 7), [todayDate]);
  const [calendarMonth, setCalendarMonth] = useState(todayMonth);

  const roomId = useMemo(() => {
    if (typeof router.query.roomId === "string") {
      return router.query.roomId;
    }
    return "";
  }, [router.query.roomId]);

  const {
    data: roomData,
    loading: roomLoading,
    error: roomError,
  } = useQuery<GetRoomQueryData, GetRoomQueryVars>(GET_ROOM_QUERY, {
    skip: !isHydrated || !roomId,
    variables: { roomId },
    fetchPolicy: "cache-and-network",
  });

  const room = roomData?.getRoom;
  const roomHotelId = room?.hotelId ?? "";

  const {
    data: priceCalendarData,
    loading: priceCalendarLoading,
    error: priceCalendarError,
    refetch: refetchPriceCalendar,
  } = useQuery<GetPriceCalendarQueryData, GetPriceCalendarQueryVars>(GET_PRICE_CALENDAR_QUERY, {
    skip: !isHydrated || !roomId,
    variables: {
      input: {
        roomId,
        month: calendarMonth,
      },
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { data: hotelData, error: hotelError } = useQuery<GetHotelContextQueryData, GetHotelContextQueryVars>(GET_HOTEL_CONTEXT_QUERY, {
    skip: !isHydrated || !roomHotelId,
    variables: {
      hotelId: roomHotelId,
    },
    fetchPolicy: "cache-first",
  });

  const hotel = hotelData?.getHotel;
  const coverImage = room?.roomImages[0] ?? "";
  const galleryImages = room?.roomImages.slice(1) ?? [];
  const activeDeal = useMemo(() => {
    const deal = room?.lastMinuteDeal;
    if (!deal?.isActive) {
      return null;
    }

    const expiresAtMs = new Date(deal.validUntil).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return null;
    }

    return deal;
  }, [room?.lastMinuteDeal]);

  return {
    isHydrated,
    memberType: member?.memberType,
    todayDate,
    todayMonth,
    calendarMonth,
    setCalendarMonth,
    roomId,
    room,
    roomLoading,
    roomError,
    roomHotelId,
    priceCalendarData,
    priceCalendarLoading,
    priceCalendarError,
    refetchPriceCalendar,
    hotel,
    hotelError,
    coverImage,
    galleryImages,
    activeDeal,
  };
};
