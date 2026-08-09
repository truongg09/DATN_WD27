import api from "./api";

export const createBooking = async (
  data: Record<string, unknown>
) => {
  return api.post("/bookings", data);
};

export const checkAvailability = async (
  data: Record<string, unknown>
) => {
  return api.post("/bookings/check-availability", data);
};

export const checkTypeAvailability = async (
  data: {
    checkIn: string;
    checkOut: string;
    rooms: Array<{ roomTypeId: number; quantity: number }>;
  }
) => {
  return api.post("/bookings/check-type-availability", data);
};

export const getBookings = async (params?: { userId?: number; status?: string }) => {
  return api.get("/bookings", { params });
};

export const getMyBookings = async () => {
  return api.get("/bookings/me");
};

export const getBookingDetail = async (
  id: number
) => {
  return api.get(`/bookings/${id}`);
};

export interface RefundRequestPayload {
  refundMethod: "cash" | "bank_transfer";
  bankBin?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface RefundPreview {
  bookingId: number;
  canCancel: boolean;
  bookingStatus: string;
  paymentId: number | null;
  daysBeforeCheckIn: number;
  refundRate: number;
  refundableAmount: number;
}

export const getRefundPreview = async (id: number) => {
  return api.get(`/bookings/${id}/refund-preview`) as Promise<{ data: RefundPreview }>;
};

export const cancelBooking = async (
  id: number,
  reason: string,
  refund?: RefundRequestPayload
) => {
  return api.patch(
    `/bookings/${id}/cancel`,
    { reason, ...(refund ? { refund } : {}) }
  );
};

export const addBookingServiceCharge = async (
  id: number,
  data: { serviceId: number; quantity: number }
) => {
  return api.post(`/bookings/${id}/services`, data);
};

export const updateBookingServiceCharge = async (
  id: number,
  serviceChargeId: number,
  data: { quantity: number }
) => {
  return api.patch(`/bookings/${id}/services/${serviceChargeId}`, data);
};

export const deleteBookingServiceCharge = async (
  id: number,
  serviceChargeId: number
) => {
  return api.delete(`/bookings/${id}/services/${serviceChargeId}`);
};

export const extendBookingStay = async (
  id: number,
  data: { checkOut: string }
) => {
  return api.patch(`/bookings/${id}/extend`, data);
};

export const updateBookingStay = async (
  id: number,
  data: {
    checkIn: string;
    checkOut: string;
    roomTypeId?: number | null;
  }
) => {
  return api.patch(`/bookings/${id}/update-stay`, data);
};

export const checkIn = async (
  id: number
) => {
  return api.patch(
    `/bookings/${id}/check-in`
  );
};

export const checkOut = async (id: number, actualCheckOutTime?: string) => {
  return api.patch(`/bookings/${id}/check-out`, { actualCheckOutTime });
};