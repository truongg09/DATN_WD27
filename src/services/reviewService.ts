import api from "./api";

export const getReviews = async (params?: { bookingIds?: string }) => {
  return api.get("/reviews", { params });
};

export const createReview = async (
  data: Record<string, unknown>
) => {
  return api.post("/reviews", data);
};

export const getReviewByBookingId = async (bookingId: number) => {
  return api.get(`/reviews/booking/${bookingId}`);
};

export const updateReview = async (id: number, data: Record<string, unknown>) => {
  return api.put(`/reviews/${id}`, data);
};