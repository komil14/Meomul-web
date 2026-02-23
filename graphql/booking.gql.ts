import { gql } from "@apollo/client";

export const SEARCH_MEMBERS_FOR_BOOKING_QUERY = gql`
  query SearchMembersForBooking($keyword: String!, $limit: Int) {
    searchMembersForBooking(keyword: $keyword, limit: $limit) {
      _id
      memberNick
      memberFullName
      memberPhone
    }
  }
`;

export const CREATE_BOOKING_MUTATION = gql`
  mutation CreateBooking($input: BookingInput!) {
    createBooking(input: $input) {
      _id
      bookingCode
      bookingStatus
      paymentMethod
      paymentStatus
      checkInDate
      checkOutDate
      nights
      subtotal
      taxes
      serviceFee
      weekendSurcharge
      earlyCheckInFee
      lateCheckOutFee
      discount
      totalPrice
      rooms {
        roomId
        roomType
        quantity
        pricePerNight
        guestName
      }
    }
  }
`;
