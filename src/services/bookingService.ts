import api from "./api";

export const createBooking = async (
  data: any
) => {
  return api.post("/bookings", data);
};

export const getBookings = async () => {
  return api.get("/bookings");
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