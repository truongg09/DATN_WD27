import api from "./api";

export const getReviews = async () => {
  return api.get("/reviews");
};

export const createReview = async (
  data: Record<string, unknown>
) => {
  return api.post("/reviews", data);
};