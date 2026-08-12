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
  paidAmount?: number;
  tierLabel?: string;
  tier?: 'past_checkin' | 'under_3_days' | '3_to_7_days' | 'over_7_days' | 'full_override';
  reason?: string;
  forceFullRefund?: boolean;
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

// ─── Service Charges ───────────────────────────────────────────────

export const getBookingServiceCharges = async (bookingId: number) => {
  return api.get(`/bookings/${bookingId}/services`);
};

export const addBookingServiceCharge = async (
  id: number,
  data: { serviceId: number; quantity: number; roomId?: number | null; status?: string }
) => {
  return api.post(`/bookings/${id}/services`, data);
};

export const updateBookingServiceCharge = async (
  id: number,
  serviceChargeId: number,
  data: { quantity?: number; roomId?: number | null; status?: string }
) => {
  return api.patch(`/bookings/${id}/services/${serviceChargeId}`, data);
};

export const updateBookingServiceChargeStatus = async (
  bookingId: number,
  serviceChargeId: number,
  status: string
) => {
  return api.patch(`/bookings/${bookingId}/services/${serviceChargeId}/status`, { status });
};

export const deleteBookingServiceCharge = async (
  id: number,
  serviceChargeId: number
) => {
  return api.delete(`/bookings/${id}/services/${serviceChargeId}`);
};

// ─── Damage / Extra Fee / Other Charges ────────────────────────────

export const getBookingDamageCharges = async (bookingId: number) => {
  return api.get(`/bookings/${bookingId}/damages`);
};

export interface DamageChargePayload {
  roomId?: number | null;
  chargeType?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status?: string;
  note?: string | null;
}

export const addBookingDamageCharge = async (
  bookingId: number,
  data: DamageChargePayload
) => {
  return api.post(`/bookings/${bookingId}/damages`, data);
};

export const updateBookingDamageCharge = async (
  bookingId: number,
  chargeId: number,
  data: Partial<DamageChargePayload>
) => {
  return api.patch(`/bookings/${bookingId}/damages/${chargeId}`, data);
};

export const updateBookingDamageChargeStatus = async (
  bookingId: number,
  chargeId: number,
  status: string
) => {
  return api.patch(`/bookings/${bookingId}/damages/${chargeId}/status`, { status });
};

export const deleteBookingDamageCharge = async (
  bookingId: number,
  chargeId: number
) => {
  return api.delete(`/bookings/${bookingId}/damages/${chargeId}`);
};

// ─── Stay Management ──────────────────────────────────────────────

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

export const updateRequestedArrivalTime = async (
  id: number,
  requestedCheckInTime: string,
  dayOffset: number = 0,
  notes?: string
) => {
  return api.patch(`/bookings/${id}/arrival-time`, {
    requestedCheckInTime,
    dayOffset,
    notes
  });
};

export const updateRequestedDepartureTime = async (
  id: number,
  requestedCheckOutTime: string,
  notes?: string
) => {
  return api.patch(`/bookings/${id}/departure-time`, {
    requestedCheckOutTime,
    notes
  });
};