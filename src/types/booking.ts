export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";

export interface Booking {
    id: number;
    customerId: number;
    voucherId?: number;
    bookingCode: string;
    bookingStatus: BookingStatus;
    totalAmount: number;
    createdAt: string;
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