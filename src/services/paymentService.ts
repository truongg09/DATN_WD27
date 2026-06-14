import api from "./api";

export const createPayment = async (
  data: any
) => {
  return api.post("/payments", data);
};

export const getPayments = async () => {
  return api.get("/payments");
};

export const refundPayment = async (
  id: number
) => {
  return api.patch(
    `/payments/${id}/refund`
  );
};