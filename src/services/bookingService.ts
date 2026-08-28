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
    rooms: Array<{
      roomTypeId: number;
      quantity: number;
      adults?: number;
      children?: number;
      childrenAges?: number[];
    }>;
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

// ─── Service Charges ───────────────────────────────────────────────

export const getBookingServiceCharges = async (bookingId: number) => {
  return api.get(`/bookings/${bookingId}/services`);
};

/** Một yêu cầu dịch vụ khách gửi, chờ lễ tân duyệt mới tính tiền. */
export interface BookingServiceRequest {
  id: number;
  bookingId: number;
  roomId?: number | null;
  bookingDetailId?: number | null;
  serviceId: number;
  serviceName?: string;
  description?: string;
  unitPrice?: number;
  totalPrice?: number;
  quantity: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  note?: string | null;
  roomNumber?: string | null;
  createdAt?: string;
}

/** Danh sách yêu cầu dịch vụ của một đơn (khách xem đơn của chính mình). */
export const getBookingServiceRequests = async (id: number) => {
  return api.get(`/bookings/${id}/service-requests`) as Promise<{
    data: BookingServiceRequest[];
  }>;
};

/**
 * Khách đặt thêm dịch vụ giữa kỳ lưu trú. Khác addBookingServiceCharge (lễ tân
 * ghi thẳng vào hóa đơn): hàm này chỉ tạo yêu cầu chờ duyệt, chưa cộng tiền.
 */
export const createBookingServiceRequest = async (
  id: number,
  data: {
    serviceId: number;
    quantity: number;
    roomId?: number | null;
    bookingDetailId?: number | null;
    note?: string | null;
  }
) => {
  return api.post(`/bookings/${id}/service-requests`, data);
};

/** Khách tự hủy yêu cầu dịch vụ khi lễ tân chưa xác nhận. */
export const cancelBookingServiceRequest = async (requestId: number) => {
  return api.patch(`/service-requests/${requestId}/cancel`);
};

export const addBookingServiceCharge = async (
  id: number,
  data: { serviceId: number; quantity: number; roomId?: number | null; bookingDetailId?: number | null; customerId?: number | null; guestName?: string | null; status?: string }
) => {
  return api.post(`/bookings/${id}/services`, data);
};

export const updateBookingServiceCharge = async (
  id: number,
  serviceChargeId: number,
  data: { quantity?: number; roomId?: number | null; customerId?: number | null; guestName?: string | null; status?: string }
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
  bookingDetailId?: number | null;
  roomItemId?: number | null;
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

export const previewBookingChange = async (
  id: number,
  data: {
    checkOut?: string;
    toRoomId?: number;
    fromDate?: string;
    bookingDetailId?: number;
  }
) => {
  return api.post(`/bookings/${id}/preview-change`, data);
};

export const executeBookingChange = async (
  id: number,
  data: {
    checkOut?: string;
    toRoomId?: number;
    fromDate?: string;
    bookingDetailId?: number;
    reason?: string;
    refundRequest?: RefundRequestPayload;
    autoApproveRefund?: boolean;
  }
) => {
  return api.patch(`/bookings/${id}/change-stay`, data);
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

export interface ResetHoldResponse {
  bookingId: number;
  holdExpiresAt: string;
  hold_expires_at: string;
  holdResetCount: number;
  hold_reset_count: number;
  maxHoldResets: number;
  max_hold_resets: number;
  remainingResets: number;
  holdRemainingSeconds: number;
  canResetHold: boolean;
  message: string;
}

export const resetBookingHold = async (bookingId: number) => {
  return api.post(`/bookings/${bookingId}/reset-hold`) as Promise<{ message: string; data: ResetHoldResponse }>;
};

export type CustomerContactAction = 'will_arrive_late' | 'unreachable' | 'not_coming' | 'callback_later';

export interface CustomerContactPayload {
  action: CustomerContactAction;
  note?: string;
}

export const recordCustomerContact = async (
  id: number,
  data: CustomerContactPayload
) => {
  return api.post(`/bookings/${id}/contact-status`, data);
};

