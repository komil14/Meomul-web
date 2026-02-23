import { gql } from "@apollo/client";

export const GET_HOTELS_QUERY = gql`
  query GetHotels($input: PaginationInput!, $search: HotelSearchInput) {
    getHotels(input: $input, search: $search) {
      list {
        _id
        hotelTitle
        hotelLocation
        hotelType
        hotelRating
        hotelLikes
        hotelImages
      }
      metaCounter {
        total
      }
    }
  }
`;

export const GET_HOTEL_QUERY = gql`
  query GetHotel($hotelId: String!) {
    getHotel(hotelId: $hotelId) {
      _id
      hotelTitle
      hotelLocation
      hotelType
      hotelRating
      hotelLikes
      hotelImages
    }
  }
`;

export const GET_ROOM_QUERY = gql`
  query GetRoom($roomId: String!) {
    getRoom(roomId: $roomId) {
      _id
      roomName
      roomType
      roomStatus
      basePrice
      availableRooms
      roomImages
    }
  }
`;

export const GET_ROOMS_BY_HOTEL_QUERY = gql`
  query GetRoomsByHotel($hotelId: String!, $input: PaginationInput!) {
    getRoomsByHotel(hotelId: $hotelId, input: $input) {
      list {
        _id
        roomName
        roomType
        basePrice
        availableRooms
        roomImages
        roomStatus
      }
      metaCounter {
        total
      }
    }
  }
`;

export const GET_AGENT_HOTELS_QUERY = gql`
  query GetAgentHotels($input: PaginationInput!) {
    getAgentHotels(input: $input) {
      list {
        _id
        hotelTitle
        hotelLocation
        hotelType
        hotelRating
        hotelLikes
        hotelImages
      }
      metaCounter {
        total
      }
    }
  }
`;

export const GET_DASHBOARD_STATS_QUERY = gql`
  query GetDashboardStats {
    getDashboardStats {
      totalMembers
      totalHotels
      totalBookings
      totalRevenue
      pendingHotels
      pendingBookings
      newBookingsToday
      todayRevenue
    }
  }
`;
