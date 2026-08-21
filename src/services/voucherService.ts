import api from "./api";

export interface CustomerVoucher {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscount: number | null;
  minBookingAmount: number | null;
  startDate: string;
  endDate: string;
  status: "active";
  grantedSource: string | null;
  isPersonal: number | boolean;
  roomTypeNames: string | null;
}

export const getMyVouchers = async () => {
  return api.get("/vouchers/me") as Promise<{ data: CustomerVoucher[] }>;
};

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
