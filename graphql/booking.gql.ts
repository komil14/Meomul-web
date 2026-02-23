import { gql } from "@apollo/client";

const BOOKING_LIST_FIELDS = gql`
  fragment BookingListFields on BookingDto {
    _id
    bookingCode
    bookingStatus
    paymentStatus
    paidAmount
    totalPrice
    checkInDate
    checkOutDate
    createdAt
    guestId
    hotelId
    rooms {
      roomType
      quantity
      guestName
    }
  }
`;

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

export const GET_MY_BOOKINGS_QUERY = gql`
  query GetMyBookings($input: PaginationInput!) {
    getMyBookings(input: $input) {
      list {
        ...BookingListFields
      }
      metaCounter {
        total
      }
    }
  }
  ${BOOKING_LIST_FIELDS}
`;

export const GET_AGENT_BOOKINGS_QUERY = gql`
  query GetAgentBookings($hotelId: String!, $input: PaginationInput!) {
    getAgentBookings(hotelId: $hotelId, input: $input) {
      list {
        ...BookingListFields
      }
      metaCounter {
        total
      }
    }
  }
  ${BOOKING_LIST_FIELDS}
`;

export const UPDATE_BOOKING_STATUS_MUTATION = gql`
  mutation UpdateBookingStatus($bookingId: String!, $status: BookingStatus!) {
    updateBookingStatus(bookingId: $bookingId, status: $status) {
      ...BookingListFields
    }
  }
  ${BOOKING_LIST_FIELDS}
`;

export const UPDATE_PAYMENT_STATUS_MUTATION = gql`
  mutation UpdatePaymentStatus($bookingId: String!, $paymentStatus: PaymentStatus!, $paidAmount: Float!) {
    updatePaymentStatus(bookingId: $bookingId, paymentStatus: $paymentStatus, paidAmount: $paidAmount) {
      ...BookingListFields
    }
  }
  ${BOOKING_LIST_FIELDS}
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
