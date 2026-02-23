import { gql } from "@apollo/client";

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
