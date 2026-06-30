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

export const cancelBooking = async (
  id: number
) => {
  return api.patch(
    `/bookings/${id}/cancel`
  );
};

export const addBookingServiceCharge = async (
  id: number,
  data: { serviceId: number; quantity: number }
) => {
  return api.post(`/bookings/${id}/services`, data);
};

export const extendBookingStay = async (
  id: number,
  data: { checkOut: string }
) => {
  return api.patch(`/bookings/${id}/extend`, data);
};

export const checkIn = async (
  id: number
) => {
  return api.patch(
    `/bookings/${id}/check-in`
  );
};

export const checkOut = async (
  id: number
) => {
  return api.patch(
    `/bookings/${id}/check-out`
  );
};
