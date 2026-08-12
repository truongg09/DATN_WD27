export interface RoomTypeSummaryItem {
  roomTypeId?: number;
  typeName: string;
  quantity: number;
  roomPrice?: number;
  capacity?: number;
  adultCapacity?: number;
  childCapacity?: number;
  maxOccupancy?: number;
  extraAdultFee?: number;
  extraChildFee?: number;
}

export interface BookingRoomItem {
  bookingDetailId?: number;
  id: number;
  number: string;
  floor?: number | null;
  area?: string | number | null;
  roomTypeId?: number;
  typeName?: string;
}

export interface BookingSummaryContainer {
  roomTypesSummary?: RoomTypeSummaryItem[];
  room_type_name?: string;
  room_quantity?: number;
  booking_rooms?: BookingRoomItem[];
  room_number?: string;
}

/**
 * Returns formatted multi-room-type summary string.
 * Example: "Standard ×2 · Deluxe ×1" or "Standard"
 */
export const renderRoomTypesSummaryText = (booking: BookingSummaryContainer | null | undefined): string => {
  if (!booking) return 'Đặt phòng';

  if (Array.isArray(booking.roomTypesSummary) && booking.roomTypesSummary.length > 0) {
    return booking.roomTypesSummary
      .map((s) => (s.quantity > 1 ? `${s.typeName} ×${s.quantity}` : s.typeName))
      .join(' · ');
  }

  if (booking.room_type_name) {
    const qty = Number(booking.room_quantity || 1);
    return qty > 1 ? `${booking.room_type_name} ×${qty}` : booking.room_type_name;
  }

  return 'Đặt phòng';
};

/**
 * Returns total room count for a booking.
 */
export const getBookingTotalRoomCount = (booking: BookingSummaryContainer | null | undefined): number => {
  if (!booking) return 1;
  if (Array.isArray(booking.roomTypesSummary) && booking.roomTypesSummary.length > 0) {
    return booking.roomTypesSummary.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }
  return Number(booking.room_quantity || 1);
};
