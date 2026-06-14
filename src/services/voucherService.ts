import api from "./api";

export const getVouchers = async () => {
  return api.get("/vouchers");
};

export const createVoucher = async (
  data: any
) => {
  return api.post("/vouchers", data);
};