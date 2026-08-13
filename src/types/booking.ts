export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";

export interface Booking {
    id: number;
    customerId: number;
    voucherId?: number;
    bookingCode: string;
    bookingStatus: BookingStatus;
    totalAmount: number;
    createdAt: string;
    created_at?: string;
    hold_expires_at?: string;
    hold_reset_count?: number;
    last_hold_reset_at?: string;
    max_hold_resets?: number;
    can_reset_hold?: boolean;
    hold_remaining_seconds?: number;
}

export interface BookingDetail {
    id: number;
    bookingId: number;
    roomId: number;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children: number;
    roomPrice: number;
}

export interface RoomAvailability {
    id: number;
    roomId: number;
    bookingId?: number;
    date: string;
    status: "available" | "booked";
}