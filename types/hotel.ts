export type HotelLocation =
  | "SEOUL"
  | "BUSAN"
  | "DAEGU"
  | "DAEJEON"
  | "GWANGJU"
  | "INCHEON"
  | "JEJU"
  | "GYEONGJU"
  | "GANGNEUNG";

export type HotelType = "HOTEL" | "MOTEL" | "RESORT" | "GUESTHOUSE" | "HANOK" | "PENSION";

export type RoomType = "STANDARD" | "DELUXE" | "SUITE" | "FAMILY" | "PREMIUM" | "PENTHOUSE";

export interface PaginationInput {
  page: number;
  limit: number;
  sort: string;
  direction: 1 | -1;
}

export interface PriceRangeInput {
  start?: number;
  end?: number;
}

export interface HotelSearchInput {
  location?: HotelLocation;
  hotelTypes?: HotelType[];
  priceRange?: PriceRangeInput;
}

export interface MetaCounterDto {
  total: number;
}

export interface HotelListItem {
  _id: string;
  hotelTitle: string;
  hotelLocation: HotelLocation;
  hotelType: HotelType;
  hotelRating: number;
  hotelLikes: number;
  hotelImages: string[];
}

export interface HotelsDto {
  list: HotelListItem[];
  metaCounter: MetaCounterDto;
}

export interface GetHotelsQueryData {
  getHotels: HotelsDto;
}

export interface GetHotelsQueryVars {
  input: PaginationInput;
  search?: HotelSearchInput;
}

export interface RoomListItem {
  _id: string;
  roomName: string;
  roomType: RoomType;
  basePrice: number;
  availableRooms: number;
  roomImages: string[];
  roomStatus: string;
}

export interface RoomsDto {
  list: RoomListItem[];
  metaCounter: MetaCounterDto;
}

export interface GetRoomsByHotelQueryData {
  getRoomsByHotel: RoomsDto;
}

export interface GetRoomsByHotelQueryVars {
  hotelId: string;
  input: PaginationInput;
}

export interface GetHotelQueryData {
  getHotel: HotelListItem;
}

export interface GetHotelQueryVars {
  hotelId: string;
}

export interface GetAgentHotelsQueryData {
  getAgentHotels: HotelsDto;
}

export interface GetAgentHotelsQueryVars {
  input: PaginationInput;
}

export interface DashboardStatsDto {
  totalMembers: number;
  totalHotels: number;
  totalBookings: number;
  totalRevenue: number;
  pendingHotels: number;
  pendingBookings: number;
  newBookingsToday: number;
  todayRevenue: number;
}

export interface GetDashboardStatsQueryData {
  getDashboardStats: DashboardStatsDto;
}
