import api from "./api";

export const getVouchers = async () => {
  return api.get("/vouchers");
};

export const createVoucher = async (
  data: Record<string, unknown>
) => {
  return api.post("/vouchers", data);
};

export const updateVoucher = async (id: number, data: Record<string, unknown>) => {
  return api.put(`/vouchers/${id}`, data);
};

export const deleteVoucher = async (id: number) => {
  return api.delete(`/vouchers/${id}`);
};