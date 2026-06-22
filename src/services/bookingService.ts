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

export const getBookings = async (params?: { userId?: number; status?: string }) => {
  return api.get("/bookings", { params });
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
