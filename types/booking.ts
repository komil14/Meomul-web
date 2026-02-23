export type PaymentMethod = "AT_HOTEL" | "CREDIT_CARD" | "DEBIT_CARD" | "KAKAOPAY" | "NAVERPAY" | "TOSS";

export interface BookedRoomInput {
  roomId: string;
  roomType: string;
  quantity: number;
  pricePerNight: number;
  guestName?: string;
}

export interface BookingInput {
  guestId?: string;
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
  adultCount: number;
  childCount?: number;
  paymentMethod: PaymentMethod;
  rooms: BookedRoomInput[];
  specialRequests?: string;
}

export interface BookedRoomDto {
  roomId: string;
  roomType: string;
  quantity: number;
  pricePerNight: number;
  guestName?: string | null;
}

export interface BookingDto {
  _id: string;
  bookingCode: string;
  bookingStatus: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalPrice: number;
  subtotal: number;
  taxes: number;
  serviceFee: number;
  weekendSurcharge: number;
  earlyCheckInFee: number;
  lateCheckOutFee: number;
  discount: number;
  rooms: BookedRoomDto[];
}

export interface CreateBookingMutationData {
  createBooking: BookingDto;
}

export interface CreateBookingMutationVars {
  input: BookingInput;
}
