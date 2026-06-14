import api from "./api";

export const getReviews = async () => {
  return api.get("/reviews");
};

export const createReview = async (
  data: any
) => {
  return api.post("/reviews", data);
};