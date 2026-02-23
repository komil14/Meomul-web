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
export type HotelStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETE";
export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type BadgeLevel = "NONE" | "VERIFIED" | "SUPERHOST" | "INSPECTED";

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
  memberId: string;
  hotelDesc: string;
  hotelStatus: HotelStatus;
  verificationStatus: VerificationStatus;
  badgeLevel: BadgeLevel;
  hotelRank: number;
  hotelReviews: number;
  hotelViews: number;
  warningStrikes: number;
  safeStayCertified: boolean;
  ageRestriction: number;
  maxPetWeight?: number | null;
  hotelVideos: string[];
  starRating: number;
  checkInTime: string;
  checkOutTime: string;
  suitableFor: string[];
  petsAllowed: boolean;
  smokingAllowed: boolean;
  cancellationPolicy: CancellationPolicy;
  flexibleCheckIn: {
    enabled: boolean;
    times: string[];
    fee: number;
  };
  flexibleCheckOut: {
    enabled: boolean;
    times: string[];
    fee: number;
  };
  detailedLocation: {
    address: string;
    city: HotelLocation;
    district?: string | null;
    dong?: string | null;
    nearestSubway?: string | null;
    subwayExit?: string | null;
    subwayLines?: number[] | null;
    walkingDistance?: number | null;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  amenities: {
    wifi: boolean;
    wifiSpeed?: number | null;
    parking: boolean;
    parkingFee: number;
    breakfast: boolean;
    breakfastIncluded: boolean;
    roomService: boolean;
    gym: boolean;
    pool: boolean;
    workspace: boolean;
    familyRoom: boolean;
    kidsFriendly: boolean;
    wheelchairAccessible: boolean;
    elevator: boolean;
    accessibleBathroom: boolean;
    visualAlarms: boolean;
    serviceAnimalsAllowed: boolean;
    airportShuttle: boolean;
    evCharging: boolean;
    playground: boolean;
    meetingRoom: boolean;
    privateBath: boolean;
    restaurant: boolean;
    spa: boolean;
    coupleRoom: boolean;
    romanticView: boolean;
  };
  safetyFeatures: {
    fireSafety: boolean;
    securityCameras: boolean;
    frontDesk24h: boolean;
    roomSafe: boolean;
    femaleOnlyFloors: boolean;
    wellLitParking: boolean;
  };
  verificationDocs: {
    businessLicense?: string | null;
    touristLicense?: string | null;
    propertyOwnership?: string | null;
  };
  strikeHistory: Array<{
    date: string;
    reason: string;
    bookingId: string;
  }>;
  lastInspectionDate?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
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
