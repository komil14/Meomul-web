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
export type CancellationPolicy = "FLEXIBLE" | "MODERATE" | "STRICT";

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

export interface HotelDetailItem extends HotelListItem {
  hotelDesc: string;
  starRating: number;
  checkInTime: string;
  checkOutTime: string;
  suitableFor: string[];
  petsAllowed: boolean;
  smokingAllowed: boolean;
  cancellationPolicy: CancellationPolicy;
  detailedLocation: {
    address: string;
    district?: string | null;
    nearestSubway?: string | null;
    walkingDistance?: number | null;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  amenities: {
    wifi: boolean;
    parking: boolean;
    breakfast: boolean;
    roomService: boolean;
    gym: boolean;
    pool: boolean;
    workspace: boolean;
    familyRoom: boolean;
    kidsFriendly: boolean;
    wheelchairAccessible: boolean;
  };
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
  getHotel: HotelDetailItem;
}

export interface GetHotelQueryVars {
  hotelId: string;
}

export interface GetRoomQueryData {
  getRoom: RoomListItem;
}

export interface GetRoomQueryVars {
  roomId: string;
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

export type ReviewStatus = "PENDING" | "APPROVED" | "FLAGGED" | "REMOVED";

export interface HotelResponseDto {
  responseText: string;
  respondedBy: string;
  respondedAt: string;
}

export interface ReviewDto {
  _id: string;
  reviewerId: string;
  bookingId: string;
  hotelId: string;
  overallRating: number;
  cleanlinessRating: number;
  locationRating: number;
  serviceRating: number;
  amenitiesRating: number;
  valueRating: number;
  reviewTitle?: string | null;
  reviewText: string;
  guestPhotos: string[];
  helpfulCount: number;
  reviewStatus: ReviewStatus;
  verifiedStay: boolean;
  stayDate: string;
  createdAt: string;
  hotelResponse?: HotelResponseDto | null;
}

export interface ReviewsDto {
  list: ReviewDto[];
  metaCounter: MetaCounterDto;
}

export interface GetHotelReviewsQueryData {
  getHotelReviews: ReviewsDto;
}

export interface GetHotelReviewsQueryVars {
  hotelId: string;
  input: PaginationInput;
}

export interface GetSimilarHotelsQueryData {
  getSimilarHotels: HotelListItem[];
}

export interface GetSimilarHotelsQueryVars {
  hotelId: string;
  limit?: number;
}

export interface GetTrendingByLocationQueryData {
  getTrendingByLocation: HotelListItem[];
}

export interface GetTrendingByLocationQueryVars {
  location: HotelLocation;
  limit?: number;
}

export interface GetRecommendedHotelsQueryData {
  getRecommendedHotels: HotelListItem[];
}

export interface GetRecommendedHotelsQueryVars {
  limit?: number;
}
